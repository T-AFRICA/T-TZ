# Changelog

Meaningful implementation changes, newest first. Dates are work dates;
nothing below is released.

## 2026-11-12 — typography: Myriad Pro and Arial Black

- Interface font is now Myriad Pro (`--font-primary`: "myriad-pro",
  "Myriad Pro", Arial, sans-serif) for navigation, products, prices, search, buttons, forms,
  cart, checkout, order tracking, footer and headings.
- Arial Black (`--font-display`, `.font-display`) only on the homepage hero
  headline, the "Power Every Space." statement on the account screens and
  the TRONIC Meter banner headings.
- Myriad Pro is served by the owner's Adobe Fonts web project (kit
  `ikx8ykc`: Regular, Semibold and Bold); the CSP now allows use.typekit.net (styles
  and fonts) and p.typekit.net (Adobe's licence page-view stylesheet). Arial
  is the fallback. The desktop Myriad Pro files are not licensed for web
  hosting and stay out of the public repository. Outfit and its self-hosted
  file were removed. Details in `frontend/src/fonts/README.md`.
- Logo, colours, sizes, layouts and animations unchanged. Checked 11 pages
  at 320, 375, 390, 430, 768, 1024, 1440 and 1920px: no horizontal
  overflow; display headlines keep their line breaks.

## 2026-11-11 — mobile cart fits the screen

- Cause found on a 360px screen: the cart's outer grid had an auto column,
  so a cart line's control row (quantity, line total, Remove) kept its
  min-content width and pushed the page to 395px, clipping Remove and the
  subtotal. All cart grids now use minmax(0, 1fr) columns; no
  overflow-x: hidden was added.
- Phones: each line is two rows (72px thumbnail with category, name in at
  most two lines and the unit price; then quantity, line total and a fully
  visible Remove). Tablets and desktops keep the right-hand controls column.
- Order summary: Items, Delivery (calculated at checkout) and Subtotal never
  clip; 48px full-width checkout button.
- Phones get the site's sticky purchase bar on the cart (subtotal + Checkout
  above the tab bar), so the end of the page is reserved and the WhatsApp
  button does not cover prices or actions, as on the product page.
- Checked at 320, 360, 375, 390, 393, 414, 430, 768, 1024, 1366 and 1440px:
  no horizontal overflow. Same cart store and calculations.

## 2026-11-11 — production-readiness fixes: form privacy, catalogue security, money units, orders

Not applied to Supabase and not deployed; verified on a disposable local
database only.

- Forms never put data in a URL: sign-in, registration, password recovery,
  reset and Track Order post to server actions (POST) with or without
  JavaScript. While a service is not connected its form cannot be submitted
  (disabled button, notice). Browser test with JavaScript disabled:
  `frontend/e2e/forms-no-js.spec.ts`.
- Catalogue security (`database/migrations/0003`): RLS on every catalogue
  table, Supabase's default grants revoked, read-only grants for the public
  catalogue, security-invoker storefront view limited to active countries,
  price currency must match the country.
- Money: every stored or passed amount is an integer in ISO 4217 minor
  units (TZS and KES ×100, UGX ×1); display stays whole shillings. Sample
  prices converted with `tzs()` so displayed prices are unchanged. Fields
  renamed (`priceMinor`, `totalMinor`, …) so a missed conversion fails
  type checking. TZS/KES regression tests at import, display and totals.
- Orders (`0004`): `place_cod_order` reprices, checks options and stock,
  reserves stock and saves the order in one transaction with an
  idempotency key; `track_order` needs number plus email or phone; RLS
  keeps each customer's orders private. Checkout shows the confirmation
  only after the order is saved; guest checkout stays.
- Live data behind an explicit switch: `DATA_SOURCE=mock` (default) or
  `database` (`DATABASE_URL`, new `@tronic/database` package).
  Supabase Auth (server-side `SUPABASE_URL`/`SUPABASE_ANON_KEY`): server
  actions, session cookies via `@supabase/ssr`, `proxy.ts` and a protected
  `/account` page with the customer's own orders.
- Tests: 33 database tests, 163 storefront tests, 15 Playwright browser
  tests (`pnpm --filter @tronic/storefront run e2e`).

## 2026-11-11 — account screens: cinematic entrance and smoother details

