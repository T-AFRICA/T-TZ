-- 0013_delivery_point.sql — the customer's delivery point, and no rider email on the tracking page (DRAFT).
--
-- Forward-only, additive. Exercised only against a disposable PGlite
-- database with a Supabase role shim (database/client/tests); applying it
-- to a Supabase project needs owner approval. Requires 0012. Safe to run
-- again.
--
-- Owner report and decisions 2026-11-19:
--   * The tracking page showed a rider's email address: an order given to a
--     rider without a name carried the email as the rider's name. The
--     customer now gets a first name only when it is not an email address,
--     and never anything with an "@" in it.
--   * Arrival time and distance: the customer shares their phone's location
--     for the order (no outside service gets the address). The rider sees
--     that point for directions while the order is theirs.
--
-- Rules:
--   * Only the signed-in owner of an order sets its point, only before it
--     is delivered or cancelled; a new point replaces the old one. Removed
--     once the order is finished and its last change is 7 days old.
--   * The customer reads their own point back; the rider reads it for an
--     order given to them, until it is delivered or cancelled.

begin;

create table if not exists order_delivery_points (
  order_id    uuid primary key references orders (id) on delete cascade,
  lat         numeric(9, 6) not null check (lat between -90 and 90),
  lng         numeric(9, 6) not null check (lng between -180 and 180),
  accuracy_m  integer check (accuracy_m is null or accuracy_m between 0 and 100000),
  set_at      timestamptz not null default now()
);

alter table order_delivery_points enable row level security;
revoke all on order_delivery_points from public, anon, authenticated, service_role;

-- The signed-in customer sets where their order should go. Returns
--   {"ok": true} or {"ok": false, "code": "invalid_request" | "not_found" | "finished"}.
create or replace function customer_set_delivery_point(p_order_number text, p_lat numeric, p_lng numeric, p_accuracy integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order orders%rowtype;
begin
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180
     or (p_accuracy is not null and p_accuracy not between 0 and 100000) then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  select o.* into v_order from orders o
   where o.order_number = upper(btrim(p_order_number)) and auth.uid() is not null and o.user_id = auth.uid();
  if v_order.id is null or v_order.delivery_method <> 'home' then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_order.status in ('delivered', 'cancelled') then
    return jsonb_build_object('ok', false, 'code', 'finished');
  end if;
  insert into order_delivery_points (order_id, lat, lng, accuracy_m)
  values (v_order.id, round(p_lat, 6), round(p_lng, 6), p_accuracy)
  on conflict (order_id) do update set lat = excluded.lat, lng = excluded.lng, accuracy_m = excluded.accuracy_m, set_at = now();
  -- Points of orders finished a week ago are not needed any more.
  delete from order_delivery_points p using orders o
   where o.id = p.order_id and o.status in ('delivered', 'cancelled')
     and not exists (select 1 from order_status_events e where e.order_id = o.id and e.created_at > now() - interval '7 days');
  return jsonb_build_object('ok', true);
end
$$;

-- As in 0012, without email addresses, and with the customer's own point.
create or replace function customer_order_tracking(p_order_number text, p_contact text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'status', o.status,
    'events', coalesce((select jsonb_agg(jsonb_build_object('status', e.to_status, 'at', e.created_at) order by e.id)
                          from order_status_events e where e.order_id = o.id), '[]'::jsonb),
    'rider', case when o.status in ('dispatched', 'in_transit') and d.order_id is not null then
               jsonb_build_object(
                 'name', case when position('@' in d.rider_name) = 0 then nullif(split_part(btrim(d.rider_name), ' ', 1), '') end,
                 'phone', d.rider_phone) end,
    'path', case when o.status in ('dispatched', 'in_transit') then coalesce((
              select jsonb_agg(jsonb_build_object('lat', p.lat, 'lng', p.lng, 'accuracy', p.accuracy_m, 'at', p.recorded_at) order by p.id)
                from (select l.* from delivery_locations l where l.order_id = o.id order by l.id desc limit 200) p), '[]'::jsonb)
            else '[]'::jsonb end,
    'destination', case when o.status not in ('delivered', 'cancelled') then
                     (select jsonb_build_object('lat', x.lat, 'lng', x.lng, 'at', x.set_at) from order_delivery_points x where x.order_id = o.id) end)
    from orders o
    left join deliveries d on d.order_id = o.id
   where o.order_number = upper(btrim(p_order_number))
     and ((auth.uid() is not null and o.user_id = auth.uid())
          or (nullif(btrim(coalesce(p_contact, '')), '') is not null
              and (o.contact_email = lower(btrim(p_contact)) or o.contact_phone = btrim(p_contact))))
$$;

-- As in 0008, with the customer's point for directions while the order is the rider's to deliver.
create or replace function rider_get_delivery(p_country char(2), p_order_number text, p_rider uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'order_number', o.order_number, 'status', o.status,
    'contact', jsonb_build_object('name', o.contact_name, 'phone', o.contact_phone),
    'delivery', jsonb_build_object('region', o.delivery_region, 'district', o.delivery_district, 'ward', o.delivery_ward,
                                   'street', o.delivery_street, 'extra', o.delivery_extra, 'notes', o.delivery_notes),
    'payment_method', o.payment_method, 'payment_status', o.payment_status,
    'total_minor', o.total_minor, 'currency', o.currency,
    'currency_exponent', (select c.exponent from currencies c where c.code = o.currency),
    'cash_to_collect_minor', case when o.payment_method = 'pay_on_delivery' and o.payment_status = 'pending'
                                  then o.total_minor else 0 end,
    'lines', coalesce((select jsonb_agg(jsonb_build_object('name', l.name, 'sku', l.sku, 'color', l.color,
                                                           'variant', l.variant, 'quantity', l.quantity) order by l.line_no)
                         from order_lines l where l.order_id = o.id), '[]'::jsonb),
    'assigned_at', d.assigned_at, 'delivered_at', d.delivered_at,
    'code_locked_until', case when d.code_locked_until > now() then d.code_locked_until end,
    'attempts', coalesce((select jsonb_agg(jsonb_build_object('reason', a.reason, 'note', a.note, 'created_at', a.created_at)
                                           order by a.id)
                            from delivery_attempts a where a.order_id = o.id), '[]'::jsonb),
    'destination', case when o.status not in ('delivered', 'cancelled') then
                     (select jsonb_build_object('lat', x.lat, 'lng', x.lng) from order_delivery_points x where x.order_id = o.id) end)
    from deliveries d
    join orders o on o.id = d.order_id
   where o.country_code = p_country and o.order_number = upper(btrim(p_order_number)) and d.rider_id = p_rider
$$;

revoke execute on function customer_set_delivery_point(text, numeric, numeric, integer) from public, anon;
grant execute on function customer_set_delivery_point(text, numeric, numeric, integer) to authenticated;

commit;
