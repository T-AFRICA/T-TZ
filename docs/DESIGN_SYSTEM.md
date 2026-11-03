# TRONIC design system

Source of truth for brand values is `packages/ui/src/tokens.css`; this
document explains the decisions. Governing requirements: brand guide v1.0,
SRS v1.2 NFR-11, SSD §4, and the engineering master prompt §§3–7.

## Typography

Two families only, loaded via `next/font/google` in
`apps/storefront/src/app/layout.tsx` as CSS variables:

| Variable | Family | Weights loaded | Use |
| --- | --- | --- | --- |
| `--font-heading` | Montserrat | 500 / 600 / 700 | Hero, page and section headings, brand expression (800/900 deliberately not loaded) |
| body (fallback stack) | System UI (SF Pro on Apple, Segoe UI on Windows, Roboto on Android) | native | Body, navigation, buttons, prices, forms, tables |

Body family history: the master prompt §4 named Poppins; on 2026-11-02 the
owner asked for SF Pro. SF Pro is Apple-proprietary and cannot be embedded
as a web font, so after an Inter interim the owner chose the native system
stack — real SF Pro on Apple devices, zero font download, at the cost of
minor cross-platform variation.

Fallback stacks live in `--font-fallback-heading` / `--font-fallback-body`.

### Fluid scale (tokens)

| Token | Range (mobile → desktop) | Use |
| --- | --- | --- |
| `--text-display` | 32 → 56px | Hero H1 (68px ceiling dropped after visual review found it oversized) |
| `--text-h1` | 30 → 48px | Page H1 |
| `--text-h2` | 24 → 38px | Section H2 |
| `--text-h3` | 20 → 27px | Sub-sections, feature headings |

Body text is 16px Poppins; labels/captions 12–14px. Line heights: display
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
