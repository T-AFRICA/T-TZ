-- 0010_rider_figures.sql — riders' figures for the Central Admin (DRAFT).
--
-- Forward-only, additive. Exercised only against a disposable PGlite
-- database with a Supabase role shim (database/client/tests); applying it
-- to a Supabase project needs owner approval. Requires 0008. Safe to run
-- again.
--
-- Two functions, executable by service_role only, for whoever may assign
-- deliveries in the country (checked by the country's backend from the
-- signed request). They read the deliveries of 0008 and never return a
-- customer's delivery code. "Today" is the day in Africa/Dar_es_Salaam.

begin;

-- Per rider who has ever been given an order in the country:
-- {"<rider id>": {"open", "on_the_way", "delivered_today", "delivered_7_days",
--   "delivered_30_days", "failed_7_days", "cash_today_minor", "last_delivered_at"}}
create or replace function admin_rider_figures(p_country char(2))
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with day as (
    select (now() at time zone 'Africa/Dar_es_Salaam')::date as today
  ),
  given as (
    select d.*, o.status
      from deliveries d
      join orders o on o.id = d.order_id
     where o.country_code = p_country
  ),
  per_rider as (
    select g.rider_id,
           count(*) filter (where g.status in ('confirmed', 'processing', 'packed', 'dispatched', 'in_transit')) as open,
           count(*) filter (where g.status in ('dispatched', 'in_transit')) as on_the_way,
           count(*) filter (where g.status = 'delivered' and (g.delivered_at at time zone 'Africa/Dar_es_Salaam')::date = (select today from day)) as delivered_today,
           count(*) filter (where g.status = 'delivered' and g.delivered_at > now() - interval '7 days') as delivered_7_days,
           count(*) filter (where g.status = 'delivered' and g.delivered_at > now() - interval '30 days') as delivered_30_days,
           coalesce(sum(g.cash_collected_minor) filter (where (g.delivered_at at time zone 'Africa/Dar_es_Salaam')::date = (select today from day)), 0) as cash_today_minor,
           max(g.delivered_at) as last_delivered_at
      from given g
     group by g.rider_id
  ),
  failures as (
    select a.actor_id as rider_id, count(*) as failed_7_days
      from delivery_attempts a
      join orders o on o.id = a.order_id
     where o.country_code = p_country and a.created_at > now() - interval '7 days'
     group by a.actor_id
  )
  select coalesce(jsonb_object_agg(r.rider_id, jsonb_build_object(
           'open', r.open, 'on_the_way', r.on_the_way, 'delivered_today', r.delivered_today,
           'delivered_7_days', r.delivered_7_days, 'delivered_30_days', r.delivered_30_days,
           'failed_7_days', coalesce(f.failed_7_days, 0), 'cash_today_minor', r.cash_today_minor,
           'last_delivered_at', r.last_delivered_at)), '{}'::jsonb)
    from per_rider r
    left join failures f on f.rider_id = r.rider_id
$$;

-- One rider's deliveries, newest given first (at most p_limit, up to 100),
-- and their failed attempts of the last 30 days.
create or replace function admin_rider_deliveries(p_country char(2), p_rider uuid, p_limit integer)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'deliveries', coalesce((
      select jsonb_agg(x.item order by x.assigned_at desc)
        from (select d.assigned_at,
                     jsonb_build_object(
                       'order_number', o.order_number, 'status', o.status, 'contact_name', o.contact_name,
                       'district', o.delivery_district, 'region', o.delivery_region,
                       'payment_method', o.payment_method, 'total_minor', o.total_minor,
                       'cash_collected_minor', d.cash_collected_minor,
                       'assigned_at', d.assigned_at, 'delivered_at', d.delivered_at) as item
                from deliveries d
                join orders o on o.id = d.order_id
               where o.country_code = p_country and d.rider_id = p_rider
               order by d.assigned_at desc
               limit least(greatest(coalesce(p_limit, 25), 1), 100)) x), '[]'::jsonb),
    'attempts', coalesce((
      select jsonb_agg(jsonb_build_object('order_number', o.order_number, 'reason', a.reason, 'note', a.note,
                                          'created_at', a.created_at) order by a.id desc)
        from delivery_attempts a
        join orders o on o.id = a.order_id
       where o.country_code = p_country and a.actor_id = p_rider and a.created_at > now() - interval '30 days'), '[]'::jsonb),
    'currency', (select c.currency from countries c where c.code = p_country),
    'currency_exponent', (select cur.exponent from countries c join currencies cur on cur.code = c.currency where c.code = p_country))
$$;

revoke execute on function admin_rider_figures(char) from public, anon, authenticated;
revoke execute on function admin_rider_deliveries(char, uuid, integer) from public, anon, authenticated;
grant execute on function admin_rider_figures(char) to service_role;
grant execute on function admin_rider_deliveries(char, uuid, integer) to service_role;

commit;
