# ADR-001: Module 01 foundation decisions

Date: 2026-11-02 · Status: Accepted (pending brand-owner items noted below)

## Context

Module 01 (roadmap W01) scaffolds the monorepo and global storefront shell.
Stack and repository layout follow SRS v1.2 §8.1 and SSD §15; brand values
follow the TRONIC Tanzania Brand Guidelines v1.0 and SSD §4.

## Decisions

1. **Layout**: `frontend` plus `packages/ui`, `packages/types`,
   `packages/api-client`, `packages/country-config`, exactly as the SSD
   proposes. `admin` (W05) and `apis` (W07+) are added in their
   build weeks, not scaffolded speculatively.
2. **Source packages**: workspace packages export TypeScript source directly
   (`exports: "./src/index.ts"`) and the storefront transpiles them
   (`transpilePackages`). No per-package build step until one is needed.
3. **Tokens**: all brand values live in `packages/ui/src/tokens.css` as CSS
   variables; Tailwind v4 maps them to utilities via `@theme inline`.
   Card surface is `#F4F5F7` (SRS NFR-11/SSD §4); `#F5F5F5` remains the
   general off-white neutral (brand guide §6) — both exist as tokens.
   Interactive controls use the SSD's proposed accessible red `#D71920`;
   the wordmark red `#EF1C26` is reserved for brand accents.
4. **Typography**: Montserrat (headlines) + Poppins (body) via `next/font`,
   per brand guide §7. SSD lists the pairing as pending formal approval, so
   font families are variables and swappable in one place.
5. **Brand mark**: official logo files are not yet in the repository, and the
   brand guide forbids retyping the wordmark as a logo. `BrandMark` is an
   explicitly labelled placeholder slot to be replaced by the supplied SVGs.
6. **Country model**: the selector displays the deployment's active country
   (Tanzania) and lists other countries; it links only to real origins once
   those deployments exist (SSD AD-02) and never carries authorization.
7. **Mock boundary**: search goes through `packages/api-client`'s
   `SearchClient` interface with a mock implementation whose results are
   synthetic and labelled; the live adapter replaces it in W09+ behind the
   same types.
8. **Pre-launch indexing**: the site sets `robots: noindex` until the
   Tanzania launch gate; SRS NFR-20 SEO work applies from launch.

## Open items

- Official master logo assets (brand guide §11 file list) — needed to replace
  the placeholder mark and favicon.
- Formal sign-off on typography and `#D71920` action red.
- Full subcategory tree from the Website Content Structure document.