- One timed entrance on the login, register and password pages (CSS,
  transform and opacity only): background 0–400ms, logo 150–600ms,
  showroom 350–1000ms with the LED bulb switching on (warm halo, light on
  the globe, pool on the platform; the photo is not recoloured), card
  500–1100ms, then the card contents in a short stagger. Fields can be used
  at once; nothing waits for the animation.
- Afterwards only the lights breathe slowly (8–10s, opacity). The
  chandelier glow is a soft gradient instead of a blur filter.
- New `(auth)` layout (`AuthStage`): the background, brand column and
  showroom stay mounted, so moving between login, register and the
  password pages only swaps the card (`AuthCardMotion`, 340ms) instead of
  replaying the whole entrance.
- Details: one red outline on focused fields (the site-wide focus outline
  no longer draws a second box inside), the password eye fades in, the
  Sign in arrow moves 3px on hover, the account icon gets a soft
  light-pink highlight and scales in without bouncing.
- Reduced motion: no entrance, no loops; the lit final state shows at once.
- No new dependencies; the `motion` package is not used here.

## 2026-11-11 — create account, forgot and reset password in the login design

- `/register`, `/forgot-password` and `/reset-password` now use the same
  screen as `/login` (shared `AuthScreen` shell in `LoginScreen.tsx`): red
  stage, showroom on laptops and desktops, white card, no site chrome.
- Shared fields in `components/auth/AuthFields.tsx` (field with icon,
  password with Show/Hide, red submit button, result message); the old
  `AuthLayout` and `PasswordInput` are removed.
- Register fits one screen without scrolling from 375×667 up to 1920×1080:
  long forms get a compact card (`long` / `data-long`: no account icon,
  shorter inputs, tighter gaps, extras step aside on short screens).
  Email and mobile, password and confirm sit side by side from 640px.
  Only very small phones (320×568) scroll.
- Password checklist reads "8+ characters", "A letter", "A number" in one
  row.
- "Power Every Space." is all white; the cable image is cut out again with
  a soft matte so no light shadow box shows around it.
- Still frontend only: every form calls the not-connected auth service.

## 2026-11-11 — login page redesign: red showroom, one screen

- `/login` follows the owner's references and stands alone: the site
  header, navbar, footer, tab bar and chat button are hidden on this page
  only (`data-auth-screen`, layout-neutral `data-site-chrome` wrappers in
  the root layout); "Back to shopping" returns to the store.
- Laptops and desktops: deep burgundy stage with red light curves; on the
  left the white TRONIC logo | TANZANIA, "Power Every Space.", and a
  showroom where the owner's chandelier hangs from the top over a metal
  platform with a red LED rim holding TRONIC products (voltage stabilizer,
  water heater, exhaust fan, LED bulb, cable), then a trust strip; on the
  right the white login card.
- Phones: red stage, white logo, one white panel with a compact product
  showcase, the form and a trust strip.
- Fits one screen without scrolling from 320×568 to 1920×1080: on shorter
  screens the trust strip, tagline, account icon and showcase step aside in
  order (height media queries in globals.css).
- Product images supplied by the owner, cut out of their white studio
  background into `frontend/public/auth/` (WebP, ~300KB in total); the logo
  is the red artwork shown white until the official white logo is supplied.
- Login form: icons in the fields, Show/Hide, Remember me, Forgot password,
  Sign in; still the not-connected auth service (no login happens).

## 2026-11-11 — customer login and registration screens (auth not connected)

- New `/login`, `/register`, `/forgot-password` and `/reset-password`
  (route group `app/(auth)`), frontend only; Supabase Auth connects later.
- Desktop: showroom photograph with a short brand line beside the form;
  phones and tablets show the form alone. The site header, navbar and tab
  bar stay as on every page.
- Login: email, password with Show/Hide, Remember me, Forgot password,
  Create account. Register: full name, email, Tanzanian mobile number,
  password with a strength meter and requirements checklist, confirm
  password, Terms and Privacy acknowledgement. Reset: new password and
  confirmation with the same requirements.
- Rules in `features/auth/rules.ts` (password policy is configuration:
  8–72 characters, a letter and a number), shared email and phone checks
  from checkout. Errors show on blur and submit; the first invalid field
  takes focus.
