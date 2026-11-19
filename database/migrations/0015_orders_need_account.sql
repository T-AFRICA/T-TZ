-- 0015_orders_need_account.sql — no order without an account (DRAFT).
--
-- Forward-only. Exercised only against a disposable PGlite database with a
-- Supabase role shim (database/client/tests); applying it to a Supabase
-- project needs owner approval. Requires 0004. Safe to run again.
--
-- Owner decision 2026-11-19: a customer registers (or signs in) before
-- checkout; nobody places an order without an account. The storefront
-- sends signed-out visitors to sign in or register and back to checkout,
-- and its server refuses an order without a session. This migration makes
-- the database refuse it too: the anon key is public (it is in every
-- browser), so without it anyone could still place a guest order by
-- calling place_cod_order() through the Supabase API directly.
--
-- Rules:
--   * place_cod_order() runs for the authenticated role only (a signed-in
--     customer, whose auth.uid() becomes the order's owner).
--   * Orders placed as guests before this keep working: tracking by order
--     number plus email or phone stays open to anon, and 0014 links them to
--     the account with the same verified email.
--   * Owner setting this relies on: Supabase Auth "Allow anonymous
--     sign-ins" stays off (an anonymous sign-in is also "authenticated").

begin;

revoke execute on function place_cod_order(uuid, char, jsonb, jsonb, jsonb, bigint) from public, anon;
grant execute on function place_cod_order(uuid, char, jsonb, jsonb, jsonb, bigint) to authenticated;

commit;
