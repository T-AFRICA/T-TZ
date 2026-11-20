-- 0019_reports.sql — reports for the Central Admin (DRAFT).
--
-- Forward-only, additive, read only. Exercised only against a disposable
-- PGlite database with a Supabase role shim (database/client/tests);
-- applying it to a Supabase project needs owner approval. Requires 0004,
-- 0006, 0008 and 0017. Safe to run again.
--
-- Owner decisions 2026-11-20:
--   * Four reports: sales by day, top products and categories, orders and
--     delivery (status, region, riders), and stock.
--   * A sale is a PAID order (Cash on Delivery: once delivered), as on the
--     dashboard. Orders keep no separate payment date, so a paid order
--     counts on the day it was placed.
--   * Days are the country's own (Africa/Dar_es_Salaam).
--
-- Rules:
--   * Executable by service_role only (signed requests with reports.read).
--   * A period is at most 366 days, from <= to; anything else answers null.
--   * No customer names, emails or phones in any report.

begin;

-- Orders of the country placed in the period, with their local day.
create or replace function report_orders_in(p_country char(2), p_from date, p_to date)
returns table (id uuid, day date, status text, payment_status text, payment_method text, delivery_region text, total_minor bigint, currency char(3))
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select o.id, (o.created_at at time zone 'Africa/Dar_es_Salaam')::date, o.status, o.payment_status, o.payment_method,
         o.delivery_region, o.total_minor, o.currency
    from orders o
   where o.country_code = p_country
     and (o.created_at at time zone 'Africa/Dar_es_Salaam')::date between p_from and p_to
$$;

-- True for a period the reports accept.
create or replace function report_period_ok(p_from date, p_to date)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select p_from is not null and p_to is not null and p_from <= p_to and p_to - p_from <= 365
$$;

-- Sales by day: orders placed, paid orders and their amount, cancelled.
create or replace function admin_report_sales(p_country char(2), p_from date, p_to date)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with o as (select * from report_orders_in(p_country, p_from, p_to)),
  days as (
    select d::date as day from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') d
  )
  select case when report_period_ok(p_from, p_to) then jsonb_build_object(
    'currency', (select c.currency from countries c where c.code = p_country),
    'currency_exponent', (select cur.exponent from countries c join currencies cur on cur.code = c.currency where c.code = p_country),
    'days', (select jsonb_agg(jsonb_build_object(
                     'day', d.day,
                     'placed', (select count(*) from o where o.day = d.day),
                     'paid_orders', (select count(*) from o where o.day = d.day and o.payment_status = 'paid'),
                     'paid_minor', (select coalesce(sum(o.total_minor), 0) from o where o.day = d.day and o.payment_status = 'paid'),
                     'cancelled', (select count(*) from o where o.day = d.day and o.status = 'cancelled'))
                   order by d.day)
               from days d),
    'totals', jsonb_build_object(
      'placed', (select count(*) from o),
      'paid_orders', (select count(*) from o where o.payment_status = 'paid'),
      'paid_minor', (select coalesce(sum(o.total_minor), 0) from o where o.payment_status = 'paid'),
      'cancelled', (select count(*) from o where o.status = 'cancelled'),
      'open', (select count(*) from o where o.status not in ('delivered', 'cancelled'))),
    'by_payment', coalesce((
      select jsonb_agg(jsonb_build_object('method', x.payment_method, 'paid_orders', x.n, 'paid_minor', x.amount) order by x.amount desc, x.payment_method)
        from (select o.payment_method, count(*) as n, sum(o.total_minor) as amount from o where o.payment_status = 'paid' group by o.payment_method) x), '[]'::jsonb))
  end
$$;

-- The best-selling products and categories by paid amount.
create or replace function admin_report_products(p_country char(2), p_from date, p_to date, p_limit integer)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with paid as (select o.id from report_orders_in(p_country, p_from, p_to) o where o.payment_status = 'paid'),
  lines as (
    select l.product_id, l.product_slug, l.name, l.sku, l.quantity, l.line_total_minor, p.category_id
      from order_lines l
      join paid on paid.id = l.order_id
      left join products p on p.id = l.product_id
  )
  select case when report_period_ok(p_from, p_to) then jsonb_build_object(
    'currency', (select c.currency from countries c where c.code = p_country),
    'currency_exponent', (select cur.exponent from countries c join currencies cur on cur.code = c.currency where c.code = p_country),
    'paid_minor', (select coalesce(sum(line_total_minor), 0) from lines),
    'units', (select coalesce(sum(quantity), 0) from lines),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object('slug', x.slug, 'name', x.name, 'sku', x.sku, 'units', x.units, 'amount_minor', x.amount) order by x.amount desc, x.slug)
        from (select max(l.product_slug) as slug, max(l.name) as name, max(l.sku) as sku, sum(l.quantity) as units, sum(l.line_total_minor) as amount
                from lines l group by l.product_id
               order by sum(l.line_total_minor) desc, max(l.product_slug)
               limit least(greatest(coalesce(p_limit, 10), 1), 50)) x), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('slug', x.slug, 'name', x.name, 'units', x.units, 'amount_minor', x.amount) order by x.amount desc, x.slug)
        from (select coalesce(c.slug, 'unknown') as slug, coalesce(c.name, 'Unknown') as name, sum(l.quantity) as units, sum(l.line_total_minor) as amount
                from lines l left join categories c on c.id = l.category_id
               group by c.slug, c.name) x), '[]'::jsonb))
  end
