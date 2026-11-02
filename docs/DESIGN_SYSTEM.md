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
| `--font-body` | Inter | 400 / 500 / 600 / 700 | Body, navigation, buttons, prices, forms, tables (700 for selected emphasis only) |

Body family history: the master prompt §4 named Poppins; on 2026-11-02 the
owner asked for an SF Pro look. SF Pro is Apple-proprietary and cannot be
embedded as a web font, so Inter (its standard open equivalent) replaced
Poppins as the body/UI family, with the platform UI font (SF Pro on Apple
devices) in the fallback stack.

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
- No hover-only interactions; mega-menu and drawers are click/keyboard
  operated, Escape closes.
- Carousel is manual (arrows + dots), no autoplay.
- WCAG 2.2 AA is the target; `prefers-reduced-motion` must be respected as
  motion is added.

## Components (packages/ui)

Button (primary/outline/ghost), Container, VisuallyHidden, BrandMark
(official red logo asset for light surfaces; interim white mark pending the
white artwork), icon set (stroke, currentColor).

Pending Module 01 additions per master prompt §10: inputs, textarea, select,
dialog, tabs, badge, notification/toast, card, validation states, skeleton,
empty and error states.
