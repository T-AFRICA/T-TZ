-- 0017_inventory_admin.sql — stock from the Central Admin, with its history (DRAFT).
--
-- Forward-only, additive. Exercised only against a disposable PGlite
-- database with a Supabase role shim (database/client/tests); applying it
-- to a Supabase project needs owner approval. Requires 0004, 0006, 0009 and
-- 0016. Safe to run again.
--
-- Owner decisions 2026-11-20:
--   * Stock is changed by adding or removing units with a reason (a
--     delivery from the supplier, damage, a recount...), or set to a counted
--     total as a correction. Each change is one line in the history.
--   * Each product has its own low-stock level (5 unless set otherwise);
--     the Inventory page and the dashboard count "low" with it.
--   * The history shows the administrators' changes and what orders did to
--     the stock: an order placed takes units, a cancelled order gives them
--     back, each with its order number.
--
-- Rules:
--   * The functions are executable by service_role only (signed requests
--     from the Central Admin, verified by the storefront).
--   * Removing more units than there are is refused; stock never goes
--     below zero (0004's check).
--   * An administrator's change is applied once per request.
--   * The history starts when this migration runs; earlier changes were
--     not recorded.

begin;

alter table stock_levels add column if not exists low_stock_at integer not null default 5
  check (low_stock_at between 0 and 100000);

create table if not exists stock_movements (
  id               bigint generated always as identity primary key,
  product_id       uuid not null references products (id) on delete cascade,
  country_code     char(2) not null references countries (code),
  change           integer not null check (change <> 0),
  available_after  integer not null check (available_after >= 0),
  reason           text not null check (reason in ('received', 'returned', 'damaged', 'lost', 'correction', 'other',
                                                    'order', 'order_cancelled')),
  note             text check (char_length(note) <= 200),
  order_id         uuid references orders (id) on delete set null,
  actor_id         uuid,
  request_id       uuid unique,
  created_at       timestamptz not null default now()
);

create index if not exists stock_movements_product_idx on stock_movements (product_id, country_code, id desc);

alter table stock_movements enable row level security;
revoke all on stock_movements from public, anon, authenticated, service_role;

-- An order placed takes its units (place_cod_order of 0004 inserts each
-- line, then lowers the stock it has locked): recorded per line.
create or replace function stock_movements_order_line()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_country  char(2);
  v_before   integer;
begin
  select o.country_code into v_country from orders o where o.id = new.order_id;
  select s.available into v_before from stock_levels s where s.product_id = new.product_id and s.country_code = v_country;
  if v_before is not null then
    insert into stock_movements (product_id, country_code, change, available_after, reason, order_id)
    values (new.product_id, v_country, -new.quantity, greatest(v_before - new.quantity, 0), 'order', new.order_id);
  end if;
  return new;
end
$$;

drop trigger if exists stock_movements_order_line on order_lines;
create trigger stock_movements_order_line
  after insert on order_lines
  for each row execute function stock_movements_order_line();

-- A cancelled order gives its units back (admin_update_order_status of
-- 0006 puts the stock back, then changes the status): recorded per product.
create or replace function stock_movements_order_cancelled()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into stock_movements (product_id, country_code, change, available_after, reason, order_id)
  select r.product_id, new.country_code, r.quantity, s.available, 'order_cancelled', new.id
    from (select l.product_id, sum(l.quantity)::integer as quantity from order_lines l where l.order_id = new.id group by l.product_id) r
    join stock_levels s on s.product_id = r.product_id and s.country_code = new.country_code;
  return new;
end
$$;

drop trigger if exists stock_movements_order_cancelled on orders;
create trigger stock_movements_order_cancelled
  after update of status on orders
  for each row
  when (new.status = 'cancelled' and old.status is distinct from 'cancelled')
  execute function stock_movements_order_cancelled();

-- The stock of every product, for administrators, with how many are out
-- and low. p_filter: null (all), 'low' (1 to its own level) or 'out' (0, or
-- never stocked). Search on the name or SKU.
create or replace function admin_list_inventory(p_country char(2), p_search text, p_filter text, p_limit integer, p_offset integer)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with base as (
    select p.id, p.slug, p.sku, p.name, p.sequence,
           catalogue_product_status(p.active, p.published_at) as status,
           coalesce(s.available, 0) as available, coalesce(s.low_stock_at, 5) as low_stock_at,
           case when coalesce(s.available, 0) = 0 then 'out'
                when s.available <= coalesce(s.low_stock_at, 5) then 'low'
                else 'ok' end as level
      from products p
      left join stock_levels s on s.product_id = p.id and s.country_code = p_country
  ),
  found as (
    select * from base b
     where (p_filter is null or b.level = p_filter)
       and (nullif(btrim(coalesce(p_search, '')), '') is null
            or position(lower(btrim(p_search)) in lower(b.name)) > 0
            or position(upper(btrim(p_search)) in b.sku) > 0)
  )
  select jsonb_build_object(
    'total', (select count(*) from found),
    'counts', jsonb_build_object('all', (select count(*) from base),
                                 'low', (select count(*) from base where level = 'low'),
                                 'out', (select count(*) from base where level = 'out')),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
               'slug', f.slug, 'sku', f.sku, 'name', f.name, 'status', f.status,
               'available', f.available, 'low_stock_at', f.low_stock_at, 'level', f.level,
               'image', (select jsonb_build_object('id', i.id, 'url', i.url) from product_images i
                          where i.product_id = f.id order by i.sort_order, i.id limit 1),
               'last_change_at', (select max(m.created_at) from stock_movements m where m.product_id = f.id and m.country_code = p_country))
             order by case f.level when 'out' then 0 when 'low' then 1 else 2 end, f.available, f.name)
        from (select * from found
               order by case level when 'out' then 0 when 'low' then 1 else 2 end, available, name
               limit least(greatest(coalesce(p_limit, 25), 1), 100)
              offset greatest(coalesce(p_offset, 0), 0)) f), '[]'::jsonb))
