# Deployment docs (Phase 4+)

Vercel project settings (root directory, commands, variable names), the admin
project, worker hosting and rollback.

## Root directory change (with the top-level layout PR)

The storefront moved from `apps/storefront` to `frontend/`. The Vercel project
for tronic.tz / tronic.live must have its **Root Directory set to `frontend`**
(Settings → General → Root Directory) at the moment the layout PR is merged;
until then preview builds of that PR fail, and after the merge production
builds fail until the setting is changed. Install and build commands stay the
defaults (`pnpm install --frozen-lockfile`, `next build`). Rollback: revert
the PR and set the Root Directory back to `apps/storefront`.
