# API contracts

`@tronic/api-contracts`: the definitions shared by the two ends of a
server-to-server call, so both are compiled against the same contract.

- `src/service-token.ts` — signed requests from the Central Admin to a
  country backend: a 60-second ES256 token (the `jose` library) bound to
  the country, the administrator, one permission and the exact method,
  path and body. `createServiceTokenSigner` is for the admin,
  `createServiceTokenVerifier` for a country. A country holds only the
  public key.
- `src/country-admin-api.ts` — country admin API version 1 and the typed
  adapter the admin uses (`createCountryAdminApi`): HTTPS only, a time
  limit, no redirects, no retries, every failure a typed "unavailable"
  reason. Version 1 has one endpoint, `GET /api/admin/v1/health`.

Not here yet: the country-side handlers (no storefront serves
`/api/admin/v1/*`), and the public storefront API contracts (OpenAPI,
versioning) this folder was first reserved for.

Tests: `pnpm --filter @tronic/api-contracts test`. Key pairs are generated
in memory for the run; no key is in the repository.