- Forms call `features/auth/service.ts`, which is not connected: a valid
  submit shows "Authentication will be available when account services are
  connected." No redirect, success message, stored credentials, logging,
  mock users or sessions.
- The header Login button, the mobile menu and the tab bar's Profile now
  open `/login` (was the `/account` placeholder). Checkout stays guest.
- `@tronic/ui` now exports `Field`, `controlClasses` and `fieldDescribedBy`
  for the password field.

## 2026-11-10 — checkout frontend (orders and online payment not connected)

- Owner decision: finish the checkout frontend now, connect Supabase,
  orders and payment providers later. No order or payment is simulated.
- Entry points: the cart's "Proceed to checkout" opens `/checkout` with the
  cart lines; Buy Now (product page, quick view, cards) opens
  `/checkout?buy=…` with only that product, options and quantity, and no
  longer touches the cart.
- `/checkout`: on desktop the form (60%) sits beside a sticky order summary
  (40%); phones get a collapsible summary and a sticky total + Place order
  bar above the tab bar. Four sections: contact (name, email, Tanzanian
  mobile number, guest), delivery (address delivery; showroom pickup shown
  but off until pickup points exist; Tanzania's 31 regions, district, ward,
  street, extra details, instructions), payment, review.
- Payment: Cash on delivery is open and chosen by default (owner decision);
  mobile money, card and bank transfer show "Not available yet".
- The server prices every line (`features/checkout/quote.ts` via a server
  action): the browser sends ids, options and quantities only. Out-of-stock,
  retired or mismatched-option lines are noted and left out of the total.
  Delivery and VAT read "Confirmed before payment"; the total is labelled
  "Total so far".
- Validation (`features/checkout/validation.ts`, shared with the future
  order action) runs on blur and submit and focuses the first error.
  Place order then says plainly that online ordering is not connected, so
  nothing was sent, ordered or charged (`ORDERS_CONNECTED = false`).
- `/track-order`: order number + phone/email form and a guide to the seven
  order statuses; it says that nothing is looked up until orders go live.
- Options awaiting owner confirmation live in `features/checkout/config.ts`:
  delivery fees and coverage, pickup points, VAT, online payment providers.

## 2026-11-10 — navbar: one-line categories, company links in a More menu

- Owner request: every category label on one line. From 1280px all eight
  sections now sit on one line; up to 1679px with slightly tighter padding
  and letter spacing (they need ~1050px there, ~1130px from 1680px).
- 1280–1679px: the four company links no longer fit beside one-line
  categories, so a "More" button at the right of the bar opens them as a
  small menu (About Us, Our Locations, Engineering Blog, Our Showroom
  Locations, each with its icon). It opens on hover or click like the
  category panels and closes with Escape, an outside click or on leaving.
- From 1680px (new `3xl` breakpoint): the four links sit in the bar with a
  14px icon before each label (info, map pin, newspaper, store), 6px apart,
  20px between links; hover underlines the label, focus shows an outline.
- 1024–1279px keeps the two-line labels: one line does not fit there.
- Measured, one row and nothing clipped: 1280 (72px spare before More),
  1366, 1536, 1679, 1680 (107px before the links) and 1920px.

## 2026-11-10 — navbar: categories no longer run into the company links

- Cause: the eight category labels on one line need ~1130px and the
  company links (About, Locations, Blog, Showrooms) ~250px, so both only
  fit from ~1500px (and wider still at 2xl, where the labels grew to 13px).
  From 1280px the company links were shown anyway and the categories were
  scrolled inside a hidden-scrollbar strip, so "Shop by Use" was cut off
  against "About" on most laptops.
- Below 2xl (1536px) each category label now sits on two balanced lines
  ("Switchgear &" / "Protection"); from 2xl on one line at 12px. The bar
  keeps its height (42px, 40px from 2xl).
- The categories take the free space and the company group never shrinks,
  so the two cannot overlap; a thin divider separates them. The hidden
  scroll strip is gone: if a larger browser font still does not fit, the
  list wraps to a second row instead of hiding anything.
- Measured: one row, nothing clipped, at 1024, 1280, 1366, 1440, 1536 and
  1920px (the gap before the company links is 105px at 1280, 63px at 1536).
  Below xl (1280px) the company links stay in the footer as before; phones
  and tablets keep their own navigation.

## 2026-11-10 — working cart and wishlist in the browser

