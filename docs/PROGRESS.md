# TRONIC delivery progress

Module-by-module tracker against the 22-week roadmap (W01 = 02 Nov 2026).
Statuses: Planned · In progress · In review · Done. A module is Done only
after review/merge and with its verification evidence recorded; unverified
work stays listed under limitations.

| Module | Roadmap week(s) | Scope | Status | PR | Verification | Known limitations |
| --- | --- | --- | --- | --- | --- | --- |
| M01 Design system & global shell | W01 | Monorepo scaffold, brand tokens, header, mega-menu navbar (8 categories + Meter), search shell, country selector, footer, CI | In review | — | `pnpm run lint` / `typecheck` / `test` (10 passing) / `build` all green locally; manual responsive check at 375px and desktop in browser | Placeholder brand mark (official logo SVGs not yet supplied); placeholder announcement offer, support phone and hero campaign copy pending business content (social links hidden until profile URLs confirmed); subcategory depth limited to SRS group level pending Website Content Structure doc; brand typography and #D71920 action red pending formal sign-off |
| M02 Homepage & catalog templates | W02 | Hero, promotions, search/PLP/PDP templates, variant UI; Cables & Wiring + Lighting content | Planned | — | — | — |
| M03 Commerce UI | W03 | Cart, checkout UI, auth screens; Switches & Sockets + Switchgear content | Planned | — | — | — |
| M04 Account, tracking & Meter UI | W04 | My Account, tracking preview, single /meter page (mock, no payment); Home & Appliances + Cable Management content | Planned | — | — | — |
| M05 Admin CMS & Meter Admin UI | W05 | Admin dashboard, catalog/category editor, protected Meter Admin mocks; Tools + Shop by Use content | Planned | — | — | — |
| M06 Rider/dispatch UI & content pages | W06 | Rider jobs, dispatch fleet map prototype, About/Locations/Blog/Showrooms + 8 policy pages | Planned | — | — | — |
| M07 API contracts & hardening | W07 | Typed clients, SEO, accessibility, content QA | Planned | — | — | — |
| M08 Frontend QA & sign-off | W08 | Playwright journeys, responsive review, W08 gate evidence | Planned | — | — | — |
| M09+ Integrations, QA, UAT | W09–W12 | POS, payments, meter issuer, GPS; security tests; Tanzania gate | Planned | — | — | — |

Conventions: branch `feat/module-NN-<topic>`, PR title prefixed `[MNN]`,
one PR per module, independent review before merge (see rulesd.md §1).
