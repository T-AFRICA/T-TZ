# TRONIC — architecture audit and migration plan

Status: proposal for owner approval (2026-11-07). Nothing in this document has
been applied; no files were moved. `main` at the time of the audit: `66dc48a`.

This document answers the "existing project architecture optimization" brief.
One correction up front, because the rest of the plan depends on it:

> The brief states the application is already connected to Supabase
> PostgreSQL. **It is not.** The repository contains no Supabase client, no
> database client of any kind, no migrations, no API routes and no server
> actions. Every product, category and search result is static sample data
> behind a typed mock adapter. There is therefore nothing to "reset" and no
> schema to inspect; the database work in this plan starts from an empty
> Supabase project that the owner creates.

## 1. Current project folder tree

```
T-TZ/                                   pnpm + Turborepo monorepo
├── .env.example                        placeholder names only (see §3)
├── .github/
│   ├── CODEOWNERS
│   ├── dependabot.yml                  actions + npm (minor/patch grouped)
│   └── workflows/
│       ├── ci.yml                      lint, typecheck, test, build
│       └── security.yml                repo hygiene + Gitleaks (digest-pinned)
├── CLAUDE.md, rulesd.md                contributor and security rules
├── apps/
│   └── storefront/                     Next.js 16.4.5 App Router, React 19, Tailwind 4
│       ├── next.config.ts              security headers, images.qualities
│       ├── public/                     banners, products, brand, og, robots/llms
│       └── src/
│           ├── app/
│           │   ├── layout.tsx          fonts (Outfit, self-hosted), metadata
│           │   ├── page.tsx            homepage
│           │   ├── products/[id]/      product page (static params from samples)
│           │   ├── categories/[slug]/  category page
│           │   ├── meter/              static Meter service page (no payment)
│           │   ├── [...slug]/          "under construction" catch-all
│           │   └── not-found.tsx
│           ├── components/
│           │   ├── header/ nav/ footer/ country/ search/ motion/
│           │   ├── home/               Hero, cards, sections, BenefitsStrip,
│           │   │                       sampleProducts.ts (the de-facto data layer)
│           │   └── product/            gallery, purchase panel, recently viewed
│           ├── config/site.ts          links, announcements, policy routes
│           ├── fonts/                  outfit-latin-variable.woff2 + OFL
│           └── test/                   Vitest setup (7 files, 23 tests)
├── packages/
│   ├── ui/                             design tokens + components (motion dep)
│   ├── types/                          CategoryGroup/Section, CountryConfig, Search*
│   ├── api-client/                     SearchClient interface + MockSearchClient
│   └── country-config/                 COUNTRIES (TZ active, KE/UG coming), tz categories
├── docs/
│   ├── CHANGELOG.md, DESIGN_SYSTEM.md, PROGRESS.md, PROJECT_MAP.md
│   ├── REVIEW-2026-11-06.md            security + engineering review (untracked)
│   └── ssd/ADR-001-module-01-foundation.md
├── package.json, pnpm-workspace.yaml (apps/*, packages/*), turbo.json
└── tsconfig.base.json
```

Not in the repository: `apps/api`, `apps/admin`, `supabase/`, `prisma/`,
`vercel.json`, any `app/api/**/route.ts`, any `"use server"` file, any
`middleware.ts`/`proxy.ts`.

## 2. Technology and dependency audit

