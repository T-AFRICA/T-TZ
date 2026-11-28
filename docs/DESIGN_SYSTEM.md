# TRONIC design system

Source of truth for brand values is `packages/ui/src/tokens.css`; this
document explains the decisions. Governing requirements: brand guide v1.0,
SRS v1.2 NFR-11, SSD §4, and the engineering master prompt §§3–7.

## Typography

Two families, set as font stacks in `packages/ui/src/tokens.css` (owner
brief 2026-11-12). Myriad Pro is served by the owner's Adobe Fonts web
project (kit loaded in `frontend/src/app/layout.tsx`); Arial Black is a
system font. `frontend/src/fonts/README.md` covers the kit and why the
desktop font files are not self-hosted.

| Token | Stack | Weights | Use |
| --- | --- | --- | --- |
| `--font-primary` (also `--font-body`, `--font-heading`) | "myriad-pro", "Myriad Pro", Arial, sans-serif | 400 / 600 / 700 | Navigation, product names and descriptions, prices, stock, categories, search, buttons, filters, forms, cart, checkout, order tracking, footer, page and section headings |
| `--font-display` (`.font-display`) | "Arial Black", "Arial Bold", Gadget, Arial, sans-serif | 900 | Only the homepage hero headline, the "Power Every Space." brand statement on the account screens, and the TRONIC Meter banner headings |

What visitors see: Myriad Pro once the Adobe Fonts kit has loaded; Arial
(Android: its default sans-serif) before that or if the kit is blocked.
Arial Black is built
into Windows and macOS; elsewhere the display stack falls back to the
heaviest Arial or sans-serif. Keep Arial Black off product titles, section
headings, forms and navigation, and avoid setting it in all caps.

Family history: the master prompt §4 named Montserrat + Poppins; on
2026-11-02 the owner asked for SF Pro, then (being Apple-proprietary)
settled on the native system stack after an Inter interim. On 2026-11-04 the
owner reinstated Poppins as the body family, self-hosted. On 2026-11-07,
after reviewing tz.oraimo.com (which sets Outfit everywhere), the owner moved
the whole storefront to Outfit. On 2026-11-12 the owner moved to Myriad Pro
(interface) and Arial Black (display headlines).

`--font-fallback-heading` / `--font-fallback-body` now alias
`--font-primary` so existing references resolve the same family.

### Fluid scale (tokens)

| Token | Range (mobile → desktop) | Use |
| --- | --- | --- |
| `--text-display` | 32 → 56px | Hero H1 (68px ceiling dropped after visual review found it oversized) |
| `--text-h1` | 30 → 48px | Page H1 |
| `--text-h2` | 24 → 38px | Section H2 |
| `--text-h3` | 20 → 27px | Sub-sections, feature headings |

Body text is 16px Myriad Pro (Arial fallback); labels/captions 12–14px. Line heights: display
1.05–1.15, headings 1.15–1.3 (`leading-tight`), body 1.5–1.65.

## Color

| Token | Value | Use |
| --- | --- | --- |
| `--color-brand-red` | #EF1C26 | Logo artwork reference, single brand accents |
| `--color-action-red` | #D71920 | CTAs, interactive accents (proposed, pending sign-off) |
| `--color-action-red-dark` | #B3141A | Hover/pressed action red |
| `--color-premium-black` | #111111 | Primary text, dark surfaces (footer, hero, announcement) |
| `--color-steel-grey` | #62666D | Secondary text |
| `--color-mid-grey` | #6B7280 | Muted text, captions |
| `--color-light-grey` | #E5E7EB | Borders, separators |
| `--surface-card` | #F4F5F7 | Product/category card surfaces |
| `--surface-alt` | #FAFAFA | Alternative page sections |
| `--color-off-white` | #F5F5F5 | General neutral (brand guide §6) |

Rules: white-dominant layouts; red reserved for CTAs and meaningful accents;
never communicate state with color alone.

## Spacing, grid and containers

- Tailwind's default 4px scale; stick to 4/8/12/16/24/32/40/48/64/80/96.
- `Container` (packages/ui): full width up to `--container-max` (120rem cap
  for ultrawide), 16px gutter on mobile, 32px from `lg`.
- Breakpoints: Tailwind defaults (sm 640, md 768, lg 1024, xl 1280, 2xl 1536).
  Desktop navigation appears at `lg`; the mobile drawer below it.

## Interaction and accessibility

- Single global focus style: `--focus-ring` (2px action red, 2px offset) on
  `:focus-visible`.
- No hover-only interactions: the desktop mega-menu opens on mouse hover
  (short close delay) as a convenience, but click, touch and keyboard all
  operate it fully; drawers are click/keyboard operated. Escape closes.
- Carousel is manual (arrows + dots), no autoplay.
- WCAG 2.2 AA is the target; `prefers-reduced-motion` must be respected as
  motion is added.

## Components (packages/ui)

Button (primary/outline/ghost), Container, VisuallyHidden, BrandMark
(official red logo asset for light surfaces; interim white mark pending the
white artwork), icon set (lucide-react, strokeWidth 2).

