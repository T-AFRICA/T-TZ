-- 0006_order_admin.sql — order administration for the Central Admin (DRAFT).
--
-- Forward-only, additive. Exercised only against a disposable PGlite
-- database with a Supabase role shim (database/client/tests); applying it
-- to a Supabase project needs owner approval. Requires 0004.
--
-- Until now an order could be read only by the customer who placed it and
-- changed by nobody but the database owner. This adds the administrative
-- side that the country's backend serves to the Central Admin
-- (/api/admin/v1/orders): list, detail, status changes, internal notes.
--
-- Rules:
--   * Customers and visitors get nothing new: the tables below have no
--     grants and no policies for anon or authenticated, and the functions
--     are executable by service_role only. The storefront's server switches
--     to that role for a request it has already verified (a signed request
--     from the Central Admin, for this country, with the right permission).
--   * Every function takes the deployment's country and works on that
--     country's orders only.
--   * A status moves one step forward at a time:
--       pending_payment -> confirmed -> processing -> packed -> dispatched
--       -> in_transit -> delivered
--     An order can be cancelled until it is dispatched. Cancelling puts the
--     reserved stock back. A Cash on Delivery order is paid when delivered.
--   * Each change is recorded with the administrator who made it and the
--     request it came from; the same request applied twice changes nothing
--     the second time.

begin;

-- Who moved an order from which status to which, and when. The actor is
-- the administrator's id in the Central Admin; it is not a user of this
-- database, so there is no foreign key.
create table if not exists order_status_events (
  id           bigint generated always as identity primary key,
  order_id     uuid not null references orders (id) on delete cascade,
  from_status  text not null,
  to_status    text not null,
  note         text check (char_length(note) <= 300),
  actor_id     uuid not null,
  request_id   uuid not null unique,
  created_at   timestamptz not null default now()
);

create index if not exists order_status_events_order_idx on order_status_events (order_id, id);

-- Internal notes: seen by administrators only, never by the customer.
create table if not exists order_notes (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references orders (id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 1000),
  actor_id    uuid not null,
  request_id  uuid not null unique,
  created_at  timestamptz not null default now()
);

create index if not exists order_notes_order_idx on order_notes (order_id, id);
create index if not exists orders_country_created_idx on orders (country_code, created_at desc);

alter table order_status_events enable row level security;
alter table order_notes         enable row level security;
revoke all on order_status_events, order_notes from public, anon, authenticated, service_role;

-- The statuses an order may move to from `p_status`, in the order an
-- administrator would choose them.
create or replace function order_next_statuses(p_status text)
returns text[]
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_status
    when 'pending_payment' then array['confirmed', 'cancelled']
    when 'confirmed'       then array['processing', 'cancelled']
    when 'processing'      then array['packed', 'cancelled']
    when 'packed'          then array['dispatched', 'cancelled']
    when 'dispatched'      then array['in_transit']
    when 'in_transit'      then array['delivered']
    else array[]::text[]
  end
$$;

-- A page of the country's orders, newest first, with the number of orders
-- in each status. `p_status` narrows to one status; `p_search` matches the
-- order number, the contact name, email or phone (as typed, no wildcards).
create or replace function admin_list_orders(p_country char(2), p_status text, p_search text, p_limit integer, p_offset integer)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with scope as (
    select o.*
      from orders o
     where o.country_code = p_country
  ),
  found as (
    select s.*
      from scope s
     where (p_status is null or s.status = p_status)
       and (nullif(btrim(coalesce(p_search, '')), '') is null
            or s.order_number = upper(btrim(p_search))
            or position(lower(btrim(p_search)) in lower(s.contact_name)) > 0
            or s.contact_email = lower(btrim(p_search))
            or s.contact_phone = btrim(p_search))
  )
  select jsonb_build_object(
    'total', (select count(*) from found),
    'counts', coalesce((select jsonb_object_agg(c.status, c.n) from (select status, count(*) as n from scope group by status) c), '{}'::jsonb),
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object(
               'order_number', p.order_number, 'created_at', p.created_at, 'status', p.status,
               'payment_status', p.payment_status, 'contact_name', p.contact_name,
               'delivery_region', p.delivery_region, 'total_minor', p.total_minor, 'currency', p.currency,
               'currency_exponent', (select c.exponent from currencies c where c.code = p.currency),
               'item_count', (select coalesce(sum(l.quantity), 0) from order_lines l where l.order_id = p.id))
             order by p.created_at desc, p.order_number)
        from (select * from found f
               order by f.created_at desc, f.order_number
               limit least(greatest(coalesce(p_limit, 25), 1), 100)
              offset greatest(coalesce(p_offset, 0), 0)) p), '[]'::jsonb))
$$;