- Add to Cart and Buy Now (product cards, product page, search quick view)
  put the product with its chosen options and quantity in a cart kept in
  this browser; Buy Now then opens the cart. On cards, a product with
  colours or variants opens a small dialog where each must be chosen.
- The heart on cards and the product page saves or removes the product
  from a wishlist in this browser; it fills red when saved.
- Header (tablet and up) and bottom tab bar (phones) show cart and
  wishlist counts; screen readers hear "Cart, 3 items".
- New `/cart` page: lines with options, unit price, quantity 1–10, line
  total and Remove; summary with item count and subtotal. Out-of-stock and
  no-longer-listed lines are noted and left out of the subtotal. New
  `/wishlist` page lists saved products as product cards. Both have empty
  and loading states and are not indexed.
- Storage (`features/cart/store.ts`): localStorage keys per country; only
  product ids, options and quantities are stored, never prices. Every price
  comes from the catalogue on each render (`features/cart/lines.ts`).
  Malformed or tampered entries are dropped on read; tabs stay in sync.
- No checkout or payment exists yet: the cart's checkout button is disabled
  and says so; nothing is ordered or charged. The cart does not follow the
  shopper to another device until accounts and the cart service exist.

## 2026-11-10 — search quick view with purchase (desktop)

- On desktop with a mouse (fine pointer, 1024px and wider) the search panel
  is two columns: results (~48%) and a quick view (~52%) of the product
  under the pointer or keyboard highlight. It opens on the first result.
- The quick view is a compact product page: gallery (arrows when a product
  has several images), category, name, SKU with the chosen options, model
  number, TZS price with any sale price and saving, stock, a description
  (with Read more; until a product has its own copy it shows the same
  generic line as the product page, now shared in
  `features/catalog/description.ts`), up to five specifications (wattage, voltage, current, size,
  material… first), colour and variant choices, a quantity stepper (1–10),
  Add to Cart, Buy Now and "View full product details". The purchase bar
  stays at the bottom while details scroll.
- Options are not preselected: a product with colours or variants cannot
  be bought until each is chosen, and out-of-stock products cannot be
  bought. Per-option price, stock, SKU and image are not in the catalogue
  yet, so the choice is shown in the SKU line, as on the product page.
- Purchasing goes through `features/cart/purchase.ts`, now shared with the
  product page (`PurchasePanel`): Add to Cart shows the same sample-mode
  toast (the button says "Added" for a moment and ignores repeat clicks,
  the panel stays open) and Buy Now goes to the same `/cart` placeholder.
  There is still no cart, cart badge or checkout; nothing is stored or paid.
- No request per hover: hits carry the extra images, options, a trimmed
  description and up to eight specifications. A row takes over after a
  90 ms rest (hover intent), so sweeping across rows to the quick view does
  not switch products. Escape anywhere in the panel closes it and returns
  focus to the field.
- Phones, touch tablets and narrow windows: tapping a result opens the same
  quick view as a bottom sheet (native dialog: Close button, backdrop tap,
  Escape or back gesture to close; page scroll locked; safe-area aware).
  Quantity and Add to Cart share a row, Buy Now is full width below, all
  44px tall. The toast would sit under the sheet, so "Added to cart" is
  also confirmed inside it. Closing returns to the results; a modified
  click (new tab) still opens the product page.
- `SearchResultItem`, `SearchQuickView` and `SearchQuickSheet` split out of
  `SearchBox`.

## 2026-11-10 — live product search and autocomplete

- The header search now finds products by name, exact or partial SKU, model
  number (a "Model…" specification), brand and category words. Ranking:
  exact SKU, exact model, exact name, name prefix, all words, keywords, then
  one typo per word of 4+ letters. Shared by the mock catalogue
  (`packages/api-client/src/product-search.ts`) and the draft SQL.
- The dropdown shows up to six hits (photo, name, SKU, category, TZS price
  with any sale price, stock) and "View all results"; arrow keys, Enter,
  Escape and click-outside work as a WAI-ARIA combobox. Debounced 250 ms,
  stale requests are aborted, recent queries are cached. Phones get a
  scrollable panel with a Close action that stops above the tab bar and the
  keyboard.
- `GET /api/search` searches on the server for the active country only and
  returns slim hits: input is length-checked, `limit` capped at 8, a
  best-effort per-instance rate limit (60/min), short cache headers and
  generic errors. The browser never downloads the catalogue.
