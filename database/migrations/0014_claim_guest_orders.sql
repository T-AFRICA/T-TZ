-- 0014_claim_guest_orders.sql — guest orders join the account with the same verified email (DRAFT).
--
-- Forward-only, additive. Exercised only against a disposable PGlite
-- database with a Supabase role shim (database/client/tests); applying it
-- to a Supabase project needs owner approval. Requires 0004. Safe to run
-- again.
--
-- Owner report 2026-11-19: a customer placed an order without being signed
-- in (a guest order), the shop received it and gave it to a rider, but the
-- customer's account showed no orders: the account lists only orders
-- linked to it, and a guest order is linked to nobody.
--
-- Rules:
--   * A signed-in customer whose email address is verified
--     (auth.users.email_confirmed_at) takes over the guest orders placed
--     with that address. The checkout stores the email in lower case.
--   * An unverified address takes over nothing, and an order already linked
--     to an account never moves to another one.
--   * Only the customer's own session can call it; it returns how many
--     orders it linked.

begin;

create index if not exists orders_guest_email_idx on orders (contact_email) where user_id is null;

create or replace function customer_claim_guest_orders()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user  uuid := auth.uid();
  v_email text;
  v_count integer;
begin
  if v_user is null then
    return 0;
  end if;
  select nullif(lower(btrim(u.email)), '') into v_email
    from auth.users u
   where u.id = v_user and u.email_confirmed_at is not null;
  if v_email is null then
    return 0;
  end if;
  update orders set user_id = v_user where user_id is null and contact_email = v_email;
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

revoke execute on function customer_claim_guest_orders() from public, anon;
grant execute on function customer_claim_guest_orders() to authenticated;

commit;