$$;

-- One product's stock with its last 100 movements, or null.
create or replace function admin_get_inventory(p_country char(2), p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'slug', p.slug, 'sku', p.sku, 'name', p.name,
    'status', catalogue_product_status(p.active, p.published_at),
    'available', coalesce(s.available, 0), 'low_stock_at', coalesce(s.low_stock_at, 5),
    'image', (select jsonb_build_object('id', i.id, 'url', i.url) from product_images i
               where i.product_id = p.id order by i.sort_order, i.id limit 1),
    'movements', coalesce((
      select jsonb_agg(jsonb_build_object('change', m.change, 'available_after', m.available_after, 'reason', m.reason,
                                          'note', m.note, 'actor_id', m.actor_id, 'created_at', m.created_at,
                                          'order_number', (select o.order_number from orders o where o.id = m.order_id))
                       order by m.id desc)
        from (select * from stock_movements m where m.product_id = p.id and m.country_code = p_country order by m.id desc limit 100) m), '[]'::jsonb))
    from products p
    left join stock_levels s on s.product_id = p.id and s.country_code = p_country
   where p.slug = lower(btrim(p_slug))
$$;

-- Adds units (p_mode 'add': received, returned, correction, other), removes
-- them ('remove': damaged, lost, correction, other) or sets a counted total
-- ('set': correction). Returns
--   {"ok": true, "replayed": bool, "available", "change"}
--   {"ok": false, "code": "invalid_request" | "not_found" | "not_enough" | "no_change", "available"?}
create or replace function admin_adjust_stock(p_country char(2), p_slug text, p_mode text, p_quantity integer, p_reason text,
                                              p_note text, p_actor uuid, p_request uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_note     text := nullif(btrim(coalesce(p_note, '')), '');
  v_move     stock_movements%rowtype;
  v_product  uuid;
  v_before   integer;
  v_after    integer;
begin
  if p_actor is null or p_request is null or p_quantity is null or char_length(coalesce(v_note, '')) > 200
     or not ((p_mode = 'add' and p_reason in ('received', 'returned', 'correction', 'other') and p_quantity between 1 and 100000)
          or (p_mode = 'remove' and p_reason in ('damaged', 'lost', 'correction', 'other') and p_quantity between 1 and 100000)
          or (p_mode = 'set' and p_reason = 'correction' and p_quantity between 0 and 100000))
     or (p_reason = 'other' and v_note is null) then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;

  -- The same request again: answer as the first time.
  select * into v_move from stock_movements m where m.request_id = p_request;
  if found then
    return jsonb_build_object('ok', true, 'replayed', true, 'available', v_move.available_after, 'change', v_move.change);
  end if;

  select p.id into v_product from products p where p.slug = lower(btrim(p_slug));
  if v_product is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  insert into stock_levels (product_id, country_code, available) values (v_product, p_country, 0)
  on conflict (product_id, country_code) do nothing;
  select s.available into v_before from stock_levels s where s.product_id = v_product and s.country_code = p_country for update;

  v_after := case p_mode when 'add' then v_before + p_quantity when 'remove' then v_before - p_quantity else p_quantity end;
  if v_after < 0 then
    return jsonb_build_object('ok', false, 'code', 'not_enough', 'available', v_before);
  end if;
  if v_after > 100000 then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  if v_after = v_before then
    return jsonb_build_object('ok', false, 'code', 'no_change', 'available', v_before);
  end if;

  -- The trigger of 0004 keeps the storefront's in_stock in step.
  update stock_levels set available = v_after, updated_at = now() where product_id = v_product and country_code = p_country;
  insert into stock_movements (product_id, country_code, change, available_after, reason, note, actor_id, request_id)
  values (v_product, p_country, v_after - v_before, v_after, p_reason, v_note, p_actor, p_request);
  return jsonb_build_object('ok', true, 'replayed', false, 'available', v_after, 'change', v_after - v_before);
end
$$;

-- A product's own low-stock level. Returns {"ok": true, "low_stock_at"} or
-- {"ok": false, "code": "invalid_request" | "not_found"}. Setting it twice is harmless.
create or replace function admin_set_low_stock(p_country char(2), p_slug text, p_level integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product  uuid;
begin
  if p_level is null or p_level not between 0 and 100000 then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  select p.id into v_product from products p where p.slug = lower(btrim(p_slug));
  if v_product is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  insert into stock_levels (product_id, country_code, available, low_stock_at) values (v_product, p_country, 0, p_level)
  on conflict (product_id, country_code) do update set low_stock_at = excluded.low_stock_at, updated_at = now();
  return jsonb_build_object('ok', true, 'low_stock_at', p_level);
end
$$;

-- As in 0016, and the change goes into the stock history as a correction.
create or replace function admin_set_product_stock(p_country char(2), p_slug text, p_available integer, p_actor uuid, p_request uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_change   catalogue_changes%rowtype;
  v_product  uuid;
  v_before   integer;
begin
  if p_actor is null or p_request is null or p_available is null or p_available not between 0 and 100000 then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  select * into v_change from catalogue_changes c where c.request_id = p_request;
  if found then
    if v_change.action <> 'product.stock' then
      return jsonb_build_object('ok', false, 'code', 'invalid_request');
    end if;
    return jsonb_build_object('ok', true, 'replayed', true, 'available', (v_change.detail ->> 'to')::integer);
  end if;

  select p.id into v_product from products p where p.slug = lower(btrim(p_slug)) for update;
  if v_product is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  select s.available into v_before from stock_levels s where s.product_id = v_product and s.country_code = p_country for update;
  insert into stock_levels (product_id, country_code, available) values (v_product, p_country, p_available)
  on conflict (product_id, country_code) do update set available = excluded.available, updated_at = now();
  if p_available <> coalesce(v_before, 0) then
    insert into stock_movements (product_id, country_code, change, available_after, reason, actor_id)
    values (v_product, p_country, p_available - coalesce(v_before, 0), p_available, 'correction', p_actor);
  end if;
  insert into catalogue_changes (product_id, action, detail, actor_id, request_id)
  values (v_product, 'product.stock', jsonb_build_object('from', v_before, 'to', p_available), p_actor, p_request);
  return jsonb_build_object('ok', true, 'replayed', false, 'available', p_available);
end
$$;

-- As in 0009, with each product's own low-stock level.
create or replace function admin_country_summary(p_country char(2), p_low_stock integer)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with scope as (
    select o.* from orders o where o.country_code = p_country
  ),
  today as (
    select (now() at time zone 'Africa/Dar_es_Salaam')::date as day
  ),
  priced as (
    select p.id
      from products p
      join product_country_prices pcp on pcp.product_id = p.id and pcp.country_code = p_country and pcp.active
     where p.active
  )
  select jsonb_build_object(
    'currency', (select c.currency from countries c where c.code = p_country),
    'currency_exponent', (select cur.exponent from countries c join currencies cur on cur.code = c.currency where c.code = p_country),
    'orders_total', (select count(*) from scope),
    'orders_today', (select count(*) from scope s, today t where (s.created_at at time zone 'Africa/Dar_es_Salaam')::date = t.day),
    'orders_open', (select count(*) from scope s where s.status not in ('delivered', 'cancelled')),
    'orders_by_status', coalesce((select jsonb_object_agg(c.status, c.n) from (select status, count(*) as n from scope group by status) c), '{}'::jsonb),
    'sales_30_days_minor', (select coalesce(sum(s.total_minor), 0) from scope s
                             where s.payment_status = 'paid' and s.created_at >= now() - interval '30 days'),
    'customer_accounts', (select count(*) from auth.users),
    'products_active', (select count(*) from priced),
    'products_out_of_stock', (select count(*) from priced p join stock_levels sl on sl.product_id = p.id and sl.country_code = p_country
                               where sl.available = 0),
    'products_low_stock', (select count(*) from priced p join stock_levels sl on sl.product_id = p.id and sl.country_code = p_country
                            where sl.available between 1 and sl.low_stock_at),
    'low_stock_threshold', greatest(coalesce(p_low_stock, 5), 1))
$$;

revoke execute on function stock_movements_order_line() from public, anon, authenticated;
revoke execute on function stock_movements_order_cancelled() from public, anon, authenticated;
revoke execute on function admin_list_inventory(char, text, text, integer, integer) from public, anon, authenticated;
revoke execute on function admin_get_inventory(char, text) from public, anon, authenticated;
revoke execute on function admin_adjust_stock(char, text, text, integer, text, text, uuid, uuid) from public, anon, authenticated;
revoke execute on function admin_set_low_stock(char, text, integer) from public, anon, authenticated;
revoke execute on function admin_set_product_stock(char, text, integer, uuid, uuid) from public, anon, authenticated;
revoke execute on function admin_country_summary(char, integer) from public, anon, authenticated;

grant execute on function admin_list_inventory(char, text, text, integer, integer) to service_role;
grant execute on function admin_get_inventory(char, text) to service_role;
grant execute on function admin_adjust_stock(char, text, text, integer, text, text, uuid, uuid) to service_role;
grant execute on function admin_set_low_stock(char, text, integer) to service_role;
grant execute on function admin_set_product_stock(char, text, integer, uuid, uuid) to service_role;
grant execute on function admin_country_summary(char, integer) to service_role;

commit;