- New `/search?q=` page (relevance and the listing sorts, in-stock filter,
  pagination; not indexed). Enter without a highlighted hit opens it, and
  the search field is a real GET form, so it works before hydration.
- `database/migrations/0002_product_search.sql` (DRAFT, not applied): pg_trgm
  indexes and a `search_products()` function with the same tiers.

## 2026-11-10 — phone homepage product tabs

- Below 768px the homepage shows one tabbed product block: New Arrivals
  (newest first by catalogue order), Best Sellers, Featured Products (the
  "Special for you" picks) and All Products. It replaces the single
  "Special for you" rail on phones; desktop is unchanged.
- Best Sellers is a hand-picked placeholder list of SAMPLE products, not a
  sales ranking; it needs real order data before launch.
- Tabs follow the WAI-ARIA pattern (arrow keys, Home/End, one tab stop).

## 2026-11-10 — floating WhatsApp chat button

- A green WhatsApp button floats bottom-right on every page and opens a
  wa.me chat with a short greeting in a new tab. It eases in shortly after
  load, sends a few soft pulse rings, lifts and wiggles its icon on hover,
  and shows a "Chat with us" label on hover or keyboard focus (pointer
  devices only). Reduced-motion users get a static button.
- On phones it sits above the bottom tab bar. Phone product pages hide it,
  since their sticky purchase bar holds the actions and the button covered
  the quantity stepper (owner decision). Hidden when printing.
- The footer's "Founded 1993" line keeps a right margin from 640px so the
  button never covers it when the page is scrolled to the very bottom.
- The number is a placeholder (`WHATSAPP` in `config/site.ts`, the same
  zeros as the support phone) until the owner supplies the real one.
- `WhatsAppIcon` joins the brand icons in `@tronic/ui`, built from the
  lucide MessageCircle and Phone paths.

## 2026-11-09 — slimmer desktop header

- The red top bar (announcement ticker, social links, support phone, desktop
  country selector) is hidden by owner request. The component and config
  stay in the codebase; the country selector remains in the mobile drawer.
  Support phone and social links moved to the footer brand column (both
  still placeholders in config until the owner supplies them).
- The red category navbar is rendered after the sticky header instead of
  inside it: on desktop it scrolls away with the page and is back at the
  top, with no scroll listener and no layout shift. Only the logo and search
  row stays pinned (72px instead of 148px).
- The listing sidebar sticky offset derives from `--header-height` instead
  of a fixed number, so it sits 12px under the header.

## 2026-11-09 — subcategories from the Website Content Structure

- The taxonomy gains its third level: every group of the six product
  departments lists its subcategories from the owner's diagrams (Tools and
  Shop by Use stop at the group level there). Data lives in
  `country-config` only; "Earthing & Surge" is now named "Earthing & Surge
  Protection" as in the diagram.
- Desktop mega-menu shows each group as a heading with its subcategories
  beneath (section > group > subcategory). The mobile drawer still lists
  groups; the group page shows the subcategories as chips.
- Subcategory pages at `/categories/[slug]/[group]/[subcategory]` reuse the
  listing (breadcrumb, chips, filters, sort, pagination, metadata, 404 for
  unknown slugs). Products carry an optional `subcategorySlug`; the sample
  products are assigned one so the pages are not all empty.
- Draft migration and schema notes add `category_subcategories`.
- Listing sidebar: an expandable "Product Categories" tree (section >
  group > subcategory) sits above Brand, Price and Availability, sticky on
  desktop and inside the Filters sheet on phones. Labels navigate; the
  separate chevron expands or collapses; the active level and its ancestor
  stay open across navigation and refresh; links keep the current filters
  and sort. The horizontal group and subcategory chips are gone, since the
  tree covers them; heading and breadcrumb stay.
- Listing design pass: compact white header (breadcrumb, parent label,
  28/32px title, one-line description) replaces the grey band and its
  decorative icon; a hairline toolbar carries the count, removable active
  filter chips with "Clear all", the Filters button and a 36px sort control;
  the filter form uses 12px section labels, 36px inputs, a charcoal Apply
  and a text Clear; pages with one or two products list the sibling ranges
  under the grid; sidebar sticks only on tall viewports; grid gains a fifth
  column from 1536px. Verified at 320–1920px.

