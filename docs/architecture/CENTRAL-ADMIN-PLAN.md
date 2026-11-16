# TRONIC Central Admin — analysis, design and status

Written 2026-11-16 against `main` at `c5e8394`, for the "Enterprise
Centralized Admin Management System" brief. It replaces §7 and Phase 6 of
`ARCHITECTURE-AUDIT-AND-PLAN.md`, which predate Supabase Auth, the orders
schema and the five-country requirement.

Status words used here: **built** means in this repository with tests that
were run; **not built** means nothing exists; **owner action** means it
cannot be done from the repository. Nothing in this document has been
deployed, and no Supabase project, Vercel project or domain was created or
changed.

## 1. Existing codebase analysis

| Area | What exists on `main` | Consequence for the admin |
| --- | --- | --- |
| Layout | pnpm + Turborepo. `frontend/` is the storefront; `admin/`, `apis/`, `backend/`, `packages/permissions`, `packages/validation` were README-only skeletons | The brief's `apps/storefront`, `apps/admin` map onto `frontend/` and `admin/`. Nothing is moved |
| Storefront | Next.js 16 App Router, React 19, Tailwind 4, `@tronic/ui` tokens and components, deployed from `main` to tronic.live (Vercel Root Directory `frontend`, region `dub1`) | The admin is a second Next.js app with its own Vercel project. The storefront's routes, components and deployment are untouched |
| Country model | One deployment and one database per country. The storefront takes its country from deployment configuration (`ACTIVE_COUNTRY`), never from the request. `packages/country-config` knows TZ (active), KE and UG | The admin keeps its own country roster in its own database (five countries, Congo unconfirmed). `country-config` is not changed: it describes what a storefront serves |
| Country database | `database/migrations` 0001-0005: catalogue, search, RLS and grants, `stock_levels`, `customer_profiles`, `orders`, `order_lines`, `place_cod_order()`, `track_order()`, avatar storage. Reads run as `anon`/`authenticated` through `withAccess` so RLS applies | The order state model already exists (`pending_payment` → … → `delivered`, `cancelled`). The admin must use it, not define a second one. There is no admin write path in a country database yet: nobody but the owner can change a product, price, stock level or order status |
| Auth | Supabase Auth through `@supabase/ssr`, server-only (the browser never talks to Supabase), sessions in httpOnly cookies, `proxy.ts` refreshes them. Customers only | The same pattern is reused for administrators, against a different Supabase project, with no sign-up call |
| APIs | `frontend/src/app/api/search/route.ts` only. Everything else is Server Actions. No admin endpoint exists | "Country API" endpoints have to be built in the storefront as their own workstream (§6, phase 7) |
| Tests | Vitest (storefront, database on PGlite with a Supabase shim), Playwright (storefront, own build folder, fake Auth) | The admin follows the same three layers |
| CI and rules | `ci.yml` (lint, typecheck, test, build), `security.yml` (hygiene, Gitleaks), `protect-main` ruleset. E2E is not in CI | New packages join CI automatically through Turborepo. The admin's browser tests are run by hand, like the storefront's |
| Supabase (owner-reported, 2026-11-14) | One project, Ireland, used by Tanzania: auth on, migrations 0001-0004 and the SAMPLE catalogue applied | That project is Tanzania's country project. The Central Admin needs a **separate** project |

Breaking changes identified: none for the storefront. Shared files changed
by this work: `packages/ui` (18 icons added), the test-only Supabase shim
(`auth.users.email_confirmed_at`, `auth.jwt()`), `turbo.json` (admin
variable names), `.env.example`, the lockfile.

## 2. Development structure

```
admin/                         Central Admin application (Next.js), own Vercel project   BUILT (foundation)
  src/app/(auth)               sign-in, second factor, no-access notice
  src/app/(console)            overview, countries, administrators, audit, security,
                               c/[country]/{dashboard, staff, settings, [module]}
  src/server                   config, session and guards, database pool, country API adapter
  src/features                 gate, navigation, validation, labels, server actions
  e2e                          Playwright tests, fake Auth, disposable stack, local preview
apis/                          @tronic/api-contracts: signed service requests, country admin API v1   BUILT (health only)
packages/permissions/          @tronic/permissions: roles, permissions, decisions        BUILT
database/admin-migrations/     Central Admin database (its own Supabase project)         BUILT (0001)
database/migrations/           country database (unchanged; the brief's country-migrations)
database/client/src/admin/     server-only query layer of the admin database             BUILT
frontend/                      storefront (unchanged)
backend/worker, packages/validation   still skeletons (POS/SAP/Redis are out of scope)
```

Deliberate differences from the brief's suggested tree: no `apps/` folder
(the repository already has `frontend/` and `admin/`), `api-contracts` lives
in the existing `apis/` folder, the admin's zod schemas live in the admin
(nothing else uses them yet), and there is no `infrastructure/` folder
because nothing would be in it.

## 3. Central Admin database

One migration, `database/admin-migrations/0001_admin_core.sql`. It is for
the Central Admin project only and holds no customer, order, product or
stock data.

