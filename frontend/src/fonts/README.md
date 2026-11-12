# Fonts

No font files live here. Typography (owner brief 2026-11-12) is set with
font stacks in `packages/ui/src/tokens.css`, and Myriad Pro is served by
the owner's Adobe Fonts web project (kit `ikx8ykc`, loaded in
`src/app/layout.tsx`; its hosts are allowed in the CSP in
`next.config.ts`):

| Token | Stack | Use |
| --- | --- | --- |
| `--font-primary` | "myriad-pro" (Adobe Fonts), "Myriad Pro", Arial, sans-serif | All interface text, headings included |
| `--font-display` | "Arial Black", "Arial Bold", Gadget, Arial, sans-serif | Hero, campaign and brand headlines only (`.font-display`) |

## Why Myriad Pro is not in this folder

Myriad Pro is a commercial Adobe typeface. The desktop OpenType files
("© Adobe Systems Incorporated. All rights reserved", embedding level 8)
are licensed for installation on a computer and embedding in documents, not
for hosting on a web server. This repository is public, so committing them
would also redistribute them. Do not add Myriad Pro OTF/TTF/WOFF files here
unless the owner has a web licence that allows self-hosting.

## Adobe Fonts web project

- Kit stylesheet: `https://use.typekit.net/ikx8ykc.css` (the kit ID is
  public). It imports `p.typekit.net/p.css`, Adobe's page-view counter for
  the licence, and the font files come from `use.typekit.net`.
- Myriad Pro faces in the kit: Regular 400, Semibold 600 (added
  2026-11-12), Bold 700 and Black 900, plus Regular and Bold italic. The
  site uses 400, 600 and 700; nothing sets 800 or 900 in Myriad Pro (900 is
  only on `.font-display`, which is Arial Black).
- The kit also carries Myriad Pro Condensed, Light SemiExtended and
  SemiCondensed. The site does not use them (browsers never download them),
  so they can be removed from the project to keep the stylesheet small.
- The kit uses `font-display: auto` (text can stay invisible for up to about
  3 seconds on a slow connection). Setting "Font display" to "swap" in the
  project settings shows Arial first and swaps when Myriad Pro arrives.
- If the kit fails to load (blocked, offline, project deleted), text falls
  back to Arial.

Arial Black is a system font on Windows and macOS and is never shipped as a
file (its licence does not allow it either); other devices use the heaviest
Arial or sans-serif.

## History

Outfit (SIL OFL, self-hosted via `next/font/local`) was the single typeface
from 2026-11-07 to 2026-11-12; before that Montserrat + Poppins (2026-11-04).
Filenames stay lowercase-only for Linux CI path compatibility if fonts are
vendored again.
