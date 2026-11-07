# APIs (Phase 5+)

Public API surface: endpoint definitions, request/response contracts
(OpenAPI), versioning (`v1`) and the gateway layer that fronts the business
services in `backend/`. In the first phases the handlers themselves run as
Next.js Route Handlers and Server Actions inside `frontend/` and `admin/`; the
contracts and gateway configuration live here so every consumer (storefront,
admin, worker, future mobile apps, SAP/POS adapters) shares one definition.
No package.json yet, so the workspace ignores this folder.
