# TRONIC security audit report

Audit date: 2026-11-21. Scope: the whole repository at `main` plus
`fix/admin-reports-look` (`frontend/`, `admin/`, `apis/`, `packages/`,
`database/`, workflows and configuration). `backend/` holds only READMEs.

How it was done: every migration, server action, route handler, the
session and signing code, the workflows and the manifests were read; the
findings were then checked against the code again before anything was
changed; `pnpm audit` was run against the lockfile. No test was run
against the live site, the live Supabase projects, GitHub settings or
Vercel settings, and no environment file was opened. Anything that depends
on those is marked **not verified**.

This report does not say the application is secure. It lists what was
found, what was fixed, and what is still open.

## 1. Summary

| Severity | Found | Fixed in this change | Open |
|---|---|---|---|
| Critical | 0 | 0 | 0 |
| High | 1 | 1 | 0 |
| Medium | 12 | 5 (F-01 needs an owner action to complete; F-04 is partly fixed) | 7 |
| Low | 14 | 3 | 11 |
| Informational | 2 | 0 | 2 |

No credential was found in the tracked files or anywhere in the Git
history. No way was found for one customer to read another's data, for one
country's staff to reach another country, or for a browser to set a price,
a total or a payment state.

Production security status: **Ready With Limitations** for browsing and
Cash on Delivery orders, on condition that owner action O1
(`SECURITY_CHECKLIST.md`) is done. **Not Ready** for online payments,
SAP/POS or meter tokens, which are not built.

## 2. Findings fixed in this change

### F-01 The rider could read the customer's delivery code (Medium; High once goods are prepaid)

- **Where:** `database/migrations/0008_deliveries.sql` (`customer_delivery_code`,
  open to `anon`); `frontend/src/features/orders/actions.ts`.
- **Cause:** the code was given for an order number plus the checkout phone
  or email. The rider is shown both for their delivery, and staff see both.
- **Impact:** a rider could fetch the code from the public Track Order
  form, or straight from the Supabase API, and mark an order delivered
  without meeting the customer. The code proved nothing.
- **Fix:** Track Order no longer returns the code; it tells the customer it
  is in their account. Migration `0020_delivery_code_owner_only.sql` makes
  the function answer only the signed-in owner and removes `anon`'s right
  to run it.
- **Verified by:** `database/client/tests/deliveries.test.ts` (a visitor is
  refused; another signed-in customer with the right phone gets nothing;
  the owner gets the code), `frontend/src/features/orders/actions.test.ts`,
  `admin/e2e/rider.spec.ts`.
- **Still needed:** owner action O1. Until 0020 runs on the live database
  the function there still answers the public key.

### F-02 Known vulnerability in the map library (High)

- **Where:** `maplibre-gl` 5.24.0 in `frontend/` and `admin/`
  (GHSA-jrc7-96c5-q579, rated critical by the advisory: the library's HTML
  sanitiser for attribution text could be bypassed).
- **Impact:** if the map tile provider's attribution text were tampered
  with, a script could run on the customer tracking page and on the admin
  delivery page. Rated High here because it needs that third party to be
  compromised.
- **Why it was missed:** Dependabot is set to ignore major versions and the
  fix is in version 6; nothing ran `pnpm audit`.
- **Fix:** upgraded to 6.16.0 in both apps. The lockfile change touches
  only this library and its own dependencies.
- **Verified by:** `pnpm audit` reports no known vulnerabilities; typecheck
  of both apps; both browser suites (which open the maps).

### F-03 Customer session cookies were readable by scripts and not marked Secure (Medium)

- **Where:** `frontend/src/features/auth/server.ts`, `frontend/src/proxy.ts`.
  The comment said "httpOnly"; the library's default is not.
- **Impact:** any script injected into a page could read the access and
  refresh tokens, and a password can be changed without the old one, so
  that would be a full account takeover.
- **Fix:** the cookies are now HttpOnly, SameSite=Lax and Secure in
  production (`frontend/src/features/auth/cookies.ts`). The header's
  "Account / Login" label reads a separate cookie that holds no token.
- **Verified by:** `frontend/src/proxy.test.ts`,
  `frontend/src/features/auth/sessionHint.test.ts`, header and bottom
  navigation tests, the storefront browser suite.
- **Note:** a browser that is already signed in keeps its old cookie until
  the session is next refreshed on an account page.

### F-04 No attempt limits on sign-in, sign-up, password reset or Track Order (Medium, partly fixed)

- **Where:** `frontend/src/features/auth/actions.ts`,
  `frontend/src/features/orders/actions.ts`. Supabase's own per-address
  limits see the server's address, not the visitor's.
- **Impact:** unthrottled password guessing, email flooding, and guessing
  the phone number that goes with a known order number.
