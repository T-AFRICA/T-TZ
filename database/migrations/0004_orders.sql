-- 0004_orders.sql — stock, customer profiles and Cash on Delivery orders (DRAFT).
--
-- Forward-only, additive. Exercised only against a disposable PGlite
-- database with a Supabase role shim (database/client/tests); applying it to
-- the Supabase project needs owner approval. Requires Supabase Auth
-- (auth.users, auth.uid()).
--
-- Rules (rulesd §4, review 2026-11-11):
--   * The browser never sends a price. place_cod_order() reprices every line
--     from the catalogue, checks options and stock, reserves stock and writes
--     the order and its lines in one transaction.
--   * An idempotency key makes retries safe: the same key returns the same
--     order; the same key with a different request is refused.
--   * A customer reads only their own orders (RLS on auth.uid()); guests
--     look an order up by number plus the email or phone used at checkout.
--   * Money columns are integers in ISO 4217 minor units (see 0003).

begin;

-- ------------------------------------------------------------------ stock --

-- Units available to sell per product and country. Private: no role but the
-- owner reads it; the storefront sees only product_country_prices.in_stock,
-- which a trigger keeps in step.
create table if not exists stock_levels (
  product_id    uuid not null references products (id) on delete cascade,
  country_code  char(2) not null references countries (code),
  available     integer not null check (available >= 0),
  updated_at    timestamptz not null default now(),
  primary key (product_id, country_code)
);

create or replace function stock_levels_sync_in_stock()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  update product_country_prices
     set in_stock = new.available > 0, updated_at = now()
   where product_id = new.product_id and country_code = new.country_code
     and in_stock is distinct from (new.available > 0);
  return new;
end
$$;

drop trigger if exists stock_levels_sync on stock_levels;
create trigger stock_levels_sync
  after insert or update of available on stock_levels
  for each row execute function stock_levels_sync_in_stock();

-- -------------------------------------------------------------- customers --