## 2026-11-08 — category navigation and product browsing (Module 03)

- Department pages (`/categories/[slug]`) list products instead of the
  "coming soon" group tiles, and every group has its own page
  (`/categories/[slug]/[group]`): breadcrumb, group chips with the active one
  highlighted, result count, brand / price-range / in-stock filters, sort
  (newest, price up or down, name) and pagination (12 per page). Filters are
  a plain GET form, so the URL is the state: shareable, back-button safe,
  works without JavaScript. Desktop keeps a sidebar; phones open the same
  form in a bottom sheet that slides up on the drawer curve. Unknown
  category or group pairs return the branded 404; loading skeletons cover
  server renders.
- Catalogue boundary: `Product`, `ProductQuery`, `ProductPage` types in
  `packages/types`; `CatalogClient` (`listProducts`, `getProduct`,
  `getRelatedProducts`) with a mock implementation in `packages/api-client`
  that enforces country isolation (a product outside the active country is
  never returned, not even by slug) and computes facets from the unfiltered
  section; `formatMoney` in `packages/country-config` using the country's
  locale and the currency's own precision (TZS/KES/UGX have none). The
  homepage sample set moved into the mock catalogue with slug, SKU, brand,
  group and catalogue order; the old `sampleProducts` module is a thin
  compatibility layer.
- Product page reads through the client by slug, shows the group in the
  breadcrumb and specification rows, brand and description when present,
  and a canonical URL. Mega menu and drawer group links point at the group
  pages; product cards link by slug.
- Shop by Use is modelled as use cases, not a ninth department: products
  carry `useCases` (homeowners, contractors, commercial) and its pages list
  matching products from every department, so nothing is duplicated.
  Department pages show the section's one-line description (the same text
  as the homepage banners, now a single source in `country-config`).
- SEO: listing metadata with canonical URLs (filters stripped, page kept)
  and `noindex, follow` on filtered or sorted views.
- Draft schema `database/migrations/0001_catalog.sql` and
  `docs/database/schema-v1.md` describe the Phase 4 tables and the exact
  query the live adapter must reproduce. Not applied: no Supabase project
  exists yet.
- Tests: 14 new (catalogue client filters, sort, pagination, country
  isolation, URL parsing against hostile input, metadata, money).

## 2026-11-08 — mobile drawer motion

- The menu drawer slides in from the left over 400ms on cubic-bezier(0.22,
  1, 0.36, 1) while the backdrop fades and blurs (250ms); its contents reveal
  in document order (logo row, Categories heading, each category, Quick links
  heading and items, country and Login) with a 40ms stagger and a 10px
  settle. Closing plays the slide back (280ms) and the backdrop fade before
  the dialog really closes, whether by the X, a backdrop tap, Escape or a
  leftward swipe. The page behind cannot scroll while it is open.
- Accordion chevrons rotate on the same curve and subcategory links stagger
  in (35ms). Everything is transform/opacity only; reduced motion skips all
  of it and closes at once. UI, colours, sizes and order are unchanged.

## 2026-11-07 — category showcase follow-ups

- The "Explore Our Categories" heading is visually hidden (it remains for
  screen readers and the outline); the banners start right under the hero.
- Tile titles 13px and taglines 11px on phones (15px/12px before).

## 2026-11-07 — photographic category showcase

- "Explore Our Categories" replaces the circular category rail on the
  homepage: the eight navbar categories as 2:1 photographic banners (title
  and tagline over a soft gradient, whole card a link, hover zoom and arrow,
  still under reduced motion), two per row at every size; on phones the
  first two are tall 3:4 feature tiles and the other six compact 2:1 tiles
  with the title only, as in the reference. The navbar keeps its own category menu.
- Banners are owner-supplied photographs rendered to 1600x800 WebP in
  public/categories (the fan is official TRONIC imagery; the others are
  stock scenes with no TRONIC branding or product claims). Swap a file to
  change a banner.
- The rail CSS (ticker, fades, pause rules) is removed with the rail.

## 2026-11-07 — architecture audit, plan and folder skeleton

- docs/architecture/ARCHITECTURE-AUDIT-AND-PLAN.md records the current state
  (storefront + mock adapters only; no database, API routes or auth yet), the
  target layout, the existing-to-proposed migration map, the API and admin
  strategy, the Supabase schema v1 outline, Vercel impact and an 8-phase plan.
