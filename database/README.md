# Database (Supabase PostgreSQL, Phase 4)

- `migrations/` — forward-only, numbered SQL files reviewed in PRs
  (`0001_core.sql` first). Destructive changes need explicit owner approval.
- `seed.sql` — the sample catalogue (SKUs, images, descriptions) for local and
  preview environments.
- `client/` — generated types and the server-only query layer used by
  `frontend/`, `admin/` and `backend/`; the browser never imports it.
- `config.toml` — Supabase CLI project config.

The Supabase project itself is created by the owner and is never reset in
place; privileged keys stay in server-side environment variables.
