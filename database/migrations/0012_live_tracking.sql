-- 0012_live_tracking.sql — live delivery tracking for the customer (DRAFT).
--
-- Forward-only, additive. Exercised only against a disposable PGlite
-- database with a Supabase role shim (database/client/tests); applying it
-- to a Supabase project needs owner approval. Requires 0008. Safe to run
-- again.
--
-- Owner decisions 2026-11-19: the rider's phone shares its location while
-- an order is on its way; the customer sees the rider on a map, the rider's
-- first name and phone, and the real time of each step. No outside service
-- is given the customer's address.
--
-- Rules:
--   * A location is accepted only from the rider the order is given to,
--     only while it is picked up or on its way, at most one every 10
--     seconds, with the server's own time. Points older than 7 days are
--     removed.
--   * The customer (the signed-in owner, or the order number with the
--     checkout email or phone) reads the step times, and, only while the
--     order is on its way, the rider's first name and phone and the
--     rider's path so far. Nothing else of the rider or of other orders.

begin;

alter table deliveries add column if not exists rider_phone text
  check (rider_phone is null or rider_phone ~ '^\+[0-9]{9,15}$');

create table if not exists delivery_locations (
  id           bigint generated always as identity primary key,
  order_id     uuid not null references orders (id) on delete cascade,
  lat          numeric(9, 6) not null check (lat between -90 and 90),
  lng          numeric(9, 6) not null check (lng between -180 and 180),
  accuracy_m   integer check (accuracy_m is null or accuracy_m between 0 and 100000),
  recorded_at  timestamptz not null default now()
);

create index if not exists delivery_locations_order_idx on delivery_locations (order_id, id);
create index if not exists delivery_locations_time_idx on delivery_locations (recorded_at);

alter table delivery_locations enable row level security;
revoke all on delivery_locations from public, anon, authenticated, service_role;

-- Giving an order to a rider, now with the rider's phone (from the Central
-- Admin's records). The phone reaches the customer only while the order is
-- on its way.
create or replace function admin_assign_delivery(
  p_country      char(2),
  p_order_number text,
  p_rider        uuid,
  p_rider_name   text,
  p_actor        uuid,
  p_rider_phone  text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
  v_phone  text := nullif(btrim(coalesce(p_rider_phone, '')), '');
begin
  if v_phone is not null and v_phone !~ '^\+[0-9]{9,15}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  v_result := admin_assign_delivery(p_country, p_order_number, p_rider, p_rider_name, p_actor);
  if (v_result ->> 'ok')::boolean is true then
    update deliveries d set rider_phone = v_phone
      from orders o
     where o.id = d.order_id and o.country_code = p_country and o.order_number = upper(btrim(p_order_number));
  end if;
  return v_result;
end
$$;

-- The rider's phone reports where it is. Returns
--   {"ok": true, "saved": bool}  (false: too soon after the last point)
--   {"ok": false, "code": "invalid_request" | "not_found" | "not_on_the_way"}
create or replace function rider_report_location(
  p_country      char(2),
  p_order_number text,
  p_rider        uuid,
  p_lat          numeric,
  p_lng          numeric,
  p_accuracy     integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order  orders%rowtype;
  v_rider  uuid;
  v_last   timestamptz;
begin
  if p_rider is null or p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180
     or (p_accuracy is not null and p_accuracy not between 0 and 100000) then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  select o.* into v_order from orders o
   where o.country_code = p_country and o.order_number = upper(btrim(p_order_number));
  select d.rider_id into v_rider from deliveries d where d.order_id = v_order.id;
  if v_order.id is null or v_rider is distinct from p_rider then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_order.status not in ('dispatched', 'in_transit') then
    return jsonb_build_object('ok', false, 'code', 'not_on_the_way');
  end if;

  select max(l.recorded_at) into v_last from delivery_locations l where l.order_id = v_order.id;
  if v_last is not null and v_last > now() - interval '10 seconds' then
    return jsonb_build_object('ok', true, 'saved', false);
  end if;

  insert into delivery_locations (order_id, lat, lng, accuracy_m)
  values (v_order.id, round(p_lat, 6), round(p_lng, 6), p_accuracy);
  -- Locations are kept for a week only.
  delete from delivery_locations where recorded_at < now() - interval '7 days';
  return jsonb_build_object('ok', true, 'saved', true);
end
$$;

-- What the customer's tracking page shows: the time of each step, and,
-- while the order is on its way, the rider's first name and phone and the
-- rider's path (at most the last 200 points, oldest first). Null for an
-- order the caller may not see (the same answer as an unknown order).
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
               jsonb_build_object('name', split_part(btrim(d.rider_name), ' ', 1), 'phone', d.rider_phone) end,
    'path', case when o.status in ('dispatched', 'in_transit') then coalesce((
              select jsonb_agg(jsonb_build_object('lat', p.lat, 'lng', p.lng, 'accuracy', p.accuracy_m, 'at', p.recorded_at) order by p.id)
                from (select l.* from delivery_locations l where l.order_id = o.id order by l.id desc limit 200) p), '[]'::jsonb)
            else '[]'::jsonb end)
    from orders o
    left join deliveries d on d.order_id = o.id
   where o.order_number = upper(btrim(p_order_number))
     and ((auth.uid() is not null and o.user_id = auth.uid())
          or (nullif(btrim(coalesce(p_contact, '')), '') is not null
              and (o.contact_email = lower(btrim(p_contact)) or o.contact_phone = btrim(p_contact))))
$$;

revoke execute on function admin_assign_delivery(char, text, uuid, text, uuid, text) from public, anon, authenticated;
revoke execute on function rider_report_location(char, text, uuid, numeric, numeric, integer) from public, anon, authenticated;
revoke execute on function customer_order_tracking(text, text) from public;
grant execute on function admin_assign_delivery(char, text, uuid, text, uuid, text) to service_role;
grant execute on function rider_report_location(char, text, uuid, numeric, numeric, integer) to service_role;
grant execute on function customer_order_tracking(text, text) to anon, authenticated;

commit;
