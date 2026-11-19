# Migrations

Forward-only, numbered SQL files. Destructive changes need explicit owner approval.
Applying them to the Supabase project is an owner action. As reported by the
owner on 2026-11-14, 0001-0003 are applied there; 0004 and 0005 are not yet.

| File | What it does |
|---|---|
| `0001_catalog.sql` | Catalogue tables and the storefront read model. |
| `0002_product_search.sql` | Trigram indexes and `search_products()`. |
| `0003_catalog_security.sql` | Row Level Security and explicit grants (anon/authenticated read the published catalogue only, nobody but the owner writes), security-invoker storefront view limited to active countries, `currencies` with each ISO 4217 exponent, price-currency check. |
| `0004_orders.sql` | Private `stock_levels`, `customer_profiles`, `orders`, `order_lines` with RLS (customers read only their own orders), `place_cod_order()` (reprice, stock check and reservation, idempotency key, one transaction) and `track_order()` (number plus email or phone). |
| `0006_order_admin.sql` | Order administration for the Central Admin: `order_status_events` and `order_notes` (private), and four functions executable by `service_role` only: list, detail, status change (one step forward at a time, cancel until dispatched with the stock put back, Cash on Delivery paid at delivery, the same request applied once) and internal notes. Customers and visitors get nothing new. Requires 0004. |
| `0007_payments.sql` | DRAFT, not applied anywhere: online payment records for an approved gateway. Orders may carry `mobile_money`, `card` or `bank_transfer`; private `payments` (amount and currency copied from the order, one payment in progress and at most one successful per order, TRONIC reference and the gateway's) and `payment_events` (every change and every refused attempt, codes only). Functions executable by `service_role` only: start (idempotency key), apply a verified gateway answer (allowed status changes, amount/currency/gateway/reference checks, each gateway event once; success marks the order paid and confirms it), expire (only waiting payments past their time), lookups for reconciliation. A customer reads the payments of their own orders, without the payer's number or the event log. Requires 0004. Not needed while Cash on Delivery is the only method. |
| `0008_deliveries.sql` | DRAFT, not applied anywhere: deliveries by TRONIC's own riders. Private `deliveries` (rider, six-digit customer code, wrong-code lock, cash collected), `delivery_proofs` (photo and signature, at most 1 MB each) and `delivery_attempts` (failed attempts with a reason). `service_role` functions: assign a rider (confirmed to packed; another rider until pickup), the rider's list and order (only orders given to that rider), the rider's steps (picked up, on the way, delivered with code, both proofs and the Cash on Delivery amount, failed attempt), the delivery and proofs for administrators (never the code). `customer_delivery_code()` for the customer (own order, or number plus checkout email or phone) while the order is on its way. Requires 0006. |
| `0009_admin_summary.sql` | DRAFT, not applied anywhere: `admin_country_summary()` (`service_role` only) for the Central Admin's country dashboard. Counts from the country's own records: orders (all, today in Africa/Dar_es_Salaam, open, by status), paid sales of orders placed in the last 30 days, customer accounts, products on sale, out of stock and low stock (5 or fewer). Nothing is estimated. Requires 0004. |
| `0005_customer_avatars.sql` | Private Storage bucket `avatars` (2 MB; JPEG, PNG, WebP) and policies on `storage.objects`: a signed-in customer can create, read, replace and delete only `<their user id>/avatar`. Independent of 0001-0004. |

Money columns (`*_minor`) are integers in the currency's ISO 4217 minor unit:
TZS 28,000 is stored as 2800000.

## Setting up a new Supabase project

Each step is an owner action in the Supabase dashboard or the hosting
settings. Nothing in this repository connects to the project by itself.

1. **Tables and rules.** In the SQL editor, run `0001` to `0005` in order,
   one file at a time. Each file is one transaction: a failure changes
   nothing. `0005` (profile photos) does not depend on the others.
2. **Products.** The storefront shows nothing until the catalogue tables
   have rows. For the SAMPLE catalogue (the one mock mode shows):
   - `pnpm --filter @tronic/database run setup:sql` writes
     `database/out/sample-catalogue.sql` (not committed) and checks it
     against a disposable database;
   - run that file in the SQL editor. It stops, changing nothing, if
     `0004` is missing or the catalogue already has products, categories
     or brands.
   - The prices and stock in it are placeholders. Once step 3 is done the
     storefront takes real Cash on Delivery orders at those prices, so
     replace them with the approved catalogue and price list first, or
     keep the site private until then.
3. **Connect the storefront.** In the hosting settings set `DATABASE_URL`
   to the project's transaction pooler connection string (port 6543) and
   `DATA_SOURCE=database`, then redeploy. Do this last: with
   `DATA_SOURCE=database` and missing tables, catalogue, checkout and
   account pages answer with a server error.
4. **Check.** A category page lists products, a product page opens, and a
   test order placed at checkout appears under Account, My orders.

## Tests (disposable database only)

`pnpm --filter @tronic/database test` applies every migration to a fresh
in-process PGlite database that first receives a Supabase stand-in (roles,
`auth.uid()`, the Storage tables, Supabase's permissive default grants), then checks permissions,
country isolation, money units and order behaviour as the anon and
authenticated roles. Nothing is applied to Supabase or any shared database.
