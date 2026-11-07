# Tests

- Unit and component tests stay next to the code they cover (`frontend/src/**/*.test.tsx`,
  run by Vitest through `pnpm run test`).
- `integration/` (Phase 5) — service and API contract tests against a Supabase
  preview branch.
- `e2e/` (Phase 7) — browser flows (browse → cart → checkout → sandbox payment)
  for the single-product POC and the release gates.