- **Fix:** `frontend/src/features/security/throttle.ts` limits each form
  per target (email or order number) and per client: 20 sign-ins, 5
  sign-ups, 3 resets and 20 tracking tries per target in 10 minutes.
- **Verified by:** `frontend/src/features/security/throttle.test.ts`,
  `frontend/src/features/auth/actions.test.ts`,
  `frontend/src/features/orders/actions.test.ts`.
- **Still open:** the counts are kept in memory per server instance, so
  they slow an attacker rather than stop one, and anyone can use up the
  tries for an address they know. A shared limiter or an edge rule (O6)
  and CAPTCHA (O2) are needed. The database function behind Track Order
  does not count tries itself (F-12).

### F-05 One small request could trigger about 250 database queries (Medium)

- **Where:** `frontend/src/features/checkout/actions.ts`
  (`getCheckoutQuote`, open to visitors), `database/client/src/catalog.ts`.
- **Cause:** a quote of 50 lines reloaded the whole catalogue 50 times in
  parallel, against a small connection pool.
- **Fix:** calls that arrive while a catalogue read is under way share it,
  so a quote is one read. Nothing is cached: the next quote reads again.
- **Verified by:** `database/client/tests/catalog-client.test.ts`.
- **Still open:** the quote itself has no attempt limit (O6).

### F-06 The email-link route accepted link types the site never sends (Low)

- **Where:** `frontend/src/app/auth/confirm/route.ts`.
- **Impact:** a crafted magic-link or invitation URL could sign a victim
  into the attacker's account, where the victim's address would then be
  saved.
- **Fix:** only sign-up confirmation and password reset are exchanged.
- **Verified by:** `frontend/src/app/auth/confirm/route.test.ts`.

### F-07 A new database function would be open to everyone by default (Low)

- **Where:** `database/migrations/0003_catalog_security.sql` line 172: a
  per-schema default cannot remove PostgreSQL's built-in right for
  everyone.
- **State before:** nothing was exposed, because every existing function
  carries its own revoke. The next one without it would have been callable
  with the public key.
- **Fix:** migration 0020 closes the default; a test lists exactly which
  functions a visitor and a signed-in customer can run, and checks that
  every table has Row Level Security and every privileged function pins
  its search path.
- **Verified by:** `database/client/tests/function-grants.test.ts`.

### F-08 Nothing checked dependencies for known vulnerabilities (Medium)

- **Where:** `.github/workflows/`, `.github/dependabot.yml`.
- **Fix:** a "Dependency audit" job runs `pnpm audit --prod --audit-level
  high` on every push and pull request.
- **Still needed:** it is not a required check until the owner adds it
  (O4).

### F-09 Licensed fonts could be committed to the public repository by accident (Low)

- **Where:** the untracked `myriad-pro/` folder was not ignored.
- **Fix:** added to `.gitignore`.

## 3. Open findings

Each needs an owner decision, a setting outside the repository, or its own
piece of work. None was changed here.

