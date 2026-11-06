# Changelog

Meaningful implementation changes, newest first. Dates are work dates;
nothing below is released.

## 2026-11-06 — premium mobile product information panel

- Tighter editorial hierarchy on the product page: compact breadcrumb with
  quiet separators, 10px brand/category metadata, a 24px product name and a
  28px price with the was-price and Save badge on its baseline.
- Availability, SKU and the demo marker share one line. The marker is now a
  discreet dashed chip with an amber dot (and a tooltip) instead of a grey
  banner; it stays for as long as demo prices and stock are active.
- Quantity is one unified pill: a quiet minus, the count, and a filled red
  plus, each a 40px target inside a 44px pill; the maximum note sits under
  the label instead of pushing the layout.
- Accordion rows (shared ui component) have 15px titles and a chevron disc
  that fills black when open; specification rows show the label muted and
  the value in primary text.
- The accordion is now the WAI-ARIA pattern (heading + button with
  aria-expanded, region with aria-labelledby) and opens with a short Motion
  height-and-fade in every browser; reduced motion shows the content at
  once. Open rows still ship their content in the server HTML. The ui
  package therefore depends on motion (already used by the storefront).
- Sticky purchase bar: compact 36px Buy Now (outline) and Add to Cart (filled) with
  a pressed state each; the page reserves the bar's full height above the
  tab bar, and toasts rise above it instead of covering the buttons.
- Less dead space between the accordions and the reviews block on phones.
- The gallery frame and thumbnails are white instead of grey, so the product
  photo sits on a clean ground; on desktop a hairline ring keeps the frame
  edge visible against the white page.
- Homepage product cards are shorter: the photo area is 4:3 instead of
  square and the text block is a little tighter, so two-up phone grids and
  the 5-6 per row desktop grid show more of the section per screen.
- Each card now has two compact CTAs in one 32px row: Buy Now (outline,
  fixed width) and Add to Cart (filled, fills the rest; in the two-up phone
  grid the label is the cart icon plus "Add"). Both still go to the cart placeholder; the variant
  dialog behaviour is unchanged.
- No data, cart or checkout behaviour changed; still no invented
  specifications or warranty terms.

## 2026-11-06 — crisper, glossier hero scene

- The hero's room frames are re-rendered from the same campaign photograph with
  three-radius detail recovery (edges, structure, clarity) and a slightly
  stronger tone curve, so the rattan slats and cords read crisp instead of soft.
- The polished floor now carries a foreshortened reflection of the shade rims
  and their glow, crisp at the skirting and softening outward, plus a hot core
  in each lamp's pool and a thin specular edge along the skirting.
- The lit frame is encoded at webp quality 93 (about 280KB, was 155KB) and the
  dim frame at 86 (about 79KB), so the optimizer has detail to keep.
- Limitation unchanged: the master is a 1920x500 photograph, so on screens
  wider than about 2000px the scene is still upscaled; a higher-resolution
  master would improve it further.

## 2026-11-06 — spotlight on the hero's slatted wall