| Area | Current state | Notes |
| --- | --- | --- |
| Runtime | Node >= 20, pnpm 10.34.9 (pinned), Turborepo 2.11 | CI uses `--frozen-lockfile` |
| Framework | Next.js **16.4.5** (merged 2026-11-07 via Dependabot #24), React 19.3 | `eslint-config-next` still 15.x — align to 16 |
| Styling | Tailwind CSS 4, `@tronic/ui` tokens | Outfit typeface, self-hosted |
| Animation | `motion` 14.9 (ui accordion, product gallery) | |
| Icons | `lucide-react` 1.68 | |
| Tests | Vitest 4.1 + Testing Library + jsdom 26 | storefront only; packages have no test runner |
| Lint/format | ESLint 9 (storefront only), Prettier (not enforced in CI) | 98 files unformatted, CRLF mix |
| Data | none — `sampleProducts.ts`, `MockSearchClient` | SAMPLE-labelled, noindex |
| Auth | none | |
| Payments / Meter / POS / SAP | none | `/meter` is a static page by policy |
| Deployment | Vercel from GitHub, deploys `main`; previews per PR | project settings not in repo (§9) |
| Governance | `protect-main` ruleset enforced; CI job not yet a required check | see REVIEW-2026-11-06 |

Type and validation posture: strict TypeScript with `noUncheckedIndexedAccess`;
no runtime validation library (no zod/valibot). `packages/types` holds only
category, country and search types; the product type lives in the storefront
(`SampleProduct`), which is the main boundary to fix.

## 3. Supabase integration analysis

There is no integration to analyse. Evidence:

- `git grep -i supabase|prisma|postgres` over `main` returns nothing outside
  the lockfile-free tree.
- `.env.example` names only placeholders: `DATABASE_URL`, `AUTH_SESSION_SECRET`,
  `PAYMENT_API_KEY`, `PAYMENT_WEBHOOK_SECRET`, `METER_PROVIDER_API_KEY`,
  `WEB_ORIGIN`, `API_PORT`, `DEFAULT_COUNTRY`, `DEFAULT_CURRENCY`. None is read
  by the application; the only `process.env` read is `NEXT_PUBLIC_SITE_URL`
  in `layout.tsx` for `metadataBase`.
- The frontend never fetches or mutates records: pages import
  `sampleProducts.ts` directly and `generateStaticParams` builds every product
  page at build time.

The owner's system design (TRONIC_SSD.pdf) names PostgreSQL with Prisma and
a NestJS API. Supabase PostgreSQL is compatible with that intent (it is
PostgreSQL); the plan below keeps PostgreSQL as the single source of truth and
defers the choice of ORM/query layer to the first schema PR (§8).

Decision needed from the owner before Phase 4: which Supabase project (org,
region, free/pro tier) and whether Supabase Auth is wanted for customers and
admins. Nothing in the repo constrains this.

## 4. Proposed enterprise folder structure

Adapted from the brief to what already exists. Items marked **(exists)** stay
where they are; **(new)** are added when their phase starts; nothing is moved
before Phase 3.

```
T-TZ/
├── apps/
│   ├── storefront/                      (exists) customer frontend — unchanged routes
│   │   └── src/
│   │       ├── app/                     (exists) + cart/, checkout/, account/, orders/,
│   │       │                            track-order/, api/ (route handlers) as built
│   │       ├── components/              (exists) presentation only
│   │       ├── features/                (new, Phase 3) catalog/, cart/, checkout/, orders/
│   │       ├── lib/                     (new) server-only helpers: db client, auth session
│   │       └── config/                  (exists)
│   ├── admin/                           (new, Phase 6) Next.js app: super-admin + country admin
│   └── worker/                          (new, Phase 7/8) SAP/POS sync jobs, outside Vercel
├── packages/
│   ├── ui/                              (exists)
│   ├── types/                           (exists) grows into shared domain types
│   ├── validation/                      (new, Phase 5) zod schemas shared by storefront, admin, worker
│   ├── api-client/                      (exists) typed adapters: mock today, live later
│   ├── country-config/                  (exists) per-country constants
│   ├── permissions/                     (new, Phase 6) roles, scopes, country isolation helpers
│   └── database/                        (new, Phase 4) generated types + query layer for Supabase
├── supabase/                            (new, Phase 4) migrations/, seed.sql, config.toml
├── docs/
│   ├── architecture/                    (new) this plan, ADRs
│   ├── database/ api/ integrations/ deployment/   (new, as each phase lands)
│   └── ssd/                             (exists)
└── .github/workflows/                   (exists)
```

Two deliberate differences from the brief:

- **No `apps/api` (NestJS/Express) in the first phases.** The storefront and
  admin are Next.js apps on Vercel; Route Handlers and Server Actions with a
  shared service layer cover products, cart, checkout, orders, payments and
  admin APIs. A separate long-running service appears only as `apps/worker`
  for SAP/POS synchronisation, which needs persistent connections and retries
  that serverless execution cannot give. The SSD's NestJS API remains the
  option if the worker grows into a full backend.
- **Validation and permissions are packages, not folders inside an app**, so
  the storefront, admin and worker enforce the same rules.

## 5. Existing-to-proposed migration map

| Today | Target | When | Risk |
| --- | --- | --- | --- |
| `apps/storefront/src/components/home/sampleProducts.ts` (data + type + helpers) | type → `packages/types/product.ts`; helpers → `apps/storefront/src/features/catalog/`; data → `packages/api-client` mock catalog | Phase 3 | low; pure moves with tests |
| `packages/api-client` (search only) | add `CatalogClient` (getProduct, listProducts, listByCategory) and later `CartClient`, `OrderClient`; mock + live modes | Phase 3 → 5 | low |
| `formatSamplePrice` hard-coded `TZS`/`en-US` | `packages/country-config` money formatter using country currency/locale; `{ amount, currency }` shape | Phase 3 | low |
| `apps/storefront/src/app/[...slug]` catch-all | allow-listed planned routes; real `cart/`, `checkout/`, `account/` pages replace it | Phase 5 | low |
| `.env.example` placeholders | real variable set per app, validated at startup (`packages/validation/env.ts`) | Phase 4 | low |
| `packages/types` (category, country, search) | + product, variant, price, inventory, cart, order, payment, delivery, user/role | Phase 4 | low |
| no `supabase/` | migrations + seed from the sample catalogue (SKUs, images, descriptions preserved) | Phase 4 | medium: first schema |
| no admin | `apps/admin` on its own Vercel project | Phase 6 | medium: second deployment |
| no worker | `apps/worker` (Node service; host TBD) | Phase 7 | medium: hosting decision |

What never moves: `apps/storefront` as the Vercel root, the approved TRONIC UI
components, public assets and routes, the sample-data labelling until live data
replaces it.

## 6. Backend API strategy

Principle: **one service layer, two transports.**

- `apps/storefront/src/features/<domain>/service.ts` holds business logic
  (pricing, stock checks, order state machine) and is server-only.
- Transports: Server Actions for first-party forms (add to cart, checkout
  steps) and Route Handlers under `app/api/v1/*` for anything called by the
  admin app, the worker, webhooks or future mobile clients. Both validate with
  `packages/validation` and call the same services.
- Database access only through `packages/database` with the service-role key
  on the server; the browser never holds a privileged key. If the anon key is
  used at all, RLS policies must make it safe for read-only public catalogue
  data.
- Payments: provider webhooks land on Route Handlers that verify signature,
  check amount/currency/transaction id, enforce idempotency keys and only then
  transition the order. Timeouts are reconciled, never retried blindly
  (rulesd §4).
- Country isolation: every service call carries a server-derived
  `countryCode` (from the deployment's configuration, never from the request),
  and every table that is country-scoped has a `country_code` column with
  policies and indexes on it.
- When it earns its place: `apps/worker` for SAP/POS sync, scheduled
  reconciliation and retries (BullMQ + Redis as the SSD proposes, or Supabase
  cron + queues if the volume is small). It shares `packages/database`,
  `packages/validation` and `packages/types`.

## 7. Super Admin and Country Admin architecture

- One app, `apps/admin`, deployed as a second Vercel project on an admin
  subdomain; it is never part of the storefront bundle.
- Authentication: Supabase Auth (email + password with MFA for admins) if the
  owner accepts Supabase Auth; sessions are server-verified on every request.
- Authorization: `packages/permissions` defines roles (`super_admin`,
  `country_admin`, later `warehouse`, `support`), scopes (e.g.
  `orders:write`, `products:write`, `settings:write`) and the
  `assigned_countries` claim. Checks run in server code (Route Handlers,
  Server Actions, RLS policies); the UI only hides what the server already
  forbids.
- Country isolation for admins: a country admin's session carries
  `assigned_countries = ['TZ']`; services filter by it and RLS policies on
  admin-facing tables enforce it again at the database.
- Super admin screens: countries, admins and roles, global catalogue config,
  integration monitoring (SAP/POS sync records), audit log, site settings.
- Country admin screens: products, inventory and warehouses, orders and
  delivery workflow, customers (permitted fields), payment reports, content,
  analytics for the assigned country.
- Audit: every privileged write records actor, role, country, entity, before/
  after summary and request id in `audit_logs`; no credentials, tokens or full
  payment details are stored (rulesd §4).

## 8. Database migration recommendations (Supabase PostgreSQL)

Starting point is an empty project, so the first migration defines the core
schema. Proposed tables, grouped; all additive, all with `created_at`/
`updated_at`, integer minor units for money with explicit currency, and
`country_code` wherever data is country-scoped:

- **Reference:** `countries` (code, name, currency, locale, status),
  `currencies` (code, minor_unit — TZS/KES/UGX = 0 decimals),
  `warehouses` (country_code).
- **Catalogue:** `categories` (country_code, slug, parent), `products`
  (sku unique, brand, status), `product_variants`, `product_images`,
  `product_prices` (country_code, variant_id, amount_minor, currency,
  valid_from/to), `product_categories`.
- **Inventory:** `inventory_levels` (warehouse_id, variant_id, on_hand,
  reserved), `stock_movements` (reason, reference, idempotency_key unique).
- **Customers:** `customers` (auth user id, country_code), `addresses`.
- **Commerce:** `carts`, `cart_items`, `orders` (country_code, status,
  totals_minor, currency, idempotency_key), `order_items`, `payments`
  (provider, provider_ref unique, amount_minor, currency, status),
  `payment_events` (raw webhook, signature verified flag), `deliveries`,
  `delivery_events`.
- **Access:** `admin_users`, `roles`, `role_permissions`,
  `admin_country_assignments`, `audit_logs`.
- **Integration:** `sap_sync_records`, `pos_sync_records` (direction,
  entity, external_ref, idempotency_key unique, status, attempts,
  last_error).

Rules: foreign keys and check constraints on every status column; unique
indexes on SKU, provider references and idempotency keys; RLS enabled on every
table with explicit policies (public read on published catalogue rows only;
customers see their own carts/orders; admins by role + country); privileged
writes via the service role from server code only; migrations are forward-only
SQL files under `supabase/migrations`, reviewed in PRs; a `seed.sql` loads the
current sample catalogue so SKUs, images and descriptions carry over; no
destructive migration without explicit owner approval.

## 9. GitHub and Vercel deployment impact

Known from the repository and the GitHub API: Vercel deploys `main` to
production and builds a preview per PR; the status context is "Vercel";
previews sit behind Vercel SSO. **Not in the repository and to be confirmed in
the Vercel dashboard before any restructuring:** the project's Root
Directory (expected `apps/storefront`), install command (expected
`pnpm install --frozen-lockfile`), build command, Node version, and the
environment variables set (names only; `NEXT_PUBLIC_SITE_URL` at least).

Impact of this plan:

- Phases 1–3 and 5 change nothing about the Vercel project: the storefront
  stays at `apps/storefront` with the same routes and assets.
- Phase 4 adds server-side environment variables to the storefront project
  (`DATABASE_URL`/Supabase URL + service-role key, later payment secrets).
  They are added in the dashboard, never committed; `.env.example` lists the
  names.
- Phase 6 adds a **second** Vercel project for `apps/admin` with its own
  domain and variables; the storefront project is untouched.
- Phase 7 adds a worker outside Vercel (host to be decided); no storefront
  impact.
- Rollback: every phase is a normal PR; reverting the PR restores the
  previous deployment. Database changes roll forward (a compensating
  migration), never by resetting the project.
- Owner actions already identified in the review: add the CI job to the
  ruleset's required checks; confirm the production branch and deployment
  protection settings.

## 10. Step-by-step safe implementation plan

Each step is one reviewable PR (or a small series), lands behind the existing
ruleset, and leaves the storefront working and deployable.

**Phase 1 — audit (this document).** Deliverable: owner approval of the
decisions in §3 (Supabase project, Supabase Auth), §4 (no separate API app
yet) and §9 (dashboard values confirmed).

**Phase 2 — architecture design.** Write `docs/architecture/ADR-002-data-and-api-boundaries.md`
and `docs/database/schema-v1.md` (ERD + table list from §8) for review.

**Phase 3 — frontend organisation (no UI change).**
1. Move the product type to `packages/types`; add `CatalogClient` to
   `packages/api-client` with a mock backed by the sample set; routes and
   components consume the client only. Tests for the client and the routes'
   `notFound()` behaviour.
2. Money formatting from `country-config` (currency + locale), with tests for
   TZS/KES/UGX precision.
3. Create `features/catalog` for helpers (related products, discount); keep
   `components/` presentational.

**Phase 4 — Supabase foundation.**
1. Owner creates the Supabase project; names of the variables go into
   `.env.example`; `packages/validation/env.ts` validates them at startup.
2. `supabase/migrations/0001_core.sql` (reference + catalogue + inventory
   tables, RLS enabled, public read policy on published products), `seed.sql`
   from the sample catalogue.
3. `packages/database` with generated types and a server-only client; a
   `CatalogClient` live mode behind the existing adapter; `mock` stays the
   default until the owner flips the deployment variable.
4. Preview deployment reads from Supabase; production stays on mock until
   verified.

**Phase 5 — commerce APIs on the storefront.** Cart (server actions +
`carts` tables), checkout (address, delivery option, order creation with
idempotency key, server-computed totals), order tracking; Route Handlers under
`app/api/v1` for the admin/worker; payment webhook handler in sandbox mode
with signature verification and reconciliation job stub. Replace the
catch-all with real routes.

**Phase 6 — admin app.** `apps/admin`, Supabase Auth, `packages/permissions`,
RBAC + country isolation enforced in services and RLS; super-admin and
country-admin screens in the order: products/inventory → orders/delivery →
payments reports → users/roles → integrations monitor → audit log → settings.
Second Vercel project.

**Phase 7 — single product POC.** One real SKU, sandbox payment provider,
`apps/worker` with SAP and POS adapters as configurable modules (TZ/UG shared
SAP environment, KE separate), idempotent sync records, retries with backoff,
error logging; end-to-end: browse → cart → checkout → sandbox payment →
order → stock movement → SAP/POS sync record → delivery status.

**Phase 8 — scaling.** Full catalogue import, per-country deployments (KE,
UG) from the same codebase via deployment configuration, reporting, and the
release gates in rulesd §7.

Nothing from Phase 3 onward starts without the owner's approval of this plan.
