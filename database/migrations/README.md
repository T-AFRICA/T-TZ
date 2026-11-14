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