-- One order of the country in full, or null: contact, delivery, lines,
-- status history, internal notes and the statuses it may move to next.
create or replace function admin_get_order(p_country char(2), p_order_number text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'order_number', o.order_number, 'created_at', o.created_at, 'status', o.status,
    'payment_status', o.payment_status, 'payment_method', o.payment_method,
    'registered_customer', o.user_id is not null,
    'contact', jsonb_build_object('name', o.contact_name, 'email', o.contact_email, 'phone', o.contact_phone),
    'delivery', jsonb_build_object('method', o.delivery_method, 'region', o.delivery_region, 'district', o.delivery_district,
                                   'ward', o.delivery_ward, 'street', o.delivery_street, 'extra', o.delivery_extra,
                                   'notes', o.delivery_notes),
    'currency', o.currency,
    'currency_exponent', (select c.exponent from currencies c where c.code = o.currency),
    'subtotal_minor', o.subtotal_minor, 'delivery_fee_minor', o.delivery_fee_minor, 'total_minor', o.total_minor,
    'next_statuses', to_jsonb(order_next_statuses(o.status)),
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object('line_no', l.line_no, 'sku', l.sku, 'name', l.name, 'color', l.color,
                                          'variant', l.variant, 'quantity', l.quantity,
                                          'unit_price_minor', l.unit_price_minor, 'line_total_minor', l.line_total_minor)
                       order by l.line_no)
        from order_lines l where l.order_id = o.id), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object('from_status', e.from_status, 'to_status', e.to_status, 'note', e.note,
                                          'actor_id', e.actor_id, 'created_at', e.created_at)
                       order by e.id)
        from order_status_events e where e.order_id = o.id), '[]'::jsonb),
    'notes', coalesce((
      select jsonb_agg(jsonb_build_object('body', n.body, 'actor_id', n.actor_id, 'created_at', n.created_at) order by n.id)
        from order_notes n where n.order_id = o.id), '[]'::jsonb))
    from orders o
   where o.country_code = p_country and o.order_number = upper(btrim(p_order_number))
$$;

-- Moves an order to `p_to`. Returns
--   {"ok": true, "replayed": bool, "from": status, "status": status, "payment_status": status}
--   {"ok": false, "code": "invalid_request" | "not_found"}
--   {"ok": false, "code": "invalid_transition", "status": current, "next_statuses": [...]}
-- Nothing is written unless the result is ok.
create or replace function admin_update_order_status(
  p_country       char(2),
  p_order_number  text,
  p_to            text,
  p_note          text,
  p_actor         uuid,
  p_request       uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order  orders%rowtype;
  v_event  order_status_events%rowtype;
  v_note   text := nullif(btrim(coalesce(p_note, '')), '');
  v_paid   text;
begin
  if p_actor is null or p_request is null or p_to is null or char_length(coalesce(v_note, '')) > 300 then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;

  select * into v_order from orders o
   where o.country_code = p_country and o.order_number = upper(btrim(p_order_number))
     for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  -- The same request again: answer as the first time, change nothing.
  select * into v_event from order_status_events e where e.request_id = p_request;
  if found then
    if v_event.order_id <> v_order.id or v_event.to_status <> p_to then
      return jsonb_build_object('ok', false, 'code', 'invalid_request');
    end if;
    return jsonb_build_object('ok', true, 'replayed', true, 'from', v_event.from_status,
                              'status', v_order.status, 'payment_status', v_order.payment_status);
  end if;

  if not (p_to = any (order_next_statuses(v_order.status))) then
    return jsonb_build_object('ok', false, 'code', 'invalid_transition', 'status', v_order.status,
                              'next_statuses', to_jsonb(order_next_statuses(v_order.status)));
  end if;

  if p_to = 'cancelled' then
    -- Put back what the order reserved when it was placed (0004).
    update stock_levels s
       set available = s.available + r.quantity, updated_at = now()
      from (select l.product_id, sum(l.quantity)::integer as quantity
              from order_lines l where l.order_id = v_order.id
             group by l.product_id) r
     where s.product_id = r.product_id and s.country_code = v_order.country_code;
  end if;

  v_paid := case
    when p_to = 'delivered' and v_order.payment_method = 'pay_on_delivery' and v_order.payment_status = 'pending' then 'paid'
    else v_order.payment_status
  end;

  update orders set status = p_to, payment_status = v_paid where id = v_order.id;
  insert into order_status_events (order_id, from_status, to_status, note, actor_id, request_id)
  values (v_order.id, v_order.status, p_to, v_note, p_actor, p_request);

  return jsonb_build_object('ok', true, 'replayed', false, 'from', v_order.status, 'status', p_to, 'payment_status', v_paid);
end
$$;

-- Adds an internal note to an order. Returns {"ok": true, "replayed": bool}
-- or {"ok": false, "code": "invalid_request" | "not_found"}.
create or replace function admin_add_order_note(p_country char(2), p_order_number text, p_body text, p_actor uuid, p_request uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order  uuid;
  v_body   text := btrim(coalesce(p_body, ''));
begin
  if p_actor is null or p_request is null or char_length(v_body) not between 1 and 1000 then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  select o.id into v_order from orders o
   where o.country_code = p_country and o.order_number = upper(btrim(p_order_number));
  if v_order is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if exists (select 1 from order_notes n where n.request_id = p_request) then
    return jsonb_build_object('ok', true, 'replayed', true);
  end if;
  insert into order_notes (order_id, body, actor_id, request_id) values (v_order, v_body, p_actor, p_request);
  return jsonb_build_object('ok', true, 'replayed', false);
end
$$;

revoke execute on function order_next_statuses(text) from public, anon, authenticated;
revoke execute on function admin_list_orders(char, text, text, integer, integer) from public, anon, authenticated;
revoke execute on function admin_get_order(char, text) from public, anon, authenticated;
revoke execute on function admin_update_order_status(char, text, text, text, uuid, uuid) from public, anon, authenticated;
revoke execute on function admin_add_order_note(char, text, text, uuid, uuid) from public, anon, authenticated;

grant execute on function admin_list_orders(char, text, text, integer, integer) to service_role;
grant execute on function admin_get_order(char, text) to service_role;
grant execute on function admin_update_order_status(char, text, text, text, uuid, uuid) to service_role;
grant execute on function admin_add_order_note(char, text, text, uuid, uuid) to service_role;

commit;
