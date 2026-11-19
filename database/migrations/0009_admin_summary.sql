-- 0009_admin_summary.sql — figures for the Central Admin's country dashboard (DRAFT).
--
-- Forward-only, additive. Exercised only against a disposable PGlite
-- database with a Supabase role shim (database/client/tests); applying it
-- to a Supabase project needs owner approval. Requires 0004. Safe to run
-- again.
--
-- One function, executable by service_role only, that counts what the
-- country's own records say. Nothing is estimated: a figure the records do
-- not hold is not returned. Money is in the currency's minor units.
--   * orders: all, placed today (Africa/Dar_es_Salaam), by status, and
--     open (not delivered and not cancelled);
--   * sales: the total of paid orders placed in the last 30 days (a Cash on
--     Delivery order counts once it is delivered and paid; orders keep no
--     separate payment date, so the order date is the one used);
--   * customers: customer accounts (Supabase Auth users of this project);
--   * products: active products with an active price in the country;
--   * stock: products out of stock, and with 1 to p_low_stock units left.

begin;

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
                            where sl.available between 1 and greatest(coalesce(p_low_stock, 5), 1)),
    'low_stock_threshold', greatest(coalesce(p_low_stock, 5), 1))
$$;

revoke execute on function admin_country_summary(char, integer) from public, anon, authenticated;
grant execute on function admin_country_summary(char, integer) to service_role;

commit;