| Table | Purpose |
| --- | --- |
| `countries` | The roster. `id` is a stable key (`tz`, `ke`, `ug`, `rw`, `congo`), not the ISO code, so Congo can be listed with `iso_code`, `currency` and `timezone` null. A check constraint refuses `active` without all three |
| `country_service_registry` | Per country: API address (HTTPS only), Vercel project, Supabase project reference, enabled. References only, never a key |
| `permissions`, `roles`, `role_permissions` | The catalogue, mirrored from `packages/permissions` (a test compares them) |
| `admin_profiles` | One per administrator (`auth.users` id, email, status active/suspended, suspension reason) |
| `admin_role_assignments` | Role + country per person; the global role has no country (trigger-enforced). Revoked rows are kept |
| `admin_invitations` | A role offered to an email address, seven days |
| `audit_logs` | Append-only (triggers refuse update, delete and truncate, even for the owner) |
| `security_events` | Refused attempts |
| `country_health_checks` | Result of each real request to a country service |

Folded or deferred, with reasons: `admin_country_assignments` is the
`country_id` column of `admin_role_assignments` (a separate table could
disagree with it); `integration_status` is derived from the registry and the
latest health check; `admin_notifications` and `system_settings` are added
with the features that use them.

Access rules, all tested as the `authenticated` role on PGlite:

- RLS on every table; `anon` and `service_role` have no grants at all;
  `authenticated` has `select` only, filtered by policies.
- No table is writable. Changes go through ten functions (`invite_admin`,
  `revoke_admin_role`, `set_admin_status`, `update_country`, …) that check
  the caller, refuse escalation and write the audit log in the same
  transaction.
- `app_private.admin_id()` is null for an unknown or suspended account, an
  account without roles, or a super admin whose session is not at `aal2`.
  Every policy and function starts from it, so suspension takes effect on
  the next statement, whatever the session token says.
- `app_private.provision_master_super_admin(email)` is the only way to
  create a Master Super Admin, and no API role can execute it.

## 4. Roles and country permissions

Source of truth: `packages/permissions/src/catalogue.ts`.

| Role | Scope | Given by | Second factor | Permissions |
| --- | --- | --- | --- | --- |
| Master Super Admin | global | provisioning step only (database owner) | required | everything, in every country, plus the five `global.*` permissions |
| Country Super Admin | one country | Master Super Admin | required | all 22 country permissions in that country |
| Product, Inventory, Order, Content, Marketing Manager; Finance / Reporting Viewer; Customer Support | one country | Master Super Admin, or whoever holds `staff.manage` in that country | not required | a subset (see the catalogue); none includes `staff.manage` or `settings.update` |

Rules enforced in `authorize.ts` and again in the database: a permission is
always checked with a country; nobody changes their own roles; a Country
Super Admin cannot create a Country Super Admin; suspension is for a Master
Super Admin only, never on themselves or on another Master Super Admin; an
invitation is re-checked against its inviter when it is accepted.

Three layers check every action: the server action (session, zod, the
functions above), the database function, and RLS on what is read back.

## 5. Admin interface

- Shell (`components/shell/Shell.tsx`): collapsible black sidebar with the
  red wordmark, sticky header with the country switcher, theme switch
  (device, light, dark; stored in a cookie and rendered on the server) and
  account menu; a drawer on screens under 1024px. Navigation is built from
  the administrator's permissions (`features/nav.ts`).
- Pieces (`components/ui.tsx`, `forms.tsx`, `people.tsx`): page header,
  panel, stat card, unavailable figure, status pill, data table with
  sideways scroll inside its panel, pagination, form fields with inline
  errors, confirmation dialog, toasts (from `@tronic/ui`), skeleton, empty
  and error states.
