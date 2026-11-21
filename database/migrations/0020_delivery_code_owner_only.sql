-- 0020_delivery_code_owner_only.sql — the delivery code for the signed-in
-- owner of the order only, and no new function open to everyone (DRAFT).
--
-- Forward-only. Exercised only against a disposable PGlite database with a
-- Supabase role shim (database/client/tests); applying it to a Supabase
-- project needs owner approval. Requires 0008 (and 0003). Safe to run again.
--
-- Security audit 2026-11-21 (docs/security/SECURITY_AUDIT_REPORT.md, F-01):
-- customer_delivery_code() (0008) gave the six-digit code to anyone who
-- sent the order number with the email or phone used at checkout, and it
-- was open to anon, whose key is public. The rider is shown exactly that
-- order number and phone for the delivery (rider_get_delivery), and staff
-- see both too, so a rider could read the code and mark an order delivered
-- without meeting the customer. The code then proved nothing.
--
-- Rules after this migration:
--   * The code is returned only to the signed-in customer who owns the
--     order (auth.uid() = orders.user_id), while it is dispatched or on its
--     way. Since 0015 every order has an owner. An order placed as a guest
--     before 0015 shows its code once the customer signs in with the same
--     verified email (0014 links it to the account).
--   * The second argument stays so a storefront from before this migration
--     keeps calling the same function; it is ignored.
--   * anon cannot run the function at all.
--   * Tracking by order number plus email or phone (track_order,
--     customer_order_tracking) is unchanged.
--
-- Also: a function created in this database is executable by everyone
-- (PUBLIC) unless that is taken away. 0003 tried to take it away for the
-- public schema only, which PostgreSQL does not apply to PUBLIC's built-in
-- right; every function so far carries its own "revoke ... from public", so
-- nothing is open today. From here on the default itself is closed for the
-- role that runs the migrations: a function is callable only by the roles
-- it is granted to.

begin;

create or replace function customer_delivery_code(p_order_number text, p_contact text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object('code', d.code)
    from orders o
    join deliveries d on d.order_id = o.id
   where o.order_number = upper(btrim(p_order_number))
     and o.status in ('dispatched', 'in_transit')
     and auth.uid() is not null
     and o.user_id = auth.uid()
$$;

revoke execute on function customer_delivery_code(text, text) from public, anon;
grant execute on function customer_delivery_code(text, text) to authenticated;

alter default privileges revoke execute on functions from public;

commit;