| # | Severity | Finding | Where | Recommended |
|---|---|---|---|---|
| F-10 | Medium | Any registered account can place unlimited unpaid Cash on Delivery orders (50 lines of 99 units each; 500 each from migration 0021, an owner decision of 2026-11-21 that makes this finding more pressing), reserving stock until staff cancel them. The exact stock count, which at the audit only leaked through this function's refusal, is public from migration 0022 (owner decision 2026-11-21: the storefront shows it), so someone can see exactly how much to reserve. | `place_cod_order`, `0004_orders.sql`, `0021_order_quantity_500.sql`, `0022_storefront_stock_count.sql` | A cap on open unpaid orders per account and phone. Needs the owner's number. |
| F-11 | Medium | An Order Manager can move an order from "on its way" to "delivered" from the office: no code, proof or cash, and Cash on Delivery becomes paid. The role signs in with a password only. | `admin_update_order_status`, `0006_order_admin.sql` | When a rider is assigned, allow "delivered" only through the rider's hand-over, or require a separate permission and a reason. |
| F-12 | Medium | Order number plus checkout phone or email shows the rider's first name and phone, up to 200 rider positions and the customer's shared location. The database does not count tries, so calling the Supabase API directly avoids the storefront's limit. | `customer_order_tracking`, `0013_delivery_point.sql`; `track_order` | Show the map and the customer's location only to the signed-in owner; count tries per order in the database. |
| F-13 | Medium | Only Master and Country Super Admin need a second factor. Order Manager, Customer Support and Finance read customer data or change orders with a password. | `roles.requires_mfa`, admin `0001_admin_core.sql` | Require a second factor for every staff role, or at least those with `customers.read` or `orders.update`. |
| F-14 | Medium | The build and test job is not a required check, `main` deploys to production automatically, the browser suites are not in CI, and there is no staging. | `protect-main` ruleset, `vercel.json` | O4 and O10. |
| F-15 | Medium | The Content-Security-Policy of both apps allows inline scripts, so it would not stop an injected script. | `frontend/next.config.ts`, `admin/next.config.ts` | A nonce-based policy set in `proxy.ts`. Needs care with Next.js streaming and the font kit. |
| F-16 | Medium, not verified | Linking guest orders and accepting admin invitations trust that an email is verified. That holds only if "Confirm email" is on and, in the admin project, sign-ups are off. Orders of a deleted account become guest orders that the same email can claim again. | `0014_claim_guest_orders.sql`, admin `0004_admin_phone.sql` | O2 and O3; mark orders that were placed as guest and claim only those. |
| F-17 | Low | Audit gaps: CSV downloads, customer and proof views, sign-in and second-factor events and rejected signatures are not recorded; a country change is recorded afterwards in a second database and a failure only reaches the server log. | `admin/src/features/*/actions.ts`, `reports/export/route.ts` | Record exports and personal-data reads; write an intent row before the country call. Needs an admin migration. |
| F-18 | Low | The admin sign-in limit, the country API limit and its replay memory are per server instance. Eight wrong sign-ins lock a known admin address out for ten minutes on that instance; a captured read request can be replayed on another instance for about 70 seconds. | `admin/src/server/rate-limit.ts`, `frontend/src/features/admin-api/service.ts` | A shared store (already noted in the code as a release gate). |
| F-19 | Low | The country admin API reads the request body before it verifies the signature. | `frontend/src/app/api/admin/v1/[...path]/route.ts` | Verify first, then read with a hard cap. |
| F-20 | Low | Delivery proof images are accepted by their declared type, not their content. They are served with a fixed type and `nosniff`, so the effect is small. | `database/client/src/country-admin/deliveries.ts` | Reuse the content check used for product photos. |
| F-21 | Low | Rider positions older than 7 days are removed only when a new position is saved. | `0012_live_tracking.sql` | A scheduled job, or remove the path when the order is delivered. |
| F-22 | Low | `service_role` can still write orders, order lines and stock directly, so a leaked service credential would bypass the order rules and history. | `0003`, `0004` | Revoke direct writes; keep reads. |
| F-23 | Low | Storefront server modules do not import `server-only`. Nothing leaks today. | `frontend/src/features/data/source.ts`, `auth/server.ts`, `admin-api/service.ts` | Add the import and a test alias. |
| F-24 | Low, not verified | Sign-up says "an account with this email already exists" if Supabase reports it, which it does when "Confirm email" is off. | `frontend/src/features/auth/service.ts` | Answer as for a new registration; O2. |
| F-25 | Low | Admin database: a Country Super Admin can overwrite the name and phone of anyone holding the Rider role in their country; a permission holder can add audit lines for changes that did not happen; any signed-in admin user can add unlimited security events. | admin `0004_admin_phone.sql`, `0007`, `0001` | Tighten each function. |
| F-26 | Low | No `SECURITY.md` or private reporting address; no static security analysis (CodeQL or Semgrep). | repository | O8 and O9. |
| F-27 | Low | Toolchain: no Node version pinned in CI; `eslint-config-next` is a major version behind `next`. | `.github/workflows/ci.yml`, package manifests | Pin Node; align the lint config. |
| F-28 | Info | Documentation has drifted: `database/migrations/README.md` calls migrations drafts that the live site depends on; `docs/PROGRESS.md` predates the Supabase project. | docs | O7. |
| F-29 | Info | One signing key serves every country and each country accepts one key id, so a key cannot be rotated with an overlap. The storefront connects as the database owner and relies on switching role per request. `WEB_ORIGIN` falls back to localhost if unset. HSTS has no `preload`. | `admin/src/server/country-api.ts`, `database/client/src/db.ts`, `frontend/src/features/auth/server.ts` | Plan key rotation and a least-privilege database user before more countries are connected. |
| F-30 | Low | Notifications (migration 0023, added 2026-11-23) are never removed, so the two tables grow with every order, status change and stock crossing. Reads are bounded (newest 50 for a customer, 30 days for staff), so pages stay fast, but nothing prunes old rows. The unread counts are asked about once a minute per open page: for a customer one session check and one count query, for an administrator one signed request to the country per audience. There is no limit on how often a signed-in caller may ask the count endpoints. | `database/migrations/0023_notifications.sql`, `frontend/src/app/api/account/notifications/unread/route.ts`, `admin/src/app/(console)/c/[country]/notifications/count/route.ts` | A scheduled clean-up (for example rows older than 180 days) once a job runner exists; edge rate limits (O5) cover the endpoints. |
| F-31 | Info | Notifications are shown inside the sites only. No email, SMS, WhatsApp or push is sent, so a customer who is not looking at the site is not told that the rider is on the way, and a rider is not alerted to a new delivery unless the console is open. | product | Choose a provider (an owner decision with a cost), then send from the same events. |