- Reused from `@tronic/ui`: brand tokens, type stacks (Myriad Pro through
  the owner's Adobe Fonts kit, Arial Black for the few display headings),
  the logo, icons, toast provider, skeleton. The storefront's white-surface
  components (Card, Input, Dialog) are not reused because they cannot follow
  a dark theme; the storefront's look is unchanged.
- Not present on purpose, because nothing behind them exists yet: global
  search, a notification centre, charts. The brief forbids decorative
  controls; they come with the data they need.

## 6. Country API contract

`apis/src`. The Central Admin never connects to a country database:

```
browser → admin server (session, role, country checked)
        → signed HTTPS request → country backend (verifies it independently)
        → country database
```

- Each request carries an ES256 JSON Web Token (`jose`), valid 60 seconds,
  signed with a private key held only by the admin deployment. A country
  holds the public half, so a compromised country cannot sign for another.
- The token names the country (`aud`, `cty`), the administrator (`sub`), the
  one permission used (`act`) and the method, path and SHA-256 of the body
  (`req`), plus a `jti` for replay protection.
- A country verifies signature, algorithm, issuer, lifetime, its own country
  code, the permission its endpoint requires and that the request is the one
  that was signed. It never trusts a country id in the request.
- The adapter (`createCountryAdminApi`) is HTTPS-only, has a time limit,
  never follows a redirect and never retries. Every failure is a typed
  "unavailable" reason; a country that is not registered, switched off or
  unconfirmed gets an adapter that sends nothing.
- Version 1 has one endpoint, `GET /api/admin/v1/health` (`settings.read`).
  Each module adds its endpoints to this contract together with the
  country-side handler and the admin screen.

**Not built:** the country side. No storefront serves `/api/admin/v1/*`, so
no country can be connected yet, and the admin says so.

## 7. Implementation sequence and status

| Phase | Content | Status |
| --- | --- | --- |
| 1 Audit | This document | built |
| 2 Admin database | `0001_admin_core.sql`, query layer, 37 database tests | built, not applied to any project |
| 3 Authentication and RBAC | Sign-in, second factor, session gate, guards, permissions package | built; proven against a stand-in for Supabase Auth only |
| 4 Console interface | Shell, themes, responsive tables, states | built |
| 5 Master Super Admin | Overview, countries, administrators, audit log, security events, country configuration and service registry | built |
| 6 Country Super Admin | Country dashboard, staff, invitations, country-scoped access | built |
| 7 Country API | Contract, signing, adapter, health check from the admin | admin side built; **country side not built** |
| 8 Products, categories, inventory, orders, customers, CMS | — | not built: pages state that the module is not connected |
| 9 Reports and monitoring | Audit log and health checks only | mostly not built |
| 10 Deployment | — | not done; owner actions below |

### Acceptance tests of the brief

| # | Scenario | Evidence today |
| --- | --- | --- |
| 1 | Master reaches every country dashboard | browser test |
| 2 | Tanzania Super Admin reaches Tanzania only | browser, database and unit tests |
| 3 | Kenya Super Admin cannot read Tanzania customers | permission and database tests for roles, staff, audit and settings; **customer records are not reachable by anyone yet** (phase 8) |
| 4 | Country administrators cannot create or promote Master Super Admins | unit, database and browser tests |
| 5 | Changing the country id does not bypass authorization | browser test (address), database tests (function arguments), token tests (country API) |
| 6 | Admin actions are in the audit log | database and browser tests |
| 7 | Product changes land in the right country database | not testable: phase 8 |
| 8 | Storefront shows published changes after revalidation | not testable: phase 8 |
| 9 | Authentication and sessions | browser tests against the stand-in; **not yet against a real Supabase project** |
| 10 | Suspended accounts stop at once | database and browser tests (same session, no new sign-in) |
| 11 | Missing country connection shows an unavailable state | browser test |
| 12 | No database credential in browser bundles | browser test scans the built client files |
| 13 | Storefront still works | storefront suites rerun (see the changelog entry) |
| 14 | Desktop, tablet, mobile | browser test at 375, 768, 1280 and 1920px |
| 15 | Migrations and deployments can be rolled out and back | not done: nothing is deployed |

## 8. Owner actions and open decisions

1. **Create the Central Admin Supabase project** (separate from every
   country project) and run `database/admin-migrations/0001_admin_core.sql`
   in its SQL editor. In its Auth settings: sign-ups off, email confirmation
   on, secure email change on, TOTP on. Cost: five country projects plus
   this one is more than the two active projects Supabase's free plan
   allowed when this was written; check the current plan before creating
   them. Nothing paid was introduced by this work.
2. **Create the first Master Super Admin**: add that person in the admin
   project's Auth (confirmed email), then run
   `select app_private.provision_master_super_admin('<email>');` in the SQL
   editor.
3. **Create a second Vercel project** with Root Directory `admin`, the
   domain (the brief proposes `admin.tronic.live`) and the variables in
   `admin/README.md`.
4. **Generate the signing key pair** for country requests and store the
   private key in the admin deployment only (command in `admin/README.md`).
5. **How do invited people get their Auth account?** Today an owner adds
   them in the admin project's Auth (or uses Supabase's own invite); the
   console then gives the role on first sign-in. Sending the invitation
   email from the console needs the project's service-role key in the admin
   server, which is a decision for the owner.
6. **Confirm Congo** (which country, ISO code, currency, time zone).
7. **Domains** per country (the brief names `tronic.co.tz` for Tanzania).

## 9. Known limits

- Supabase Auth behaviour (password sign-in, TOTP enrolment and challenge,
  the `aal` claim, session refresh) is exercised only through a test
  stand-in. It has to be verified on the real project before anyone relies
  on it.
- The sign-in rate limiter is in memory per server instance; Supabase's own
  limits sit behind it. A shared limiter is a release-gate item.
- A refused console page answers 200 with a "nothing here" page, not 404,
  because pages are streamed; the content is identical to a missing page.
- Session revocation at the provider is not triggered by suspension. The
  console does not need it (the account is refused on every request), but
  the Auth session itself lives until it expires.
- POS, SAP, Rwanda/Congo ERP and Redis/BullMQ: no code, no interface, no
  status shown, as the brief asks for this phase.
