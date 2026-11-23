# TRONIC security architecture

What protects what, and where it lives in the code. This file describes the
system as it is built. Controls that are only planned are marked **Planned**;
the audit report says which controls have a test behind them.

Last reviewed: 2026-11-21 (security audit, `SECURITY_AUDIT_REPORT.md`).
Baseline: OWASP ASVS Level 2, with stricter handling of administration,
orders, delivery and (when built) payments.

## 1. Parts and trust boundaries

```
Customer's browser ──HTTPS──> Storefront (frontend/, Next.js on Vercel)
                                 │  server actions, route handlers
                                 │  Supabase Auth (country project)
                                 └─> Country database (Supabase Postgres)
                                        ▲
Staff / rider browser ─HTTPS─> Central Admin (admin/, Next.js on Vercel)
                                 │  Supabase Auth (admin project, own users)
                                 ├─> Admin database (roles, grants, audit)
                                 └─signed HTTPS─> Storefront /api/admin/v1
                                                   (the country admin API)
```

| Boundary | Who is on the far side | What is trusted across it |
|---|---|---|
| Browser → storefront | Anyone | Nothing. Every server action and route validates its input and takes identity from the verified session. |
| Browser → Central Admin | Anyone | Nothing. Every action and route checks the session, the account status, the country and the permission. |
| Central Admin → country admin API | The admin server only | A signed token (ES256, 60 s) that names the method, path and query, body hash, country, permission and actor. The country checks all of it again. |
| Storefront → country database | The storefront server | A database role per request: `anon`, `authenticated` (with the customer's id) or `service_role` for signed admin requests. Row Level Security and function grants decide the rest. |
| Internet → Supabase API | Anyone with the public anon key | Only what `anon` and `authenticated` are granted. Treated as a public surface in its own right, not as "behind the storefront". |

The browser never talks to Supabase. Forms post to server actions, which
call Supabase on the server.

## 2. Identity and sessions

| Control | Where |
|---|---|
| Customer identity is verified with the Auth server on every use (`getUser`), never read from a cookie alone | `frontend/src/features/auth/server.ts`, `frontend/src/proxy.ts` |
| Customer session cookies are HttpOnly, SameSite=Lax, and Secure in production; the header reads a separate hint cookie that holds no token | `frontend/src/features/auth/cookies.ts`, `sessionHint.ts` |
| Only same-site paths are followed after sign-in or an email link | `frontend/src/features/auth/next.ts` |
| Email links: only sign-up confirmation and password reset are exchanged | `frontend/src/app/auth/confirm/route.ts` |
| Password rule: 8 to 72 characters with a letter and a digit | `frontend/src/features/auth/rules.ts` |
| Sign-in, sign-up, password reset and Track Order are limited per target and per client (per server instance) | `frontend/src/features/security/throttle.ts` |
| Same answer whether or not an email has an account (sign-in, reset) | `frontend/src/features/auth/actions.ts` |
| Admin identity verified per request; suspended accounts and revoked sessions stop at once | `admin/src/server/session.ts` |
| Admin cookies HttpOnly, SameSite=Lax, Secure in production | `admin/src/server/supabase.ts` |
| Second factor (TOTP, AAL2) required for Master and Country Super Admin, in the app and again in the admin database | `packages/permissions/src/gate.ts`, `database/admin-migrations/0001_admin_core.sql` |
| No sign-up in the Central Admin: accounts exist only by invitation | `admin/src/features/admin/actions.ts` |

**Planned:** CAPTCHA on sign-up and reset; a limiter shared by all server
instances; a second factor for every staff role that reads customer data or
changes orders; re-authentication before high-risk admin actions.

## 3. Authorisation

| Control | Where |
|---|---|
| Roles and grants live in the admin database, never in user-editable metadata | `database/admin-migrations/0001_admin_core.sql` |
| Permission catalogue and checks shared by app and tests | `packages/permissions/src` |
| Every admin server action and route handler checks country and permission itself | `admin/src/server/session.ts` (`requireCountry`), each `admin/src/features/*/actions.ts` |
| A Country Super Admin cannot grant a global role, another Country Super Admin, or anything in another country; nobody changes their own role | `actor_may_grant` in `0001_admin_core.sql` |
| The country re-checks permission and country on every signed request | `database/client/src/country-admin/index.ts` |
| Riders reach only deliveries assigned to them | `database/migrations/0008_deliveries.sql` |
| Customers read only their own orders, order lines, profile, payments and photo (Row Level Security) | `database/migrations/0004_orders.sql`, `0005_customer_avatars.sql`, `0007_payments.sql` |
| The delivery code goes only to the signed-in owner of the order | `database/migrations/0020_delivery_code_owner_only.sql`, `frontend/src/features/orders/actions.ts` |

## 4. Database

- Row Level Security is on for every table of the `public` schema
  (`database/client/tests/function-grants.test.ts` fails if one is added
  without it).
- Customers and visitors have no write access to orders, order lines, stock
  or payments. All changes go through functions.
- The stock table is private. What the storefront shows is one number per
  product on sale: the units available, through the `available` column of
  `storefront_products` (migration 0022, owner decision 2026-11-21). The
  count of a draft, hidden or unlisted product is not given out.
- The Global Combined Reports (Central Admin, `/reports`) are built in
  the console from each country's own signed report endpoints; nothing is
  copied into the Central Admin's database. The page, its CSV and the US
  dollar rates (admin migration 0008) are for a Master Super Admin only.
  The rates are typed by hand, audited, and used for reports only.
- The Overview's business figures (Central Admin, `/`) are each country's
  own summary (the one its dashboard shows), asked with a signed request
  when the page is opened and added up in the console. A country is asked
  only if the administrator holds `reports.read` there (checked in the
  console before anything is sent, and by the country on the request).
  Counts are added up; sales stay in each country's currency and are never
  added together or converted on this page. Nothing is stored.
- Notifications (migration 0023) are written by triggers in the
  transaction of the event, never by a request. A customer reads their own
  rows (Row Level Security) and can only mark them read. Staff and riders
  read theirs through the signed country API: three audiences, one
  permission and one endpoint each (orders, stock, the rider's own), the
  reader is the administrator who signed the request, and the tables have
  no grants. A row holds the kind of event and the order or product, with
  no personal data, amount or delivery code.
- Functions that run with their owner's rights pin `search_path`, check the
  caller inside, and use no dynamic SQL.
- The functions a visitor or a signed-in customer can run are an explicit
  list in `function-grants.test.ts`. From migration 0020 a new function is
  closed until it is granted.
- All queries are parameterised (`database/client/src/postgres-db.ts`).
- Money is an integer in the currency's minor unit with an explicit
  currency; prices, totals and stock are computed in the database
  (`place_cod_order`), never taken from the browser.
- Order status moves one step at a time; cancelling puts stock back once;
  the same signed request is applied once.
- The admin database has no grants for `anon` or `service_role`; its audit
  log is append-only.

## 5. Signed country admin API

`apis/src` (contract and token), `admin/src/server/country-api.ts` (client),
`frontend/src/app/api/admin/v1/[...path]/route.ts` and
`database/client/src/country-admin/` (server).

- ES256 tokens, 60 seconds plus 10 seconds tolerance, HTTPS only, no
  redirects followed.
- The token covers method, path with query, SHA-256 of the body, country,
  permission, actor, token id and key id.
- Missing key or data source: the route answers "not found" or "not
  connected" (fails closed).
- Body limits per endpoint; a request limiter per client.
- Writes carry the token id as their request id, so a repeat is a replay,
  not a second change.

## 6. Browser protections

Both apps (`frontend/next.config.ts`, `admin/next.config.ts`):
Content-Security-Policy (`default-src 'self'`, `frame-ancestors 'none'`,
`form-action 'self'`, `base-uri 'self'`, `object-src 'none'`),
`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy`, `Permissions-Policy`, HSTS for two years with
subdomains, no `X-Powered-By`. The admin also sends `X-Robots-Tag: noindex`.

Server actions rely on the framework's Origin check (no
`allowedOrigins` widening). There is no `dangerouslySetInnerHTML`; the two
`innerHTML` uses per map are fixed SVG strings.

**Known gap:** `script-src` still allows inline scripts in both apps. A
nonce-based policy is planned.

## 7. Uploads and media

| File | Limits | Where |
|---|---|---|
| Customer photo | 2 MB; JPEG, PNG, WebP by content, not by name; stored under the customer's own id in a private bucket | `frontend/src/features/account/actions.ts`, `0005_customer_avatars.sql` |
| Product photo, category banner | 1 MB; type checked by content; stored in the database; served with a fixed type, `nosniff` and a sandbox policy | `database/client/src/country-admin/products.ts`, `categories.ts` |
| Delivery proof (photo, signature) | 1 MB; declared type from a fixed list; served with `nosniff` | `database/client/src/country-admin/deliveries.ts` |

## 8. Live delivery tracking

- A rider reports a position only for an order assigned to them, only while
  it is dispatched or on its way, at most once every 10 seconds.
- The customer sees the rider's first name, phone and path only while the
  order is on its way.
- Positions are kept 7 days (see the audit report: the clean-up is not on a
  schedule yet).

## 9. Secrets

- Real environment files are ignored by Git; only `.env.example` with blank
  values is tracked. CI rejects tracked credentials and scans the whole Git
  history with Gitleaks.
- The only public variable is `NEXT_PUBLIC_SITE_URL`.
- Admin server modules import `server-only`; the admin browser tests scan
  the client bundle for secret names and key material.
- The signing key is generated outside the repository
  (`admin/scripts/make-signing-key.mjs`).

## 10. Build and deployment

- `main` is protected: one approval from someone other than the author,
  resolved threads, squash merges.
- CI: lint, typecheck, unit and database tests, build; repository hygiene;
  secret scan; dependency audit (`pnpm audit --prod`, high and critical).
- GitHub Actions are pinned to commit SHAs with read-only permissions; the
  scanner image is pinned by digest.
- Vercel deploys `main` to production. There is no staging environment yet.

## 11. Not built yet

Online payments (a gateway adapter, webhooks, refunds), SAP/POS
integration, saved addresses, invoices, promotions, website content
management, and notifications by email, SMS, WhatsApp or push do not exist
(notifications inside the sites do, migration 0023). Nothing in this file describes
them as protected. Each needs its own threat assessment before it is
built (`CLAUDE.md`, "Security in every change").
