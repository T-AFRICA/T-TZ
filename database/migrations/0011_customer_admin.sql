-- 0011_customer_admin.sql — the customer directory for the Central Admin (DRAFT).
--
-- Forward-only, additive. Exercised only against a disposable PGlite
-- database with a Supabase role shim (database/client/tests); applying it
-- to a Supabase project needs owner approval. Requires 0004. Safe to run
-- again.
--
-- Two read-only functions, executable by service_role only, for whoever
-- holds customers.read in the country (checked by the country's backend
-- from the signed request). A customer is a website account (Supabase
-- Auth user of this project) with their profile; their orders are those
-- of this country placed from that account. Guest checkouts have no
-- account and are found under Orders. Nothing here changes a customer.

begin;

-- A page of customer accounts, newest first. p_search matches the email,
-- the name or the phone (as typed, no wildcards). Each with their number
-- of orders here, the total of their paid orders, and their last order.
create or replace function admin_list_customers(p_country char(2), p_search text, p_limit integer, p_offset integer)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with found as (
    select u.id, u.email, u.created_at, p.full_name, p.phone
      from auth.users u
      left join customer_profiles p on p.user_id = u.id
     where nullif(btrim(coalesce(p_search, '')), '') is null
        or position(lower(btrim(p_search)) in lower(coalesce(u.email, ''))) > 0
        or position(lower(btrim(p_search)) in lower(coalesce(p.full_name, ''))) > 0
        or coalesce(p.phone, '') = btrim(p_search)
  ),
  page as (
    select f.* from found f
     order by f.created_at desc, f.id
     limit least(greatest(coalesce(p_limit, 25), 1), 100)
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select jsonb_build_object(
    'total', (select count(*) from found),
    'currency', (select c.currency from countries c where c.code = p_country),
    'currency_exponent', (select cur.exponent from countries c join currencies cur on cur.code = c.currency where c.code = p_country),
    'customers', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', pg.id, 'email', pg.email, 'name', pg.full_name, 'phone', pg.phone, 'created_at', pg.created_at,
               'orders', (select count(*) from orders o where o.user_id = pg.id and o.country_code = p_country),
               'paid_minor', (select coalesce(sum(o.total_minor), 0) from orders o
                               where o.user_id = pg.id and o.country_code = p_country and o.payment_status = 'paid'),
               'last_order_at', (select max(o.created_at) from orders o where o.user_id = pg.id and o.country_code = p_country))
             order by pg.created_at desc, pg.id)
        from page pg), '[]'::jsonb))
$$;

-- One customer account with all their orders here, newest first; null when
-- there is no such account.
create or replace function admin_get_customer(p_country char(2), p_customer uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', u.id, 'email', u.email, 'created_at', u.created_at, 'email_confirmed', u.email_confirmed_at is not null,
    'name', p.full_name, 'phone', p.phone,
    'currency', (select c.currency from countries c where c.code = p_country),
    'currency_exponent', (select cur.exponent from countries c join currencies cur on cur.code = c.currency where c.code = p_country),
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object(
               'order_number', o.order_number, 'status', o.status, 'payment_status', o.payment_status,
               'payment_method', o.payment_method, 'total_minor', o.total_minor, 'created_at', o.created_at,
               'item_count', (select coalesce(sum(l.quantity), 0) from order_lines l where l.order_id = o.id))
             order by o.created_at desc)
        from orders o where o.user_id = u.id and o.country_code = p_country), '[]'::jsonb))
    from auth.users u
    left join customer_profiles p on p.user_id = u.id
   where u.id = p_customer
$$;

revoke execute on function admin_list_customers(char, text, integer, integer) from public, anon, authenticated;
revoke execute on function admin_get_customer(char, uuid) from public, anon, authenticated;
grant execute on function admin_list_customers(char, text, integer, integer) to service_role;
grant execute on function admin_get_customer(char, uuid) to service_role;

commit;
