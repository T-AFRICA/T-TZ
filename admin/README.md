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
- Orders of a connected country, read live from that country's own backend:
  list with status counts and search, order detail, status changes one step
  at a time, cancellation until dispatch, internal notes. Each change is
  made and recorded by the country and audited here.
- Deliveries by TRONIC's own riders (Rider role): an Order Manager gives a
  confirmed, processing or packed order to a rider; the rider, on a phone,
  sees only their own deliveries (address, phone, items, cash to collect),
  marks picked up and on the way, records failed attempts, and hands over
  with the customer's 6-digit code, a photo and the customer's signature,
  confirming the Cash on Delivery amount. Managers see the proofs, the
  cash collected and the attempts on the order. No location or map yet.
- Products, categories, inventory, customers, website content, promotions
  and reports have a page that says the module is not available yet. They
  show no data: that part of the country API has not been built.

## Commands (from the repository root)

- `pnpm --filter @tronic/admin run dev` — dev server on port 3300. Without
  the variables below it shows "not connected" and nobody can sign in.
- `pnpm --filter @tronic/admin run preview:local` — the dev server on port
  3300 with a disposable in-process database, a stand-in for Supabase Auth,
  a stand-in for Tanzania's backend (already connected, with a few synthetic
  orders) and synthetic administrators. The sign-in details are printed in
  the terminal and written to `admin/.preview/sign-in.txt` (ignored by Git);
  the password is made up on the first start and stays the same after that.
  The data is gone when it stops and nothing outside this machine is
  contacted. For looking at the console only.
- `pnpm --filter @tronic/admin run test` — unit tests.
- `pnpm --filter @tronic/admin run e2e` — Playwright browser tests against a
  production build in `admin/.next-e2e`, the same disposable databases and
  stand-ins. Uses the installed Google Chrome. Not run in CI.

Do not run `next build` for the admin while its dev server is running: they
share `admin/.next`. The browser tests build into their own folder.

## Region

`admin/vercel.json` runs the admin's server functions in `fra1` (Frankfurt),
next to its Supabase project in `eu-central-1` (Frankfurt). Every console page makes
several database round trips and two account-service calls, so the distance
between the two adds up on every click: on 18 Nov 2026 the admin ran in
Vercel's default `iad1` (Washington) and pages felt slow. Orders pages also call
Tanzania's storefront in `dub1` (Dublin), a short hop from Frankfurt. If the
Supabase project is ever moved, move this region with it.

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
pnpm --filter @tronic/admin run signing-key
```

(`pnpm.cmd` in Windows PowerShell.) It writes three files to
`tronic-central-admin-keys` in the user's home folder, outside the
repository, and prints where they are, never what is in them:
`COUNTRY_API_SIGNING_KEY.pem` (private), `CENTRAL_ADMIN_VERIFY_KEY.pem`
(public) and `WHERE-THESE-GO.txt`. Each file is named after the variable
its content goes into. It refuses to write over an existing key or into
the repository; a folder can be given as an argument.

Each country's deployment gets the public key as `CENTRAL_ADMIN_VERIFY_KEY`
and the key's name as `CENTRAL_ADMIN_VERIFY_KEY_ID` (the same value as
`COUNTRY_API_SIGNING_KEY_ID`). Without them a country has no admin API.

Neither key file belongs in this repository (`*.pem` is ignored and refused
by the hygiene check).

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

## Connecting a country's orders (owner)

1. Run `database/migrations/0006_order_admin.sql` in that country's Supabase
   SQL editor (after 0004).
2. Set `CENTRAL_ADMIN_VERIFY_KEY` and `CENTRAL_ADMIN_VERIFY_KEY_ID` in the
   country's storefront deployment and redeploy.
3. In the console, as Master Super Admin: country → Settings → enter the
   storefront's address, allow calls, save, then "Check connection".
4. Orders opens for everyone holding `orders.read` in that country.

## Turning on deliveries (owner)

1. Central Admin project, SQL editor: `database/admin-migrations/0003_riders.sql`.
2. The country's project, SQL editor: `database/migrations/0008_deliveries.sql`
   (after 0006).
3. Deploy both apps. Each rider needs an account in the Central Admin
   project's Auth (confirmed email), then the Rider role from Staff.
4. Until step 2 is done, the delivery pages say the country's database
   does not have deliveries yet; orders keep working.

## Live order tracking (owner)

While an order is on its way, the rider's delivery page shares the phone's
location (the browser asks the rider once; at most every 15 seconds, only
while that page is open). The customer's tracking page on the storefront
shows the rider's first name, a Call button with the rider's phone, and
the rider's position and path on an OpenFreeMap map (free, no key).
Arrival time and distance say "Not available": there are no store or
delivery-address coordinates yet.

1. Central Admin project: `database/admin-migrations/0004_admin_phone.sql`
   (after 0003). Riders → "Add a rider" takes the email the rider signs in
   with, their name and phone (also offered, optional, in Staff → "Give a
   role"); the name and phone reach the rider's profile at their first
   sign-in. An existing rider's are edited on their page under "Name and
   phone". The customer sees the first name and calls that phone.
2. The country's project: `database/migrations/0012_live_tracking.sql`
   (after 0008). An order assigned after this carries the rider's phone.
3. Deploy both apps. Until step 2, the rider's page says the country does
   not have live tracking yet and the customer's map says the live
   location is not available; everything else keeps working.

## Customers (owner)

"Customers" (for whoever holds `customers.read`: Order Manager, Customer
Support, Country Super Admin) lists the country's website accounts with
their orders, paid total and last order, searchable by email, name or
phone; a customer's page shows their contact details and every order.
Read only. Guest checkouts have no account and stay under Orders. Needs
`database/migrations/0011_customer_admin.sql` in the country's project.

## Riders page (owner)

"Riders" (for whoever may assign deliveries) lists everyone with the Rider
role in the country and, from the country, what each has with them now,
on the way, delivered, failed attempts and the cash collected today; each
rider's page shows their orders, recent deliveries and failed attempts.
The figures need `database/migrations/0010_rider_figures.sql` in the
country's Supabase project.

## Country dashboard figures (owner)

Run `database/migrations/0009_admin_summary.sql` in the country's Supabase
SQL editor. The country dashboard then shows orders, open orders, paid
sales of the last 30 days, customer accounts, products on sale and stock
to refill, counted by the country when the page opens, to everyone who
holds `reports.read` there (Country Super Admin, Finance / Reporting
Viewer). Before that, the cards say the migration is missing. A rider's
dashboard shows their own deliveries instead.

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
