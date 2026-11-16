# Central Admin migrations

Forward-only, numbered SQL files for the **Central Admin** Supabase project.
They are never run on a country project (`database/migrations` is theirs),
and country migrations are never run here. Applying a file to a Supabase
project is an owner action; nothing in this repository connects to one.

| File | What it does |
| --- | --- |
| `0001_admin_core.sql` | Country roster and service registry, roles and permissions (mirroring `packages/permissions`), administrators, role assignments, invitations, append-only audit log, security events, country health checks. Row Level Security on every table, no direct writes, ten functions that check the caller and write the audit log, and the owner-only provisioning of the Master Super Admin. |
| `0002_country_actions.sql` | `admin_country_endpoint()`: a country's service address for any administrator with a role there (routing an Order Manager's request needs it). `record_country_action()`: the audit entry for a change made in a country through the console; the permission each action needs is decided in the function. |

Rules for every later file:

- Additive. A destructive change needs explicit owner approval.
- New tables get Row Level Security and explicit grants in the same file.
  Supabase grants ALL on new objects to `anon`, `authenticated` and
  `service_role` by default; revoke that and grant only what is needed.
  `tests/admin-core.test.ts` lists every function the `authenticated` role
  may execute and fails when one is added without being listed.
- A change to the role or permission catalogue is made in
  `packages/permissions` and here together; a test compares them.

Tests: `pnpm --filter @tronic/database test` applies these files to a fresh
in-process PGlite database that first receives a Supabase stand-in, then
checks grants, country isolation, privilege escalation, invitations,
suspension, country configuration and the audit log as the `authenticated`
role. Nothing is applied to Supabase or any shared database.
