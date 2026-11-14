# Customer portal

The signed-in customer's account area under `/account` (owner brief
2026-11-14). This document records what is connected, what each screen is
waiting for, and the database changes proposed for the missing parts.
Nothing in the proposal has been applied.

## What it needs to work

The portal has no sample-data mode. It shows real records or says that a
module is not connected.

| Requirement | Variables | Without it |
| --- | --- | --- |
| Supabase Auth | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `WEB_ORIGIN` | Every `/account` page redirects to `/login`; the sign-in form is disabled |
| Order database | `DATA_SOURCE=database`, `DATABASE_URL`, migrations 0001–0004 applied | Orders, tracking and payments show "Not connected yet" |
| Profile photo storage | Supabase Storage with migration `0005_customer_avatars.sql` applied (no new variable) | Uploading answers "We could not save your photo"; the rest of the profile works |

As of 2026-11-14 neither is configured on this machine or on the deployed
site (the live sign-in page still shows "Authentication will be available
when account services are connected"). Applying migrations to a Supabase
project and setting the variables are owner actions.

## Screens

| Route | Screen | Data today |
| --- | --- | --- |
| `/account` | Dashboard: greeting, counts, recent orders, quick actions, recently viewed | Auth profile; `orders` (own rows); browser wishlist and view history |
| `/account/orders` | Order list: status tabs, search by number, date range, sort, paging | `orders` + `order_lines`, filtered in SQL |
| `/account/orders/[orderNumber]` | Order details: items, SKU, variant, prices, totals, recipient, address | `orders` + `order_lines` |
| `/account/orders/[orderNumber]/tracking` | Timeline for one order | `orders.status`, `payment_status`, `delivery_method`, `created_at` |
| `/account/tracking` | Orders in progress with a compact timeline | same |
| `/account/wishlist` | Wishlist | The storefront's browser store (`features/cart/store`) |
| `/account/payments` | Payment method, amount and status per order | `orders.payment_method`, `payment_status`, `total_minor` |
| `/account/profile` | Name and phone (editable), email (read-only), optional profile photo, country | Supabase Auth user metadata; private Storage bucket `avatars` |
| `/account/security` | Password reset link, email verification state, sign out | Supabase Auth |
| `/account/addresses` | Saved addresses | **Not connected** |
| `/account/invoices` | Invoices and receipts | **Not connected** |
| `/account/notifications` | Order and account updates | **Not connected** |
| `/account/support` | FAQs, policy pages, the existing WhatsApp link | Static; recent orders for the "ask about this order" links |

`/track-order` (guests) is unchanged: order number **and** the checkout
email or phone must match, and a wrong pair gives the same answer as an
unknown number.

## Rules the portal follows

- **Own records only.** Every database read runs as the `authenticated`
  role with the session's user id (`withAccess`), so Row Level Security
  (migration 0004) filters the rows. Filters from the URL are validated on
  the server and can only narrow that set.
- **No enumeration.** Another customer's order and an unknown order number
  both show the same "Page not found" on the details and tracking pages.
  (The HTTP status is 200 in both cases, because account pages stream
  behind a loading skeleton and the headers are sent first.)
- **Three guards.** The proxy redirects signed-out visitors, the account
  layout checks the session, and every page checks it again
  (`requireCustomer`), because a layout is not re-run on every navigation.
- **Nothing invented.** The timeline shows the recorded status; the only
  timestamp is the order date. Courier, tracking number and delivery
  estimate are "Not available yet". There are no demo orders, payments,
  invoices or notifications.
- **No client-side order changes.** Cancellation and returns are not
  offered; the API roles cannot update `orders` at all.
- **Profile photo: optional, private, checked on the server.**
  - One object per customer, `<user id>/avatar`, in the private bucket
    `avatars`. The path always comes from the session; Storage policies
    (migration 0005) refuse any other path and any other customer.
  - The server action checks the size (2 MB) and the real file type from
    the first bytes (JPEG, PNG or WebP), whatever the name or the browser
    says. With JavaScript the browser first redraws the photo as a square
    of at most 512 pixels, which also drops camera metadata such as
    location; without JavaScript the file is stored as sent.
  - There is no public URL. `/account/photo/<version>` returns the
    signed-in customer's own photo and an empty 404 for anything else. The
    response is `private, no-cache`.
  - The auth profile holds only a version number (`avatar_version`), used
    to tell that a photo exists and to change its address when replaced.
    A customer can edit their own metadata, so it is never trusted for
    where a photo is or whose it is.
  - The photo is shown to its owner only (sidebar and profile). It is not
    shown to other customers or on public pages.
- **Motion** is a page entrance (fade and rise) and a one-time reveal of the
  timeline steps; neither suggests order progress, and both are off under
  reduced motion.

## Typed services

`frontend/src/features/account/service.ts` defines `AccountService` and its
record types. The database functions are in `database/client/src/orders.ts`.

| Method | Returns | State |
| --- | --- | --- |
| `getProfile()` | `CustomerProfile` | Connected (Supabase Auth) |
| `getOrderCounts()` | `OrderCounts` | Connected (`countCustomerOrdersByStatus`) |
| `listOrders(query)` | `CustomerOrderPage` | Connected (`listCustomerOrderPage`) |
| `getOrder(orderNumber)` | `CustomerOrderDetail \| null` | Connected (`getCustomerOrder`) |
| `getTracking(order)` | `OrderTracking` | Connected, from the order's status (`buildTracking`) |
| `listPayments(query)` | `PaymentRecord[]` | From order records; `transactionReference` is always null |
| `listAddresses()` | `SavedAddress[]` | `not_connected` |
| `listInvoices()` | `InvoiceRecord[]` | `not_connected` |
| `listNotifications()` | `CustomerNotification[]` | `not_connected` |
| `listSessions()` | `CustomerSession[]` | `not_connected` |

A method without a backend returns `{ status: "not_connected", waitingFor }`
and the screen shows that text. Connecting a module means implementing the
method; the screens already render the `ok` shape.

## Proposed database changes (for approval, not applied)

Each table would get Row Level Security with own-rows-only policies for
`authenticated`, no access for `anon`, and writes only through
security-definer functions or the service role of a back-office process.

| Table | Purpose | Key columns |
| --- | --- | --- |
| `order_status_events` | Status history and tracking timeline with real timestamps | `order_id`, `status`, `occurred_at`, `source` (`storefront`, `pos`, `sap`, `courier`, `staff`), `external_event_id` (unique per source, for idempotent integration), `note` |
| `order_shipments` | Courier, tracking number, dispatch and delivery times | `order_id`, `provider`, `tracking_number`, `dispatched_at`, `delivered_at`, `estimated_from`, `estimated_to` |
| `payments` | One row per payment attempt, written only from verified provider callbacks | `order_id`, `provider`, `provider_reference` (unique), `method`, `amount_minor`, `currency`, `status`, `occurred_at`. No card data |
| `customer_addresses` | Saved delivery addresses | `user_id`, `recipient_name`, `phone`, `region`, `district`, `ward`, `street`, `instructions`, `is_default` (one default per user) |
| `wishlist_items` | Wishlist per customer | `user_id`, `product_id`, `created_at`; unique (`user_id`, `product_id`). Guest list merges on sign-in, keeping the union |
| `customer_notifications` | Notification centre | `user_id`, `kind`, `order_id`, `title`, `body`, `created_at`, `read_at` |
| `invoices` | Invoice metadata; the PDF lives in private storage behind signed, short-lived links | `order_id`, `invoice_number` (unique), `issued_at`, `total_minor`, `currency`, `storage_path` |

Also proposed:

- More order statuses where the business uses them: `out_for_delivery`,
  `delivery_failed`, `on_hold`, `returned`. Today `orders.status` allows
  `pending_payment`, `confirmed`, `processing`, `packed`, `dispatched`,
  `in_transit`, `delivered`, `cancelled`.
- A trigger or function that writes an `order_status_events` row whenever
  `orders.status` changes, so history can never be skipped.
- An index on `orders (user_id, status, created_at desc)` if the order list
  grows.

## Integration path

1. **Now:** storefront orders (Cash on Delivery) → `orders`; staff update
   `orders.status` in the database; the portal shows it.
2. **Status history:** add `order_status_events`; `buildTracking` reads the
   events and shows each step's real time.
3. **Payments:** a provider's verified, idempotent webhook writes `payments`
   and `orders.payment_status`; `listPayments` reads `payments`.
4. **POS / SAP / courier:** a backend worker receives their events, keyed
   by `external_event_id`, and writes status events and shipments. Retries
   must not duplicate events, orders or stock movements. No POS or SAP
   endpoint is assumed here.
5. **Live updates:** once events exist, the tracking page can poll or use an
   authorised realtime subscription on the customer's own rows.
6. **Guest tracking:** add a one-time code sent to the checkout contact
   before showing order details, once an email / SMS provider is connected.

## Not done yet

- Addresses, invoices, notifications, sessions, phone verification and
  communication preferences have screens but no backend.
- Changing the email address, cancelling an order and requesting a return.
- Wishlist sync between devices.
- The profile photo on a real Supabase project: migration 0005 has not
  been applied by this repository, and uploads were tested only against
  the stand-in Storage endpoints of the browser tests.
- Verification against a real Supabase project: the portal is tested with
  the disposable test database and the stand-in auth server (`pnpm --filter
  @tronic/storefront run e2e`).
