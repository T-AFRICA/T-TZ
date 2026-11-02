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
- Premium visual refinement pass (UI/UX redesign prompt): two-column
  editorial hero with in-house SVG product illustrations (floodlight, cable
  coil, breaker — tagged "Illustration" pending approved photography),
  carousel controls moved to a non-overlapping bottom bar, display type
  capped at 56px, category tiles rebuilt with media areas and per-category
  stroke illustrations, support phone moved to the utility row, compact
  announcement bar, footer column polish, `prefers-reduced-motion` support.
  Verified at 360/768/1440/1920 plus lint/typecheck/tests/build.
- Mobile app-style homepage (owner-supplied UI reference): centred logo with
  circular menu/notification chips, grey search pill with leading icon,
  light rounded hero card, horizontally scrolling category circles,
  SAMPLE-labelled "Special for you" product cards (synthetic TZS prices, no
  fabricated ratings/discounts), and a fixed bottom tab bar
  (Home/Categories/Wishlist/Cart/Profile, no fake badge counts). Desktop
  layout unchanged from md upward. Second pass to match the reference: page
  sits on off-white (#F5F5F5) below md with white floating cards and chips
  (soft shadows, no borders), white search pill with leading search icon and
  trailing filter-style control, white hero card, white category circles.
- Body/UI font switched from Poppins to Inter (owner decision: SF Pro look;
  SF Pro itself is Apple-proprietary and cannot be embedded on the web).
  Montserrat headings unchanged.
- Supporting surfaces polished: branded 404 page, premium "page is on the
  way" placeholder (icon, copy, home/departments CTAs), mobile drawer with
  brand mark header and Meter pill, app-consistent shadow cards on mobile
  category pages.
- Category landing pages redesigned: alt-surface header band with breadcrumb
  and watermark illustration, group cards with icon chips (honest
  "coming soon" copy), cross-navigation pills to other departments. Meter
  page: dark service header plus an SRS-accurate three-step "how it will
  work" explainer — still no payment/cart elements.