- Top-level layout by concern (owner decision): the storefront moved from
  apps/storefront to frontend/ (git rename, routes and assets unchanged; the
  Vercel Root Directory must change to frontend with this merge, see
  docs/deployment/README.md); backend/ (business logic, worker), database/,
  admin/, apis/ (public API contracts and gateway) and tests/ sit beside it.
- Fix found while verifying the move: globals.css pointed Tailwind's @source
  at ../../../../packages/ui/src, one level too high from the new depth, so
  the shared ui classes (Container padding and max-width among them) were not
  generated and phones showed clipped titles and a horizontally scrolling
  page. The path is now ../../../packages/ui/src; verified at 320, 360, 375,
  390, 430, 768, 1024 and 1440 with no document overflow.
- Homepage card CTA: the filled button reads cart icon + "Add" at every size
  (cards are 170-190px wide in every grid, so the long label truncated from
  md); the accessible name is still "Add to cart: <product>".
- Empty skeleton folders with a README each name where future work lands:
  admin, backend/worker, frontend/src/features/{catalog,cart,
  checkout,orders}, frontend/src/lib, packages/{validation,
  permissions,database}, database/migrations and docs/{database,api,
  integrations,deployment}. None has a package.json, so the workspace,
  Turborepo and the Vercel build are unaffected. No code moved.

## 2026-11-07 — Outfit as the single typeface

- The storefront now sets Outfit (SIL OFL, Google Fonts v15, latin variable
  WOFF2, 32KB) for headings, body and UI, replacing Montserrat + Poppins
  (seven files, 88KB). Owner decision after reviewing tz.oraimo.com, which
  uses Outfit throughout. Self-hosted as before via next/font/local; the
  body sets --font-body and points --font-heading at the same family, so no
  component changed.
- Fallback stacks, the fonts README and the design system doc follow.

## 2026-11-06 — compact product page purchase bar (phones)

- The sticky purchase bar's Buy Now (outline) and Add to Cart (filled) are
  44px pills with 13px semibold text, 8px apart, in a bar with 8px vertical
  padding (61px in all, was 69px); the price stays on the left. Below 360px
  the duplicated price steps out and the two buttons share the full width.
- The page reserves the bar's height above the tab bar and toasts rise above
  it, as before; desktop buttons are unchanged.

## 2026-11-06 — mobile homepage polish

- The category rail starts one gutter in on phones, so the first category is
  fully visible and lines up with the content instead of sitting under the
  edge fade. The seam gap of the loop is unchanged.
- Slightly tighter rhythm between the rail and the first product section.
- A three-item service strip sits under the categories (fast delivery, home
  delivery, hassle-free warranty), each linking to its policy page; no price
  or threshold is claimed. One row at every size with each label on one line:
  10px labels with bare icons on phones (icons step out below 360px), a quiet
  row with 14px labels from md.

## 2026-11-06 — governance round one: share card, headers, hygiene

- The social-share card is a neutral 1200x630 crop of the hero scene
  (public/og/tronic-tanzania.jpg). The campaign banner it replaces carried a
  "Black November, up to 50% off" claim this pre-launch site does not make.
- Every response now carries security headers from next.config.ts: a strict
  Content-Security-Policy (self only, frame-ancestors none, unsafe-eval only
  in development), nosniff, X-Frame-Options DENY, Referrer-Policy,
  Permissions-Policy and HSTS; X-Powered-By is off.
- .gitignore excludes *.pdf and the whole .claude/ folder, so the owner's
  documents and local tooling cannot reach the public repository.
- Workflows run on pushes to main and on pull requests, not twice per PR
  commit. Dependabot also proposes grouped npm updates weekly.
- CLAUDE.md states the real state: public repository, protect-main enforced,
  CI job not yet a required check. The UTF-8 BOM is gone from
  PurchasePanel.tsx.
- Full review with the remaining findings: docs/REVIEW-2026-11-06.md.

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
- Sticky purchase bar: 48px Buy Now (outline) and Add to Cart (filled) with
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
  frontend/src/fonts with a provenance README; filenames are
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

- Scaffolded the pnpm + Turborepo monorepo: `frontend` (Next.js 15,
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
