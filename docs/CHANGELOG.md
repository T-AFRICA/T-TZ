# Changelog

Meaningful implementation changes, newest first. Dates are work dates;
nothing below is released.

## 2026-11-03 — homepage commerce polish and Motion micro-interactions

- Search upgraded (owner requests): popular-category shortcuts on focus,
  clear button, red focus ring, bolded match highlighting with section
  chips, Enter opens the top suggestion, "/" focuses search, shorter
  placeholder. Combobox semantics and the FR-006 state tests unchanged.
- Social icons (Facebook/Instagram/TikTok, local lucide-style glyphs —
  this lucide-react dropped brand icons) in the announcement bar with "#"
  PLACEHOLDER hrefs until real profiles are confirmed; desktop header
  action order now wishlist, cart, Login last (owner request).
- Product cards: synthetic numeric TZS pricing with inline was/now prices,
  computed "Save %" badge, green/grey stock line, disabled out-of-stock
  state; CTA renamed Add to Cart, with a quick variant-selection dialog
  for sample products that carry options. Cards compacted; grid now steps
  2/3/4/5/6 columns from phone to wide desktop. New `--color-success`
  token.
- Motion (v14.9) added to the storefront for scroll-reveal sections and
  spring tap feedback on the CTA; lightweight CSS entrances for the mega
  menu, search dropdown and dialogs; 3D pointer-tilt `Tilt3D` primitive on
  card photos (mouse-only). Everything inert under reduced motion.
- Mobile pass at 320-430px: category circles are a native scroll-snap
  carousel below lg (desktop keeps the marquee), tighter section rhythm,
  safe-area-aware page bottom padding, bottom-nav active-tab marker. No
  horizontal overflow at any audited width.

## 2026-11-03 — desktop category marquee

- The desktop category card grid (and its "Shop by category" heading block)
  is replaced by the mobile-style rotating circle marquee, now on every
  breakpoint right after the banner (owner request): larger 96px circles
  from md, four list copies for a seamless loop on ultrawide, 56s duration
  keeping the original drift speed, hover/touch pause and reduced-motion
  stop unchanged.

## 2026-11-03 — desktop merchandising rails

- Two themed product sections added to the desktop homepage ("Light up
  every room", "Fans & cooling"; hidden below md so the approved app-style
  mobile homepage keeps its single product section) with 8 more official
  TRONIC product photos from tronic.co.ke (owner-directed). Prices stay
  synthetic and SAMPLE-tagged until Module 02.
- Product card and merchandising section extracted into reusable
  `ProductCard` / `ProductSection` components with shared sample data in
  `sampleProducts.ts`; `FeaturedSamples` now composes the three sections.

## 2026-11-02 — brand media, motion and §10 primitives

- Hero replaced with the brand's real campaign banner carousel (desktop
  1920×500 + mobile 2:1 artwork from tronic.co.ke, owner-directed):
  full-bleed, autoplay 5s/0.5s fade, pause-on-hover, reduced-motion off,
  accessible CTA label and inset focus ring, 480px desktop height cap.
- Official product photography in "Special for you" (now on desktop too,
  4-up, 8 real products); SAMPLE chips retained for synthetic TZS prices.
- Red announcement bar with rotating ticker; company links moved into the
  red navbar (utility row removed); navbar single-line with white-inversion
  hover and hover-open mega menu; mobile category marquee; drawer premium
  passes (Lucide icons, grey chips with red active, animated reveal).
- Completed master prompt §10 primitives in packages/ui: Input, Textarea,
  Select (shared validation states), Badge, Card, Skeleton, EmptyState,
  ErrorState, Dialog, Tabs, ToastProvider — documented in DESIGN_SYSTEM
  and covered by new Vitest cases (15 tests total).
- Body/UI font is the native system stack (SF Pro on Apple, Segoe UI on
  Windows, Roboto on Android — owner decision, zero font download);
  interface icons are lucide-react. Headings remain Montserrat.

## 2026-11-02 — dependency security updates

- Resolved 10 of 11 Dependabot/pnpm-audit alerts: vitest 3.2.7 → 4.1.12
  (fixes the two critical tinypool prototype-pollution RCEs and three
  @vitest/mocker advisories), pnpm override postcss >= 8.5.18 (two high +
  two moderate sourceMappingURL/stringify advisories via next>postcss),
  scoped override minimatch >= 11.0.1 for @typescript-eslint.
- Accepted residual: @eslint/eslintrc still pins minimatch 3 (moderate
  dev-time DoS, GHSA-g3hv-75wg-m249); forcing 11 breaks ESLint's default
  import, so it waits on the upstream eslintrc release. Lint-time only,
  never shipped to the storefront bundle.
- Premium drawer pass: slide-in motion, white cards on off-white,
  CATEGORIES/QUICK LINKS sections, red icon chips on every row, country +
  Login card. All checks re-run green on vitest 4.

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
