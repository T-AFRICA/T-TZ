# Checkout feature (Phase 5)

Address, delivery option and order creation with idempotency keys; payment hand-off to the provider adapter.

## Frontend (2026-11-10)

`/checkout` is built and wired to the cart and Buy Now. `quote.ts` prices
lines on the server, `validation.ts` holds the form rules the order action
must re-run, and `config.ts` holds the delivery and payment options
(Cash on delivery open; the rest unavailable) plus `ORDERS_CONNECTED`.
Still to come with Supabase: the order action (idempotency key, totals
recomputed in the transaction), the confirmation page and order lookup.
