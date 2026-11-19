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
order number is never put in a URL. The order is linked to the customer from
the verified session.

Since 2026-11-19 (owner decision) there is no guest checkout: signed out,
`/checkout` redirects to `/login?next=/checkout…` (register from there keeps
`next`), the action answers `sign_in_required` without a session, and
migration 0015 revokes `place_cod_order` from `anon`.

## Payment methods (2026-11-18)

Which methods and wallets a country offers comes from its payment policy
(`packages/country-config/src/payments.ts`); `config.ts` only adds the
labels. `components/checkout/PaymentMethods.tsx` shows the method cards and
the fields of the chosen method (mobile money: wallet and number; card: the
gateway's hosted page; bank transfer: confirmed accounts only). Methods
without an approved gateway show "Coming soon" and cannot be chosen; today
Cash on delivery is the only one. Cash on delivery can be limited by region
and order total in the policy; the server action checks both. The form is
kept in `sessionStorage` for the tab and cleared once the order is placed.
The server side of online payments is `@tronic/payments` (not wired to
checkout until a gateway is approved).

Amounts are integers in ISO 4217 minor units (TZS ×100) everywhere; see
`packages/country-config/src/money.ts`.
