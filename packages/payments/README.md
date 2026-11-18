# @tronic/payments

Server-side payment service and the contract a payment gateway adapter
implements. No gateway is connected: TRONIC has not chosen one, and no
online method is enabled in any country (see `PAYMENT_POLICIES` in
`@tronic/country-config`). Cash on Delivery does not use this package.

```
Checkout (method, wallet, number)          browser: choice only
  -> order placed (stock reserved)         server action
  -> startPayment                          payment record, then gateway
  -> gateway prompt / hosted card page     customer approves on the gateway
  -> signed webhook -> handleWebhook       signature verified by the adapter
  -> payment_apply_update                  database: rules, order paid + confirmed
  -> order tracking / account              customer sees the result
reconcileDue (scheduled)                   status checks for lost answers, expiry
```

- `PaymentGateway` (`src/gateway.ts`): `initiate`, `fetchStatus`,
  `verifyWebhook`. One adapter per gateway; credentials server-side only.
- `PaymentStore` (`src/store.ts`): implemented by `@tronic/database/payments`
  over the functions of `database/migrations/0007_payments.sql`, which hold
  the rules (amount from the order, one payment in progress per order,
  allowed status changes, replay protection, refusals recorded).
- `createPaymentService` (`src/service.ts`): starts a payment for an order
  that is waiting for one; applies verified webhooks; settles lost answers
  with a status check; expires a waiting payment only when the gateway has
  no record of it.

Statuses: `not_initiated`, `pending`, `processing`, `successful`, `failed`,
`cancelled`, `expired`, `refunded`. They are separate from the order's
fulfilment status. Only a gateway answer moves them.

## Before a gateway can go live

1. TRONIC chooses a gateway for Tanzania and signs up for its sandbox.
2. An adapter for it (`PaymentGateway`), tested against the sandbox, plus
   the routes that call the service: start payment (after the order is
   placed), webhook, status page polling, and a scheduled `reconcileDue`.
3. Checkout places orders with an online method (today `place_cod_order`
   places Cash on Delivery orders only).
4. Migration 0007 applied by the owner.
5. In `PAYMENT_POLICIES.TZ`: `gateway` set, the method and the wallets the
   gateway supports set to `sandbox` on a test deployment, then `live`
   after production approval.

Tests: `database/client/tests/payments.test.ts` runs the service with a
stand-in gateway (defined in the test, signing its webhooks with a key made
up per run) against a disposable database.
