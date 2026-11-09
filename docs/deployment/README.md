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

## Automatic deployments: `main` only

`frontend/vercel.json` (the Vercel Root Directory is `frontend`, so Vercel
reads the file from there, not from the repository root) sets
`git.deploymentEnabled` to `{"**": false, "main": true}`: a push to any
branch other than `main` no longer creates a Vercel deployment, so there are
no preview deployments for feature branches or pull requests. `main` keeps
deploying to production automatically, and `main` only changes through a
pull request with "Squash and merge" (the `protect-main` ruleset).

Consequences and checks:

- The "Vercel" status no longer appears on pull requests; the GitHub Actions
  job "Lint, typecheck, test, build" is the build gate. Ask an owner to make
  that job a required check in the ruleset.
- Nothing else in the Vercel project changes (Root Directory, commands,
  variables, domains). The file is read on the next deployment, so it takes
  effect once this change reaches `main`.
- To restore previews for one branch, add it as a `true` key, e.g.
  `"staging": true`; to restore the default, delete the `git` block.
