# TRONIC project map

What lives where in the `T-AFRICA/T-TZ` monorepo (pnpm + Turborepo).

## Applications

- `apps/storefront` — the customer-facing Next.js (App Router) storefront for
  the Tanzania deployment. The only application so far; `apps/admin` (W05)
  and `apps/api` (W07+) are added in their roadmap weeks.
  - `src/app` — routes: `/` (home), `/categories/[slug]`, `/meter`
    (reserved single Meter page, no payment), `[...slug]` (noindex
    placeholder for W06 content pages).
  - `src/components` — feature-grouped UI: `header/` (Header, Navbar,
    MobileNav), `search/SearchBox`, `country/CountrySelector`, `home/Hero`,
    `footer/Footer`.
  - `src/config/site.ts` — deployment-level display content (announcement,
    support phone, social/company/policy links, placeholder routes).
    Placeholder values are marked and must be replaced before launch.
  - `src/test/setup.ts` — Vitest/RTL setup (jest-dom, cleanup).
  - `public/brand/` — official logo artwork.

## Shared packages (TypeScript source, transpiled by the app)

- `packages/ui` — design tokens (`src/tokens.css`, the single source of
  brand values) and framework-agnostic components/icons.
- `packages/types` — shared domain types (categories, country, search).
- `packages/country-config` — country roster and the Tanzania category
  taxonomy (8 sections + Meter nav item). Countries are isolated
  deployments; `origin` stays null until a country site is live.
- `packages/api-client` — typed `SearchClient` boundary with the mock
  adapter (SAMPLE-labelled results). Live adapters land W09+ behind the
  same types. `packages/validators` is planned alongside real forms.

## API boundaries

All data access goes through `packages/api-client` interfaces. No direct
browser connections to POS, SAP, payment gateways or meter infrastructure.

## Configuration

- Root: `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`,
  `.prettierrc.json`.
- Storefront: `next.config.ts` (transpilePackages), `eslint.config.mjs`,
  `vitest.config.ts` (jsdom + `@/` alias), `postcss.config.mjs`.
- CI: `.github/workflows/ci.yml` (lint → typecheck → test → build) and
  `security.yml` (hygiene + secret scan), actions pinned to SHAs.

## Documentation

- `docs/PROGRESS.md` — module tracker. `docs/DESIGN_SYSTEM.md` — tokens and
  rules. `docs/CHANGELOG.md` — meaningful changes. `docs/ssd/ADR-001` —
  Module 01 foundation decisions.
