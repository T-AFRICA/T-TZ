# Changelog

Meaningful implementation changes, newest first. Dates are work dates;
nothing below is released.

## 2026-11-02 — Module 01 (unreleased, on feat/module-01-design-system)

- Scaffolded the pnpm + Turborepo monorepo: `apps/storefront` (Next.js 15,
  App Router, strict TS, Tailwind v4) and `packages/ui|types|country-config|
  api-client`; CI workflow (lint/typecheck/test/build).
- Design foundation: brand tokens in `packages/ui/src/tokens.css`,
  Montserrat + Poppins via next/font, fluid type scale, focus ring,
  full-width layout capped at 120rem for ultrawide.
- Global shell: three-tier header (announcement bar, utility row, logo +
  search + Track Order/Meter/phone/Login/Wishlist/Cart), red mega-menu
  navbar (8 categories), mobile drawer, dark footer.
- Homepage: premium dark hero carousel (3 placeholder campaign slides,
  manual navigation), category grid, Meter callout.
- Search shell: accessible combobox over the typed mock `SearchClient`
  (SAMPLE-labelled results, debounced, five explicit states).
- Country handling: selector shows only the active Tanzania deployment;
  other countries hidden until their origins exist (SSD AD-02).
- Official red TRONIC logo artwork added (`public/brand/tronic-logo.png`);
  white footer mark remains an interim rendition.
- Aligned with the engineering master prompt: §4 font weights
  (Montserrat 500–700, Poppins 400–700), §5 tokens (#62666D secondary text,
  #FAFAFA alt surface), §6 ultrawide cap, header wishlist entry, and the
  PROJECT_MAP / DESIGN_SYSTEM / CHANGELOG documents.
- Tests: 12 Vitest component/config tests; manual responsive verification at
  375px and desktop in the browser pane.
