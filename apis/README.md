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
  reason. Version 1: `GET /health` (`settings.read`), `GET /orders` and
  `GET /orders/:number` (`orders.read`), `POST /orders/:number/status` and
  `POST /orders/:number/notes` (`orders.update`), all under `/api/admin/v1`.
  A business refusal (unknown order, a status the order cannot move to) is
  a 200 answer with `ok: false` and a code.

The country side lives in `@tronic/database/country-admin`
(`handleCountryAdminRequest`): one function from request to response that
the storefront serves at `frontend/src/app/api/admin/v1/[...path]`.

Not here yet: the public storefront API contracts (OpenAPI, versioning)
this folder was first reserved for.

Tests: `pnpm --filter @tronic/api-contracts test`. Key pairs are generated
in memory for the run; no key is in the repository.
