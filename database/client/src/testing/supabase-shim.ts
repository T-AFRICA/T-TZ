/**
 * Test-only stand-in for what a Supabase project provides before our
 * migrations run. Never applied to a real database. Kept as a TypeScript
 * string so the helpers load under any module system (Vitest ESM,
 * Playwright CommonJS).
 *
 * It reproduces the parts that matter for access control:
 *   - the anon, authenticated and service_role roles;
 *   - auth.users and auth.uid(), which reads the JWT "sub" claim the way
 *     Supabase does (request.jwt.claims set per request/transaction);
 *   - Supabase's permissive defaults: USAGE on public and ALL on every new
 *     table, sequence and function for anon and authenticated. Migrations
 *     must undo these; the tests prove they do.
 */
export const SUPABASE_SHIM_SQL = `
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id     uuid primary key,
  email  text unique
);

create function auth.uid() returns uuid
language sql stable
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ),
    ''
  )::uuid
$$;

create function auth.role() returns text
language sql stable
as $$
  select coalesce(
    current_setting('request.jwt.claim.role', true),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )
$$;

grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;
