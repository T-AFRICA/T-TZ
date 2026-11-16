# Roles and permissions

`@tronic/permissions`: the role and permission catalogue of the Central
Admin and the functions that decide what an administrator may do
(`can`, `canAccessCountry`, `grantRefusal`, `canSuspend`, …). Pure
TypeScript, no I/O; the caller builds the `Actor` from a verified session
and the admin database.

- `src/catalogue.ts` — permissions (22 per country, 5 global), nine roles,
  who may give each role and which need a second factor.
- `src/authorize.ts` — the decisions. A permission is always checked with a
  country; only the Master Super Admin role is global.

The Central Admin database enforces the same rules again
(`database/admin-migrations`) and seeds the same catalogue; a database test
compares the two. Change both together.

Tests: `pnpm --filter @tronic/permissions test`.
