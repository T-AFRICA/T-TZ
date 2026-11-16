# Central Admin application

Next.js app for the Master Super Admin, the Country Super Admins and country
staff. One application for every country; what a person sees depends on the
roles they hold in the Central Admin database. It is deployed as its own
Vercel project (Root Directory `admin`) and connects to its own Supabase
project, never to a country's.

Design, role model, API contract and what is and is not built:
`docs/architecture/CENTRAL-ADMIN-PLAN.md`.

## What it does today

- Sign-in with email and password (Supabase Auth, server-side only), a
  second factor (authenticator app) for both super admin roles, no
  registration.
- Overview, country roster, country configuration, service registry and a
  signed connection check per country.
- Administrators and country staff: give a role by email address, remove a
  role, withdraw an invitation, suspend and reinstate (Master Super Admin).
- Audit log and refused attempts.
- Products, categories, inventory, orders, customers, website content,
  promotions and reports have a page that says the module is not connected.
  They show no data, because no country serves the admin API yet.

## Commands (from the repository root)

- `pnpm --filter @tronic/admin run dev` — dev server on port 3300. Without
  the variables below it shows "not connected" and nobody can sign in.
- `pnpm --filter @tronic/admin run preview:local` — the dev server on port
  3300 with a disposable in-process database, a stand-in for Supabase Auth
  and synthetic administrators. The sign-in details are made up at start
  and printed in the terminal. Nothing is kept after it stops and nothing
  outside this machine is contacted. For looking at the console only.
- `pnpm --filter @tronic/admin run test` — unit tests.
- `pnpm --filter @tronic/admin run e2e` — Playwright browser tests against a
  production build in `admin/.next-e2e`, the same disposable database and
  stand-in. Uses the installed Google Chrome. Not run in CI.

Do not run `next build` for the admin while its dev server is running: they
share `admin/.next`. The browser tests build into their own folder.

## Deployment variables (server-side, never `NEXT_PUBLIC_`)

| Variable | Value |
| --- | --- |
| `ADMIN_SUPABASE_URL` | URL of the Central Admin Supabase project |
| `ADMIN_SUPABASE_ANON_KEY` | That project's anon key |
| `ADMIN_DATABASE_URL` | That project's transaction pooler connection string (port 6543) |
| `ADMIN_DATABASE_POOL_MAX` | Optional, default 5 |
| `COUNTRY_API_SIGNING_KEY` | PKCS#8 P-256 private key (PEM; `\n` may stand for line breaks) |
| `COUNTRY_API_SIGNING_KEY_ID` | A short name for that key, e.g. `2026-11` |

The application never uses the Supabase service-role key.

An owner creates the signing key pair on their own machine, keeps the
private key in the admin deployment only, and gives each country the public
key:

```bash
openssl ecparam -name prime256v1 -genkey -noout | openssl pkcs8 -topk8 -nocrypt -out central-admin-signing.pem
```

```bash
openssl ec -in central-admin-signing.pem -pubout -out central-admin-verify.pem
```

Neither file belongs in this repository (`*.pem` is ignored and refused by
the hygiene check).

## Setting up the Central Admin Supabase project (owner)

1. Create a new project. It must not be a country's project.
2. Authentication settings: allow new sign-ups **off**, confirm email
   **on**, secure email change **on**, TOTP multi-factor **on**.
3. SQL editor: run `database/admin-migrations/0001_admin_core.sql` (one
   transaction; a failure changes nothing).
4. Add the first Master Super Admin in Authentication → Users with a
   confirmed email address, then in the SQL editor:
   `select app_private.provision_master_super_admin('<their email>');`
5. Set the variables above in the admin's hosting project and deploy.
6. That person signs in, sets up their authenticator, and gives the Country
   Super Admin roles from Administrators. Each invited person needs an
   account in this project's Auth with the same confirmed email address.

## Security notes

- Every page and every server action resolves the administrator from the
  verified session and checks the permission itself; the proxy and the
  layout are conveniences. The database checks again (RLS and its
  functions), and writes the audit log in the same transaction.
- The country in an address or a form is a request. It must be one of the
  countries the database returned for the signed-in administrator.
- A refused page looks exactly like a missing page, and the attempt is
  recorded for the Master Super Admin.
- The sign-in limiter is in memory per server instance (best effort).