Master prompt §10 primitives (complete, 2026-11-02):

- **Input / Textarea / Select** — shared Field chrome: label, optional hint,
  validation error with icon, `aria-invalid` + `aria-describedby`; error is
  never colour-only. Disabled and focus states included.
- **Badge** — neutral / brand (red, offers only) / dark (SAMPLE marker) /
  outline variants; paired with text, never the sole state carrier.
- **Card** — "border" (white pages) and "float" (off-white app shell)
  variants, optional interactive hover lift matching the tile language.
- **Skeleton** — pulsing neutral block (reduced-motion safe); consumers add
  a visually-hidden loading live region.
- **EmptyState / ErrorState** — centred icon + title + description +
  optional action; `role="status"` / `role="alert"`.
- **Dialog** — native `<dialog>` modal: focus containment, Escape and
  backdrop-click close, labelled title.
- **Tabs** — WAI-ARIA tablist with roving tabindex (arrows, Home, End),
  red-underline + bold active pairing.
- **ToastProvider / useToast** — polite live-region notifications, info /
  success / error accents, auto-dismiss with manual dismiss.

## Additions — 2026-11-04

- Token `--color-success` (#16a34a): in-stock / success text states.
- Icons: `FacebookIcon`, `InstagramIcon`, `TikTokIcon` are drawn locally in
  the lucide stroke style (this lucide-react dropped brand icons);
  `TrendingUpIcon`, `XIcon` added from lucide.
- `Tilt3D` — pointer-following 3D tilt with cursor sheen for product
  imagery; mouse-only, inert under reduced motion, purely decorative.
- `AccordionSection` — §10 disclosure row on native `<details>`, used by
  the product details page (overview/specs/delivery/warranty); the open
  animation uses the app-level `accordion-in` keyframes.

## Motion — 2026-11-28

One motion system for the storefront and the Central Admin, in
`packages/ui`: `src/motion.css` (tokens and classes, imported after
`tokens.css`) and `src/motion.ts` (the same numbers for TypeScript, and
the one-shot effects). A storefront test (`components/motion/motion.test.ts`)
fails if the two files disagree.

### Durations

| Token | Value | Use |
|---|---|---|
| `--motion-instant` | 100ms | A control going down under a press |
| `--motion-fast` | 160ms | Hover, colour, a control coming back up. Also the default for every Tailwind `transition-*` utility |
| `--motion-base` | 240ms | Menus, popovers, toasts, backdrops, exits |
| `--motion-slow` | 320ms | Dialogs, sheets, page-level entrances |
| `--motion-slower` | 420ms | The drawer crossing the screen, success feedback |
| `--motion-stagger` | 40ms | Gap between items entering one after another |

### Curves

| Token (Tailwind utility) | Use |
|---|---|
| `--ease-out` (`ease-out`) | Something arriving: fast start, long soft landing |
| `--ease-in` (`ease-in`) | Something leaving |
| `--ease-standard` (`ease-standard`) | A change of state in place; the default curve |
| `--ease-in-out` (`ease-in-out`) | A move across the page |
| `--ease-spring` (`ease-spring`) | A small element settling with one visible overshoot (16%) |
| `--ease-settle` (`ease-settle`) | A larger element settling with a barely visible overshoot (4.5%) |

Spring curves go on scale and short moves only. A panel that slides in from
an edge must not overshoot past that edge.

### Classes

- `m-press`: press feedback for any button or button-like link. Down in
  100ms to `--press-scale` (squashed more in height than width), back up on
  the spring curve. It owns the element's transition list, so do not add
  `transition-*` or `duration-*` beside it. `m-press-icon` squashes evenly,
  for round icon buttons.
- `m-hit`: a touch area of at least 44 by 44 CSS pixels around a control
  drawn smaller. The control must be positioned. `m-hit-y` grows the height
  only, for controls side by side.
- `m-rise-in`, `m-dialog`, `m-stagger`, `m-skeleton`: arriving in place,
  the shared dialog entrance with its dimming backdrop, children entering in
  turn (each sets `--i`), and the loading pulse.

### One-shot effects (`@tronic/ui`)

- `playMotion(element, "pop" | "release" | "bump" | "shake")`: success,
  its quieter opposite, a supporting element reacting, and a refusal.
- `flyBetween(from, to, { image })`: a dot travels from one element to
  another on an arc (across and up-and-down run on different curves).
- They use the Web Animations API, move transform and opacity only, never
  delay the action they follow, and do nothing under reduced motion or
  where the API is missing.

### Rules

- Animate transform and opacity only.
- Feedback follows the action; it never stands in for it. A button says
  "Added" only after the cart has taken the product, and nothing is shown
  as paid or placed before the server says so.
- Both apps keep a global reduced-motion rule that brings every duration to
  nothing; the actions themselves still work.
- Ambient loops (the hero room, tickers) keep their own long timings and
  are not part of these tokens.
