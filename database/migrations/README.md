# Migrations

Forward-only, numbered SQL files. Destructive changes need explicit owner approval.
None of these has been applied to the Supabase project; applying them needs
owner approval.

| File | What it does |
|---|---|
| `0001_catalog.sql` | Catalogue tables and the storefront read model. |
| `0002_product_search.sql` | Trigram indexes and `search_products()`. |
| `0003_catalog_security.sql` | Row Level Security and explicit grants (anon/authenticated read the published catalogue only, nobody but the owner writes), security-invoker storefront view limited to active countries, `currencies` with each ISO 4217 exponent, price-currency check. |
| `0004_orders.sql` | Private `stock_levels`, `customer_profiles`, `orders`, `order_lines` with RLS (customers read only their own orders), `place_cod_order()` (reprice, stock check and reservation, idempotency key, one transaction) and `track_order()` (number plus email or phone). |

Money columns (`*_minor`) are integers in the currency's ISO 4217 minor unit:
TZS 28,000 is stored as 2800000.

## Tests (disposable database only)

`pnpm --filter @tronic/database test` applies every migration to a fresh
in-process PGlite database that first receives a Supabase stand-in (roles,
`auth.uid()`, Supabase's permissive default grants), then checks permissions,
country isolation, money units and order behaviour as the anon and
authenticated roles. Nothing is applied to Supabase or any shared database.
