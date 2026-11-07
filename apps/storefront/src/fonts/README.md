# Vendored font assets

Self-hosted WOFF2 fonts served through `next/font/local` (see
`src/app/layout.tsx`). Self-hosting removes the build-time network
dependency and the intermittent `next/font/google` loader failure seen on CI
(Next.js 15.5.x: "Cannot read properties of null (reading '1')").

| Family | Weights          | Subset | Source                                | License |
| ------ | ---------------- | ------ | ------------------------------------- | ------- |
| Outfit | variable 100–900 | latin  | fonts.gstatic.com (Google Fonts v15)  | SIL OFL 1.1 — `OFL-outfit.txt` |

Outfit (owner decision 2026-11-07, after the owner's review of tz.oraimo.com)
is the single typeface for headings, body and UI; `--font-heading` and
`--font-body` both resolve to it. One variable file (32KB) covers every
weight the storefront uses (400–700). It replaced Montserrat + Poppins,
which were vendored on 2026-11-04.

The family is licensed under the SIL Open Font License 1.1; the full license
text ships alongside the file as required for redistribution.

Latin subset only (the storefront ships in English). Add further subsets
as additional `src` entries in `layout.tsx` if other scripts are needed.
Filenames are lowercase-only for Linux CI path compatibility.