create table if not exists customer_profiles (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  full_name   text check (full_name is null or char_length(full_name) between 2 and 80),
  phone       text check (phone is null or phone ~ '^\+[0-9]{9,15}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------- orders --

create table if not exists orders (
  id                  uuid primary key default gen_random_uuid(),
  order_number        text not null unique,
  user_id             uuid references auth.users (id) on delete set null,   -- null for guest checkout
  idempotency_key     uuid not null unique,
  request_hash        text not null,
  country_code        char(2) not null references countries (code),
  currency            char(3) not null references currencies (code),
  status              text not null default 'pending_payment'
                        check (status in ('pending_payment', 'confirmed', 'processing', 'packed',
                                          'dispatched', 'in_transit', 'delivered', 'cancelled')),
  payment_method      text not null check (payment_method in ('pay_on_delivery')),
  payment_status      text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  contact_name        text not null,
  contact_email       text not null,
  contact_phone       text not null,
  delivery_method     text not null check (delivery_method in ('home', 'pickup')),
  delivery_region     text,
  delivery_district   text,
  delivery_ward       text,
  delivery_street     text,
  delivery_extra      text,
  delivery_notes      text,
  subtotal_minor      bigint not null check (subtotal_minor >= 0),
  delivery_fee_minor  bigint check (delivery_fee_minor is null or delivery_fee_minor >= 0),
  total_minor         bigint not null check (total_minor >= 0),
  created_at          timestamptz not null default now()
);

create index if not exists orders_user_idx on orders (user_id, created_at desc) where user_id is not null;

create table if not exists order_lines (
  order_id          uuid not null references orders (id) on delete cascade,
  line_no           smallint not null,
  product_id        uuid not null references products (id),
  product_slug      text not null,
  sku               text not null,
  name              text not null,
  color             text,
  variant           text,
  quantity          integer not null check (quantity between 1 and 99),
  unit_price_minor  bigint not null check (unit_price_minor >= 0),
  line_total_minor  bigint not null check (line_total_minor >= 0),
  primary key (order_id, line_no)
);

-- ------------------------------------------------------------------- RLS --

alter table stock_levels       enable row level security;
alter table customer_profiles  enable row level security;
alter table orders             enable row level security;
alter table order_lines        enable row level security;

create policy customer_profiles_own_read on customer_profiles
  for select to authenticated using (user_id = auth.uid());
create policy customer_profiles_own_insert on customer_profiles
  for insert to authenticated with check (user_id = auth.uid());
create policy customer_profiles_own_update on customer_profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy orders_own_read on orders
  for select to authenticated using (user_id is not null and user_id = auth.uid());

create policy order_lines_own_read on order_lines
  for select to authenticated
  using (exists (select 1 from orders o where o.id = order_lines.order_id));

-- stock_levels: no policy, no grant.

revoke all on stock_levels, customer_profiles, orders, order_lines from anon, authenticated;
grant select, insert, update on customer_profiles to authenticated;
grant select on orders, order_lines to authenticated;
revoke execute on function stock_levels_sync_in_stock() from public, anon, authenticated;

-- -------------------------------------------------------- place an order --

-- Places a Cash on Delivery order. Arguments are untrusted request data:
--   p_country      deployment country (set by the server, re-checked here)
--   p_contact      {"name", "email", "phone"} (phone in +<country><number>)
--   p_delivery     {"method", "region", "district", "ward", "street", "extra", "notes"}
--   p_lines        [{"product": slug, "color": text|null, "variant": text|null, "quantity": 1..99}]
--   p_expected_total_minor  the total the customer saw, or null
-- Returns jsonb:
--   {"ok": true, "replayed": bool, "order_number", "subtotal_minor", "total_minor", "currency", "item_count"}
--   {"ok": false, "code": "invalid_request" | "idempotency_conflict" | "lines_unavailable"
--                         | "price_changed", ...details}
-- Nothing is written unless the result is ok.
create or replace function place_cod_order(
  p_idempotency_key        uuid,
  p_country                char(2),
  p_contact                jsonb,
  p_delivery               jsonb,
  p_lines                  jsonb,
  p_expected_total_minor   bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user        uuid := auth.uid();
  v_hash        text;
  v_existing    orders%rowtype;
  v_currency    char(3);
  v_line        jsonb;
  v_qty         integer;
  v_color       text;
  v_variant     text;
  v_product     record;
  v_available   integer;
  v_problems    jsonb := '[]'::jsonb;
  v_items       jsonb := '[]'::jsonb;
  v_subtotal    bigint := 0;
  v_count       integer := 0;
  v_order_id    uuid;
  v_number      text;
  v_name        text := btrim(coalesce(p_contact ->> 'name', ''));
  v_email       text := lower(btrim(coalesce(p_contact ->> 'email', '')));
  v_phone       text := btrim(coalesce(p_contact ->> 'phone', ''));
  v_method      text := coalesce(p_delivery ->> 'method', '');
  v_region      text := btrim(coalesce(p_delivery ->> 'region', ''));
  v_district    text := btrim(coalesce(p_delivery ->> 'district', ''));
  v_ward        text := btrim(coalesce(p_delivery ->> 'ward', ''));
  v_street      text := btrim(coalesce(p_delivery ->> 'street', ''));
  v_extra       text := nullif(btrim(coalesce(p_delivery ->> 'extra', '')), '');
  v_notes       text := nullif(btrim(coalesce(p_delivery ->> 'notes', '')), '');
  i             integer := 0;
begin
  -- 1. Shape of the request. Same limits as features/checkout/validation.ts.
  if p_idempotency_key is null
     or jsonb_typeof(p_contact) is distinct from 'object'
     or jsonb_typeof(p_delivery) is distinct from 'object'
     or jsonb_typeof(p_lines) is distinct from 'array'
     or jsonb_array_length(p_lines) not between 1 and 50
     or char_length(v_name) not between 2 and 80
     or char_length(v_email) not between 3 and 254
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$'
     or v_phone !~ '^\+[0-9]{9,15}$'
     or v_method <> 'home'
     or char_length(v_region) not between 2 and 60
     or char_length(v_district) not between 2 and 60
     or char_length(v_ward) not between 2 and 60
     or char_length(v_street) not between 3 and 120
     or char_length(coalesce(v_extra, '')) > 120
     or char_length(coalesce(v_notes, '')) > 300
     or (p_expected_total_minor is not null and p_expected_total_minor < 0)
  then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;

  select c.currency into v_currency from countries c where c.code = p_country and c.active;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;

  -- 2. Idempotency: one request per key, serialised on the key.
  v_hash := encode(sha256(convert_to(jsonb_build_array(p_country, p_contact, p_delivery, p_lines)::text, 'UTF8')), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));
  select * into v_existing from orders o where o.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> v_hash or v_existing.user_id is distinct from v_user then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    return jsonb_build_object(
      'ok', true, 'replayed', true, 'order_number', v_existing.order_number,
      'subtotal_minor', v_existing.subtotal_minor, 'total_minor', v_existing.total_minor,
      'currency', v_existing.currency,
      'item_count', (select coalesce(sum(l.quantity), 0) from order_lines l where l.order_id = v_existing.id));
  end if;

  -- 3. Lock the stock rows of every requested product, in a fixed order so
  --    concurrent orders cannot deadlock.
  perform 1
     from stock_levels s
     join products p on p.id = s.product_id
    where s.country_code = p_country
      and p.slug in (select e ->> 'product' from jsonb_array_elements(p_lines) e)
    order by s.product_id
      for update of s;

  -- 4. Reprice and check every line against the live catalogue.
  for v_line in select e from jsonb_array_elements(p_lines) e loop
    if jsonb_typeof(v_line) is distinct from 'object'
       or jsonb_typeof(v_line -> 'quantity') is distinct from 'number'
       or (v_line ->> 'quantity') !~ '^[0-9]{1,2}$'
       or (v_line ->> 'quantity')::integer not between 1 and 99
       or jsonb_typeof(v_line -> 'product') is distinct from 'string'
       or (v_line ? 'color' and jsonb_typeof(v_line -> 'color') not in ('string', 'null'))
       or (v_line ? 'variant' and jsonb_typeof(v_line -> 'variant') not in ('string', 'null'))
    then
      return jsonb_build_object('ok', false, 'code', 'invalid_request');
    end if;
    v_qty := (v_line ->> 'quantity')::integer;
    v_color := v_line ->> 'color';
    v_variant := v_line ->> 'variant';

    -- The same product and options twice is a malformed cart.
    if (select count(*) from jsonb_array_elements(p_lines) o
         where o ->> 'product' = v_line ->> 'product'
           and (o ->> 'color') is not distinct from v_color
           and (o ->> 'variant') is not distinct from v_variant) > 1 then
      return jsonb_build_object('ok', false, 'code', 'invalid_request');
    end if;

    select p.id, p.slug, p.sku, p.name, pcp.price_minor
      into v_product
      from products p
      join categories c on c.id = p.category_id and c.active
      join product_country_prices pcp on pcp.product_id = p.id and pcp.country_code = p_country and pcp.active
     where p.slug = v_line ->> 'product' and p.active;

    if not found then
      v_problems := v_problems || jsonb_build_object('product', v_line ->> 'product', 'issue', 'unavailable');
      continue;
    end if;

    if (exists (select 1 from product_colors pc where pc.product_id = v_product.id)
          and not exists (select 1 from product_colors pc where pc.product_id = v_product.id and pc.name = v_color))
       or (not exists (select 1 from product_colors pc where pc.product_id = v_product.id) and v_color is not null)
       or (exists (select 1 from product_variants pv where pv.product_id = v_product.id)
          and not exists (select 1 from product_variants pv where pv.product_id = v_product.id and pv.name = v_variant))
       or (not exists (select 1 from product_variants pv where pv.product_id = v_product.id) and v_variant is not null)
    then
      v_problems := v_problems || jsonb_build_object('product', v_product.slug, 'issue', 'invalid_options');
      continue;
    end if;

    -- Stock for this line, minus what earlier lines of this order take.
    select s.available - coalesce((
             select sum((it ->> 'quantity')::integer)
               from jsonb_array_elements(v_items) it
              where (it ->> 'product_id')::uuid = v_product.id), 0)
      into v_available
      from stock_levels s
     where s.product_id = v_product.id and s.country_code = p_country;

    if v_available is null or v_available < v_qty then
      v_problems := v_problems || jsonb_build_object(
        'product', v_product.slug, 'issue', 'out_of_stock', 'available', greatest(coalesce(v_available, 0), 0));
      continue;
    end if;

    v_items := v_items || jsonb_build_object(
      'product_id', v_product.id, 'slug', v_product.slug, 'sku', v_product.sku, 'name', v_product.name,
      'color', v_color, 'variant', v_variant, 'quantity', v_qty, 'unit_price_minor', v_product.price_minor);
    v_subtotal := v_subtotal + v_product.price_minor * v_qty;
    v_count := v_count + v_qty;
  end loop;

  if jsonb_array_length(v_problems) > 0 then
    return jsonb_build_object('ok', false, 'code', 'lines_unavailable', 'problems', v_problems);
  end if;

  -- 5. The customer confirms the price they saw. Delivery fees are not set
  --    yet (confirmed before payment), so the total is the subtotal.
  if p_expected_total_minor is not null and p_expected_total_minor <> v_subtotal then
    return jsonb_build_object('ok', false, 'code', 'price_changed', 'total_minor', v_subtotal, 'currency', v_currency);
  end if;

  -- 6. Write the order, its lines and the stock reservation.
  loop
    v_number := p_country || '-' || to_char(now() at time zone 'Africa/Dar_es_Salaam', 'YYMMDD') || '-'
                || upper(substr(md5(gen_random_uuid()::text), 1, 8));
    exit when not exists (select 1 from orders o where o.order_number = v_number);
  end loop;

  insert into orders (
    order_number, user_id, idempotency_key, request_hash, country_code, currency,
    payment_method, contact_name, contact_email, contact_phone,
    delivery_method, delivery_region, delivery_district, delivery_ward, delivery_street,
    delivery_extra, delivery_notes, subtotal_minor, delivery_fee_minor, total_minor)
  values (
    v_number, v_user, p_idempotency_key, v_hash, p_country, v_currency,
    'pay_on_delivery', v_name, v_email, v_phone,
    v_method, v_region, v_district, v_ward, v_street,
    v_extra, v_notes, v_subtotal, null, v_subtotal)
  returning id into v_order_id;

  for v_line in select e from jsonb_array_elements(v_items) e loop
    i := i + 1;
    insert into order_lines (
      order_id, line_no, product_id, product_slug, sku, name, color, variant,
      quantity, unit_price_minor, line_total_minor)
    values (
      v_order_id, i, (v_line ->> 'product_id')::uuid, v_line ->> 'slug', v_line ->> 'sku', v_line ->> 'name',
      v_line ->> 'color', v_line ->> 'variant', (v_line ->> 'quantity')::integer,
      (v_line ->> 'unit_price_minor')::bigint,
      (v_line ->> 'unit_price_minor')::bigint * (v_line ->> 'quantity')::integer);

    update stock_levels
       set available = available - (v_line ->> 'quantity')::integer, updated_at = now()
     where product_id = (v_line ->> 'product_id')::uuid and country_code = p_country;
  end loop;

  return jsonb_build_object(
    'ok', true, 'replayed', false, 'order_number', v_number,
    'subtotal_minor', v_subtotal, 'total_minor', v_subtotal, 'currency', v_currency, 'item_count', v_count);
end
$$;

-- --------------------------------------------------------- track an order --

-- Guest lookup: the order number plus the email or phone used at checkout.
-- A wrong pair and an unknown number give the same answer.
create or replace function track_order(p_order_number text, p_contact text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select jsonb_build_object(
              'found', true, 'order_number', o.order_number, 'status', o.status,
              'payment_status', o.payment_status, 'created_at', o.created_at,
              'total_minor', o.total_minor, 'currency', o.currency,
              'item_count', (select coalesce(sum(l.quantity), 0) from order_lines l where l.order_id = o.id))
       from orders o
      where o.order_number = upper(btrim(p_order_number))
        and (o.contact_email = lower(btrim(p_contact)) or o.contact_phone = btrim(p_contact))),
    jsonb_build_object('found', false))
$$;

revoke execute on function place_cod_order(uuid, char, jsonb, jsonb, jsonb, bigint) from public;
revoke execute on function track_order(text, text) from public;
grant execute on function place_cod_order(uuid, char, jsonb, jsonb, jsonb, bigint) to anon, authenticated;
grant execute on function track_order(text, text) to anon, authenticated;

commit;
