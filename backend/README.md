# Backend (business logic)

Domain services that every app calls and no browser imports: orders, cart and
checkout rules, pricing and inventory, payments, delivery, and the SAP Business
One / POS integration adapters.

- `worker/` — long-running jobs (SAP/POS synchronisation, reconciliation,
  retries), hosted outside Vercel (Phase 7).
- Further service modules are added per phase (Phase 5 onward) and exposed
  through `apis/` contracts; shared types, validation and permissions live in
  `packages/`, database access in `database/client`.