- A three-head black wall spotlight (from the owner's product shot) is mounted on
  the slatted wall at the right of the hero on wide screens, with a contact shadow
  and three pools of light down the slats that switch off with the room's lamps.
- Rendered once as lit, dim and glow frames (about 56KB together), placed with
  the same scene-box scale as the mirror and fan. Below xl the stand fan already
  stands in front of that wall, so the spotlight is shown only from xl.

## 2026-11-06 — category rail runs like a news ticker

- The category rail now moves slowly and continuously from right to left on
  every screen size, including large desktops where it used to stand still.
- The loop needs a second copy of the categories in the page, but each copy is
  wider than the screen, so a category is never on screen twice. The copy is
  hidden from screen readers and skipped by the keyboard.
- Hover, touch and keyboard focus pause it. Reduced motion shows one still row.

## 2026-11-05 — compact mobile product information panel

- Phones: the product info is one white edge-to-edge panel with thin dividers.
  Compact breadcrumb, smaller title, price always in TRONIC red, and a dot for
  availability with the SKU beside it.
- Quantity is one pill with 44px buttons. The limit is still the existing cap
  of 10, because the sample data has no stock counts.
- Accordions renamed to Product Overview, Technical Specifications, Delivery &
  Returns and Warranty Information, with height transitions where supported.
  Only known data is listed; the unrelated department groups row is removed.
- The long sample-data paragraph is now a small "Demo price & stock" label. It
  stays visible in production while demo data is active, because the figures
  are synthetic and the site is public.
- Sticky bar: fits at 320px (Add to Cart was cut off), and pages with it now
  reserve its height, so the footer is no longer hidden behind it.
- CSS only, with no Motion import. Cart and checkout behaviour are unchanged.
- Removed an editor temp file committed by mistake next to MobileNav.tsx.

## 2026-11-05 — hero as one showroom; categories no longer repeat

- The hero is now one room: a floor with soft reflections and each lamp's pool
  of light, and a skirting line, so objects have something to stand on.
- Wall-fixed accessories are baked into the room frames with cast shadows and
  shared lighting: 2-gang switch, dimmer, twin 13A socket and a consumer unit.
  Their indicators light with the lamps. The consumer unit holds the official
  TRONIC breaker photo; the plates, enclosure and socket are renders, not
  catalogue products, so the owner should confirm or replace them.
- The mirror has a brass bezel and a contact shadow on the wall. The stand fan
  stands on the floor with a flex to its own wall socket. Below 1280px, where the
  mirror is hidden, the fan stands in front of the slatted wall on the right
  instead, without the socket (owner request).
- Category rail: each category now appears once. Below 1280px the row drifts to
  its far end and back; from 1280px all eight fit and it stands still. With
  reduced motion the row can be swiped instead.
- The hero stays pure CSS with no Motion import: it is a server component, and
  CSS covers this animation without adding client JS.

## 2026-11-05 — "Power Every Space" hero

- Hero rebuilt around TRONIC's own campaign photograph of its rattan
  pendants (black-november-pendants, offer text cropped out, wall extended
  left): on desktop the scene fills the banner with white copy over the
  wall. No CSS-painted glows.
- From 1280px the official stand fan stands in the room with a backlit round
  mirror on its left. Neither is shown below that width, because the copy
  needs that part of the wall, though phones still download about 13 KB of
  their small hidden images.
- The fan's body, logo hub and base are cut from its product photo and relit.
  Its blades and guard wires could not be lifted cleanly, so they are drawn to
  match. The blades turn behind the guard: stopped while the room is off,
  about 1.5 turns a second once lit. The mirror is a render, not a catalogue
  product; its LED ring, halo and reflection fade with the lamps.
- Phones (below md) show only the banner, edge to edge with all three
  lamps, and the CTA centred at its base; the headline and text stay for
  screen readers and search engines (owner request).
- The scene frames share one photographic grade (detail and clarity sharpening,
  S-curve, vignette, fine grain) and are served at higher image quality
  (images.qualities now declares 85 and 90).
- hero-room-dim.webp and hero-standfan-dim.webp are pre-rendered from the same
  photographs (lamps off, light cones removed). The loop crossfades dim to
  lit over an 18s cycle while a small pulse runs down each cord.
- Server component with no client JS. The lit frame is the base layer, so
  reduced motion or a failed animation shows the lit static scene, with the
  fan's blades still.
- Limitation: the source photograph is only 500px tall, so the frames are
  upscaled and will look soft on high-density screens until a higher
  resolution master is supplied. Owner to confirm these pendants are sold
  in Tanzania.

## 2026-11-05 — agentic browsing 100 and accessibility 100 (Lighthouse)

- Agentic Browsing 25 → 100 (4/4 audits): /robots.txt, /llms.txt and the
  ARD manifest (/.well-known/ard.json plus ai-catalog.json aliases) are
  now real files — previously the [...slug] catch-all served HTML at
  those paths. robots.txt stays Disallow-all on purpose pre-launch; the
  manifest honestly declares a pre-launch empty agent catalog and points
  to llms.txt, which states that all commercial figures are SAMPLE data.
- Accessibility 93 → 100: toast region given role="region" (bare div may
  not carry aria-label), Add-to-Cart accessible names now start with the
  visible "Add to Cart" text, --color-success darkened to green-700 for
  AA contrast on white, and footer legal lines moved to white/60 on the
  premium-black band.
- Remaining Lighthouse SEO failures are intentional pre-launch state:
  is-crawlable (site-wide noindex until the launch gate) and a dev-server
  false positive on meta-description (the tag is present in SSR output).

## 2026-11-05 — code-review fixes across storefront and ui

- Reveal is now CSS-only (scroll-driven on Chromium via
  animation-timeline: view(), one-shot fade elsewhere, off under reduced
  motion): server HTML never ships hidden sections, closing the root cause
  behind the earlier invisible-gallery regression for every Reveal usage.
- Gallery: a touch swipe no longer also opens the full-screen zoom dialog
  (synthetic click suppressed after a swipe).
- Dialog titles get unique ids via useId (duplicate ui-dialog-title ids
  when several dialogs mounted); SearchBox's "/" shortcut no longer steals
  the key from selects or open dialogs, and aria-controls is set only while
  the results listbox exists; ToastProvider clears auto-dismiss timers on
  manual dismissal and unmount; Tilt3D caches its reduced-motion
  MediaQueryList instead of querying per mousemove.
- AccordionSection promoted into packages/ui (§10 primitive) and reused by
  the PDP; CountrySelector's dead "#" href fallback removed via a
  type-narrowing filter. DESIGN_SYSTEM / PROJECT_MAP / PROGRESS brought
  current (fonts, new primitives, /products route, M01 Done via PRs #5-#6,
  M02 in progress).

## 2026-11-04 — mobile PDP regression fix (SSR-hidden gallery)

- Root cause of the "missing product image / empty space" report: the
  gallery frame's Motion entrance shipped `opacity:0` in the server HTML,
  so until hydration the photo was an invisible grey box. The entrance is
  now a CSS animation (SSR always renders the image visible; the global
  reduced-motion override still applies). Verified in the rendered SSR
  output — no hidden styles remain on the gallery.
- Mobile polish with it: tighter top spacing above the gallery/breadcrumb,
  the sample-data disclaimer reduced to a discreet one-liner (the SAMPLE
  chip stays), and the sticky purchase bar now shows only the price beside
  the CTAs (the name was duplicate information and truncated at 320px).
  Re-audited at 320/375/390/430px — no horizontal overflow.

## 2026-11-04 — self-hosted fonts fix the CI font build failure

- Root cause: the GitHub Actions production build failed inside the
  next/font/google loader ("Cannot read properties of null (reading
  '1')", Next 15.5.x) — a known issue where Google Fonts returns
  extensionless font URLs the loader cannot parse. The build also
  depended on fonts.googleapis.com being reachable at build time.
- Fix: Montserrat 500/600/700 (headings) and Poppins 400-700 (body/UI —
  owner decision 2026-11-04, superseding the interim system-stack body)
  are now self-hosted WOFF2 (latin subset, ~88 KB total) served via
  next/font/local; --font-body is injected so the whole UI picks up
  Poppins through the existing token. SIL OFL 1.1 license texts ship in
  apps/storefront/src/fonts with a provenance README; filenames are
  lowercase for Linux path compatibility. No runtime Google Fonts
  requests remain.

## 2026-11-04 — mobile PDP polish and hydration fixes

- Mobile PDP: gallery shortened to a 5:4 frame (~20% less height, square
  from md), price/discount/stock/SKU sit directly under the title (the
  generic short description moved into the overview accordion on phones),
  tighter option/quantity spacing, swipe-between-images and pagination
  dots wired for multi-image products, and the sticky purchase bar now
  offsets by the device safe-area inset so it can never overlap the tab
  bar. Audited at 320/375/390/430px — no horizontal overflow.
- Hydration mismatches fixed for reduced-motion users: rendered DOM no
  longer branches on useReducedMotion() (SSR cannot know the preference).
  CTA press feedback is plain CSS active:scale (covered by the global
  reduced-motion override), and Reveal/gallery keep constant DOM while
  reduced motion only zeroes Motion transition durations, which never
  serialize into HTML.

## 2026-11-03 — product details page (sample catalogue)

- New `/products/[id]` route over the SAMPLE catalogue: gallery with
  full-screen zoom dialog, wishlist/share controls and a thumbnail rail
  that activates when products gain multiple images; buy box with TZS
  was/now pricing, computed Save badge, stock state, variant pills
  (selection carried in the displayed SKU), quantity stepper (min 1,
  disabled when out of stock), Add to Cart (sample-mode toast) and Buy Now
  (continues to the /cart placeholder — no fake orders).
- Honest content rules upheld: no fabricated ratings, reviews, specs or
  inventory — reviews show an EmptyState, overview/specs state that full
  content arrives with the live catalogue, and no Product JSON-LD is
  emitted while prices are synthetic.
- Accordion sections (overview, specifications, delivery, warranty →
  policy routes), related-products rail, localStorage recently-viewed
  rail; sticky mobile purchase bar above the bottom tab bar; two-column
  desktop. Homepage cards now link titles/images to the PDP. ToastProvider
  mounted in the root layout. 4 new PurchasePanel tests (19 total).
  Audited at 320/375px — no horizontal overflow.
- Restyled to the owner's reference (same day): soft rounded gallery frame
  with prev/next arrows over the image and a thumbnail row below (both
  appear once a product has multiple photos), crossfade image switching,
  breadcrumb + short generic description in the info column, electrical
  option-axis labels on variants ("Color Temperature", "Type" — never
  generic "Options" when the real axis is known), pill quantity stepper,
  and large stacked full-width CTAs.

## 2026-11-03 — cinematic energy hero

- The campaign banner carousel is replaced by a cinematic advertising-style
  hero (owner direction, two iterations in one day): charcoal-to-deep-red
  environment with vignette, copy + "Explore Products" / "Shop Lighting"
  CTAs left, and one large featured TRONIC bulb right, feathered out of
  its studio background inside a warm breathing bloom over a ground
  shadow. A single solid energy wire carries a light packet toward the
  bulb, whose glow peaks as the packet arrives (phase-matched 6s CSS
  cycles); mouse parallax (Motion springs) adds depth. Generic brand copy
  only — no offers or claims. Fixed per-breakpoint heights (no CLS), the
  bulb is the priority/LCP image, and every effect stops under reduced
  motion. Campaign artwork stays in /public/banners for reuse.

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
