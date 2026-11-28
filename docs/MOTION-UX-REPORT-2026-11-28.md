# Motion and UX brief: implementation report, 2026-11-28

Brief: "TRONIC — Premium UI/UX & Motion Design Transformation" (owner,
2026-11-28). This report covers the first change made under it. It does
not claim the brief is finished: the brief asks for every page of both
apps, and this change builds the shared system and applies it to the
interactions customers use most.

Status words used below:

- **Verified**: implemented, and a test in this repository proves it.
- **Already in place**: existed before this change; the test or file that
  shows it is named. Not re-measured here.
- **Partly**: some of what the principle asks is done; what is missing is
  stated.
- **Not done**: nothing in this change.

No quality scores are given. Nothing here was measured on the live site,
on a real phone, or with Lighthouse.

## What was built

- `packages/ui/src/motion.css` and `motion.ts`: durations, curves, feedback
  classes and one-shot effects, shared by the storefront and the Central
  Admin. No new dependency; the `motion` package already installed is
  still used only by the product gallery and the accordion.
- Applied to: buttons and call-to-action links, Add to Cart, the cart and
  wishlist counts, the wishlist heart, the dialog, toasts, the drawer,
  sheets, mega menu, search panel, small touch targets, and the admin's
  button styles.
- Details: `docs/DESIGN_SYSTEM.md` ("Motion") and `docs/CHANGELOG.md`.

## The ten animation principles

| # | Principle | Status | What and where | Proof |
|---|---|---|---|---|
| 01 | Squash and stretch | Verified | `m-press`: a pressed control scales to 0.975 by 0.945 and springs back; the heart's "pop" stretches past full size and counter-squashes | `motion.spec.ts` "a pressed button squashes…", "saving to the wishlist pops…" |
| 02 | Anticipation | Partly | The "pop" starts with a short wind-up (scale 0.8) before it grows; the press itself comes before every menu, drawer and dialog opens | Same tests. No separate wind-up was added to menus or drawers: it would delay the action |
| 03 | Staging | Partly | The dialog's backdrop now fades in as the dialog arrives; the drawer and sheets already dimmed and blurred the page | `motion.spec.ts` "a dialog settles…". Section-by-section visual hierarchy was not reviewed |
| 04 | Pose to pose | Partly | States are named once (press, pop, release, bump, shake, rise-in, dialog, stagger) and reused | `motion.test.ts`. Not every component has been moved to them |
| 05 | Follow through | Verified | Spring and settle curves: a released control and the dialog overshoot once and rest; drawers and sheets do not overshoot (they would leave a gap at the edge), their contents settle after them as before | `motion.spec.ts` (spring curve accepted by the browser; dialog uses `--ease-settle`) |
| 06 | Slow in, slow out | Verified | Six curves replace the ad hoc ones; arriving, leaving and in-place changes each have their own; Tailwind's default transition curve is the standard one | `motion.test.ts` "are the same in motion.css and motion.ts" |
| 07 | Arcs | Verified | The product travels to the cart on a curved path (across and up-and-down on different curves) | `motion.spec.ts` "Add to Cart at 1440px/375px": the path is sampled every frame and must leave the straight line by more than 15px |
| 08 | Secondary action | Verified | The cart icon bumps when the dot arrives; the count's bubble bumps when its number changes, and not when the page loads | Same test (second add) |
| 09 | Timing | Verified | Press 100ms, release and hover 160ms, menus and overlays 240ms, dialogs and sheets 320ms, drawer and success feedback 420ms | `motion.test.ts` "keep to the timing the brief asks for"; `motion.spec.ts` reads the tokens in the page |
| 10 | Exaggeration | Partly | Stronger feedback for success: the heart's pop, "Added" on the button, the travelling photo | Same tests. Order placed and payment confirmed were not given new feedback: nothing may look successful before the server confirms it, and that flow was left as it is |

## The ten UX principles

