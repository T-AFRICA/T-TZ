# Vendored font assets

Self-hosted WOFF2 fonts served through `next/font/local` (see
`src/app/layout.tsx`). Vendored 2026-11-04 because the `next/font/google`
loader intermittently fails on CI (Next.js 15.5.x: "Cannot read properties
of null (reading '1')" when Google Fonts returns extensionless URLs);
self-hosting also removes the build-time network dependency entirely.

| Family     | Weights            | Subset | Source                              | License |
| ---------- | ------------------ | ------ | ----------------------------------- | ------- |
| Montserrat | 500, 600, 700      | latin  | fonts.gstatic.com (Google Fonts v31) | SIL OFL 1.1 — `OFL-montserrat.txt` |
| Poppins    | 400, 500, 600, 700 | latin  | fonts.gstatic.com (Google Fonts v24) | SIL OFL 1.1 — `OFL-poppins.txt`    |

Both families are licensed under the SIL Open Font License 1.1; the full
license texts ship alongside the files as required for redistribution.

Latin subset only (the storefront ships in English). Add further subsets
as additional `src` entries in `layout.tsx` if other scripts are needed.
Filenames are lowercase-only for Linux CI path compatibility.