## 4. Controls, by how sure we are

### Implemented and verified by an automated test

| Control | Test |
|---|---|
| Customers read only their own orders, lines, profile and photo | `database/client/tests/orders.test.ts`, `customer-portal.test.ts`, `customer-avatars.test.ts`; `frontend/e2e/account-portal.spec.ts` |
| Prices, totals and stock decided in the database; idempotent order placement; no order without an account | `orders.test.ts`; `frontend/e2e/order-flow.spec.ts` |
| Order status steps, cancellation returns stock once, signed requests applied once | `order-admin.test.ts` |
| Delivery: rider scope, code lock after five tries, proof limits, code only for the owner | `deliveries.test.ts` |
| Public and customer function list, Row Level Security on every table, pinned search paths, closed default | `function-grants.test.ts` |
| Stock count public only for products on sale; the stock table unreadable and unwritable for visitors and customers (added with migration 0022) | `storefront-stock.test.ts` |
| Notifications: written only by the event, a customer's own only, read marks per owner, staff audiences per permission, a rider's own only, no customer details in a row (added with migration 0023) | `notifications.test.ts`; `frontend/src/features/account/notifications.test.ts`; `admin/src/features/notifications/notifications.test.ts`; `frontend/e2e/account-portal.spec.ts`; `admin/e2e/staff-notifications.spec.ts` |
| Admin roles, grant rules, suspension, append-only audit log, no access for `anon` | `admin-core.test.ts`; `packages/permissions` tests |
| Second factor for super roles; country isolation; suspension mid-session; sign-out and revoked sessions | `admin/e2e/console.spec.ts`, `orders.spec.ts` |
| Signed token: method, path, body, country, permission, expiry | `apis` `service-token.test.ts`; `frontend/e2e/admin-api.spec.ts` |
| Session proxy, HttpOnly cookie options, hint cookie | `frontend/src/proxy.test.ts`, `sessionHint.test.ts` |
| Safe redirects, generic sign-in and reset answers, attempt limits | `frontend/src/features/auth/actions.test.ts`, `throttle.test.ts` |
| Email-link types | `frontend/src/app/auth/confirm/route.test.ts` |
| Photo upload: size and content type | `frontend/src/features/account/photo.test.ts` |
| Search limits | `frontend/src/app/api/search/route.test.ts` |
| CSV formula guard; report permission | `admin/src/features/reports/reports.test.ts`; `admin/e2e/reports.spec.ts` |
| No secret names or key material in the admin browser bundle | `admin/e2e/console.spec.ts` |
| No tracked credentials; history secret scan | `.github/workflows/security.yml` |

The browser suites (`frontend/e2e`, `admin/e2e`) are run by hand, not in
CI.

### Implemented, with no automated test

- Security headers and Content-Security-Policy of both apps.
- Cache headers on product media.
- HTTPS-only, no-redirect calls from the admin to a country.
- Body limits of the country admin API.
- The 7-day clean-up of rider positions.

### Depends on settings outside the repository (not verified)

- Supabase Auth settings of both projects (O2, O3).
- Which migrations are applied to the live database (O1, O7).
- The `protect-main` ruleset, Dependabot alerts, Vercel environment
  variables and project settings.
- Backups and their restoration (O11).

### Planned

Shared rate limiter and edge rules, CAPTCHA, nonce-based
Content-Security-Policy, second factor for all staff, re-authentication for
high-risk admin actions, full audit coverage, code scanning, staging,
alerting and an incident procedure, and everything for payments, SAP/POS
and meter tokens.

### Missing or vulnerable

The open findings in section 3.

## 5. Checks run for this change

Run on the working tree on 2026-11-21, on a development machine, against
disposable databases and stand-ins only.

| Check | Result |
|---|---|
| `pnpm run lint` | Passed |
| `pnpm run typecheck` (10 packages) | Passed |
| `pnpm run test`: storefront | 279 passed |
| `pnpm run test`: database (all 20 country migrations and the admin migrations on PGlite) | 171 passed |
| `pnpm run test`: admin, API contracts, permissions | 33, 20 and 21 passed |
| `pnpm --filter @tronic/storefront run e2e` | 50 passed, 4 skipped (the audit sweeps, which run only on request), 0 failed |
| `pnpm --filter @tronic/admin run e2e` | 26 passed |
| `pnpm audit` and `pnpm audit --prod --audit-level high` | No known vulnerabilities |

The first storefront browser run had one failure: a test that expected
Track Order to show the delivery code. That was the behaviour F-01
removes; the test now asserts the code is not shown.

Not run: `pnpm run build` on its own (both browser suites build each app),
the new "Dependency audit" job on GitHub (it runs when this is pushed),
any scanner against the live site, and no check of live Supabase, GitHub
or Vercel settings.