| # | Principle | Status | What and where | Proof |
|---|---|---|---|---|
| 01 | Postel's law | Already in place | Search takes SKU, name and keywords, ignores case, spacing and SKU separators, and allows one typo in longer words; the server validates | `features/search/search.test.ts`; `database/migrations/0002_product_search.sql` |
| 02 | Bigger hit areas | Partly | 44px touch areas on the card's heart, Add and Buy now, option swatches and pills, dialog close, toast dismiss, hero dots | `motion.spec.ts` "controls drawn smaller than 44px…". Not swept: footer links, pagination, filter chips, search result buttons (28px), the admin |
| 03 | Doherty threshold | Partly | Every press answers within 100ms; Add to Cart answers at once (the cart is in the browser) | `motion.spec.ts`. Loading screens exist for the account, category and search pages only; none were added. No response times were measured |
| 04 | Fitts's law | Already in place | Bottom bar on phones, sticky purchase bar on the product page, floating WhatsApp button | `e2e/bottom-nav.spec.ts`. Placement was not changed |
| 05 | Frequency of use | Already in place | Search, categories, cart, wishlist, account and tracking are in the header and bottom bar | Not changed |
| 06 | Hick's law | Not done | Navigation and checkout were not simplified | |
| 07 | Jakob's law | Already in place | Familiar search, cart, filter, checkout and account patterns | Not changed |
| 08 | Miller's law | Not done | Specifications and filters were not regrouped | |
| 09 | Solid drawing in 3D | Not done | The hero room and the product photo tilt already exist; no new 3D or lighting presentation was added | |
| 10 | Overall appeal | Not done as a review | Typography, spacing and composition were not audited page by page | |

## Pages

| Area | In this change |
|---|---|
| Homepage | Press feedback on every call to action; cards (heart, Add, Buy now); hero dots' touch area |
| Header and navigation | Press and 44px areas on the wishlist and cart icons; count bumps; drawer, mega menu and search panel on the tokens |
| Product cards | Press, "Added", travelling photo, heart pop. Layout unchanged; scale does not move neighbours (tested) |
| Listing pages | Cards as above; filter sheet and category tree on the tokens. Filters, sorting and skeletons unchanged |
| Product page | Press on Add to Cart, Buy Now and the steppers; "Added to Cart"; travelling photo from either button. Gallery unchanged |
| Cart and checkout | Press on the main buttons. Quantity updates, summaries and validation unchanged |
| Account | Press on the main buttons; entrances on the tokens. Dashboard unchanged |
| Central Admin | Tokens imported; press on the four button styles; the shared dialog and toast. No animated figures, no layout change |

## Checks run

| Check | Result |
|---|---|
| Lint, typecheck | Pass |
| Storefront unit tests | 320 passed (9 new) |
| Admin, database, API contract, permissions unit tests | All files pass (admin 9, database 20, API contracts 2, permissions 1 file with 21 tests) |
| Storefront browser suite | 65 passed, 4 skipped as before (8 new in `motion.spec.ts`) |
| Admin browser suite | 31 passed |
| Production builds | Both apps build (the browser suites run against production builds) |

## Not measured, not done, and risks

- Lighthouse, Core Web Vitals and frame rate were not measured. The
  development PC is used over Remote Desktop at 32 frames per second, so
  smoothness cannot be judged on it.
- Not tested on a real phone or a slow network.
- WCAG 2.2 AA was not audited as a whole. Reduced motion and the new touch
  areas are tested; nothing else about accessibility was re-checked.
- The spring curves use CSS `linear()`. Browsers without it (Safari before
  17.2, Chrome before 113) fall back to the plain "ease" curve: the
  feedback still plays, without the overshoot.
- Changing Tailwind's default transition timing and its `ease-*` curves
  touches every element that used them, in both apps. Both browser suites
  pass, but not every page was looked at.
- The admin's press feedback is covered only by its existing suite still
  passing; it has no test of its own.
- Security: presentation only. No input, data, role, country boundary or
  server behaviour changed. The travelling dot's picture address is
  encoded before it is used in a style (tested with a quote in it).

## Next, in the order suggested

1. Touch-area sweep of the remaining small controls, both apps.
2. Loading screens for the routes that have none (product page, cart,
   checkout, order pages).
3. Cart and checkout: quantity changes, order summary, and confirmation
   feedback that waits for the server.
4. Listing pages: filter and sort transitions, active filter chips.
5. Admin: sidebar and table states, figures that change in place.
6. Measurements on a real phone: Lighthouse, Core Web Vitals.
