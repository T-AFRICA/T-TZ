# Checkout feature

Address, delivery option and order creation with idempotency keys; payment hand-off to the provider adapter.

## Frontend (2026-11-10)

`/checkout` is wired to the cart and Buy Now. `quote.ts` prices lines on the
server from the catalogue client, `validation.ts` holds the form rules the
order action re-runs, and `config.ts` holds the delivery and payment options
(Cash on delivery open; the rest unavailable).

## Orders (2026-11-11)

`actions.ts` → `placeOrderAction` places a Cash on Delivery order when
`DATA_SOURCE=database` (`features/data/source.ts: ordersEnabled`). It
re-validates the form, then calls `place_cod_order` (database/migrations
0004), which reprices every line from the catalogue, checks options and
stock, reserves stock and writes the order in one transaction. The browser
sends an idempotency key per distinct submission, so retries return the same
order. The page shows the confirmation only after the order is saved; the
order number is never put in a URL. Guest checkout stays allowed; a signed-in
customer's order is linked from the verified session.

Amounts are integers in ISO 4217 minor units (TZS ×100) everywhere; see
`packages/country-config/src/money.ts`.