$$;

-- Orders by status and region, and each rider's deliveries in the period.
create or replace function admin_report_orders(p_country char(2), p_from date, p_to date)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with o as (select * from report_orders_in(p_country, p_from, p_to)),
  given as (
    select d.* from deliveries d join orders x on x.id = d.order_id
     where x.country_code = p_country
       and (d.assigned_at at time zone 'Africa/Dar_es_Salaam')::date between p_from and p_to
  )
  select case when report_period_ok(p_from, p_to) then jsonb_build_object(
    'currency', (select c.currency from countries c where c.code = p_country),
    'currency_exponent', (select cur.exponent from countries c join currencies cur on cur.code = c.currency where c.code = p_country),
    'placed', (select count(*) from o),
    'by_status', coalesce((select jsonb_object_agg(x.status, x.n) from (select o.status, count(*) as n from o group by o.status) x), '{}'::jsonb),
    'by_region', coalesce((
      select jsonb_agg(jsonb_build_object('region', x.region, 'orders', x.n, 'paid_minor', x.amount) order by x.n desc, x.region)
        from (select coalesce(nullif(btrim(o.delivery_region), ''), 'Not given') as region, count(*) as n,
                     coalesce(sum(o.total_minor) filter (where o.payment_status = 'paid'), 0) as amount
                from o group by 1) x), '[]'::jsonb),
    'riders', coalesce((
      select jsonb_agg(jsonb_build_object(
               'rider_id', r.rider_id, 'rider_name', r.rider_name, 'given', r.given, 'delivered', r.delivered,
               'failed_attempts', r.failed, 'cash_minor', r.cash)
             order by r.delivered desc, r.rider_name)
        from (select g.rider_id, max(g.rider_name) as rider_name, count(*) as given,
                     count(*) filter (where g.delivered_at is not null) as delivered,
                     (select count(*) from delivery_attempts a where a.order_id in (select g2.order_id from given g2 where g2.rider_id = g.rider_id)) as failed,
                     coalesce(sum(g.cash_collected_minor), 0) as cash
                from given g group by g.rider_id) r), '[]'::jsonb))
  end
$$;

-- Stock now (out, low, units and their value at today's prices) and what
-- moved in the period, by reason (0017's history).
create or replace function admin_report_stock(p_country char(2), p_from date, p_to date)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with stock as (
    select p.slug, p.name, p.sku, coalesce(s.available, 0) as available, coalesce(s.low_stock_at, 5) as low_stock_at,
           pr.price_minor, p.active
      from products p
      left join stock_levels s on s.product_id = p.id and s.country_code = p_country
      left join product_country_prices pr on pr.product_id = p.id and pr.country_code = p_country
  ),
  moves as (
    select m.* from stock_movements m
     where m.country_code = p_country
       and (m.created_at at time zone 'Africa/Dar_es_Salaam')::date between p_from and p_to
  )
  select case when report_period_ok(p_from, p_to) then jsonb_build_object(
    'currency', (select c.currency from countries c where c.code = p_country),
    'currency_exponent', (select cur.exponent from countries c join currencies cur on cur.code = c.currency where c.code = p_country),
    'products', (select count(*) from stock),
    'out', (select count(*) from stock where available = 0),
    'low', (select count(*) from stock where available between 1 and low_stock_at),
    'units', (select coalesce(sum(available), 0) from stock),
    'value_minor', (select coalesce(sum(available::bigint * price_minor), 0) from stock where price_minor is not null),
    'movements', coalesce((
      select jsonb_agg(jsonb_build_object('reason', x.reason, 'units_in', x.units_in, 'units_out', x.units_out, 'changes', x.n) order by x.reason)
        from (select m.reason, coalesce(sum(m.change) filter (where m.change > 0), 0) as units_in,
                     coalesce(-sum(m.change) filter (where m.change < 0), 0) as units_out, count(*) as n
                from moves m group by m.reason) x), '[]'::jsonb),
    'attention', coalesce((
      select jsonb_agg(jsonb_build_object('slug', x.slug, 'name', x.name, 'sku', x.sku, 'available', x.available, 'low_stock_at', x.low_stock_at, 'live', x.active)
                       order by x.available, x.name)
        from (select * from stock where available <= low_stock_at order by available, name limit 50) x), '[]'::jsonb))
  end
$$;

revoke execute on function report_orders_in(char, date, date) from public, anon, authenticated;
revoke execute on function report_period_ok(date, date) from public, anon, authenticated;
revoke execute on function admin_report_sales(char, date, date) from public, anon, authenticated;
revoke execute on function admin_report_products(char, date, date, integer) from public, anon, authenticated;
revoke execute on function admin_report_orders(char, date, date) from public, anon, authenticated;
revoke execute on function admin_report_stock(char, date, date) from public, anon, authenticated;

grant execute on function admin_report_sales(char, date, date) to service_role;
grant execute on function admin_report_products(char, date, date, integer) to service_role;
grant execute on function admin_report_orders(char, date, date) to service_role;
grant execute on function admin_report_stock(char, date, date) to service_role;

commit;
