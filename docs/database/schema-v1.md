# Catalogue schema v1 (draft)

Status: **draft, not applied**. No Supabase project exists yet (owner decision
pending, see the architecture plan §3). This document describes
`database/migrations/0001_catalog.sql` and how the storefront's catalogue
adapter maps onto it, so Phase 4 is a translation job rather than a redesign.

## Tables

| Table | Purpose | Notes |
| --- | --- | --- |
| `countries` | Countries served (TZ first) | currency + locale drive money formatting |
| `categories` | The eight departments | `slug` is the route segment `/categories/[slug]` |
| `category_groups` | Groups inside a department | unique `(category_id, slug)`; route `/categories/[slug]/[group]` |
| `category_subcategories` | Subcategories inside a group (Website Content Structure 2026-11-09) | unique `(group_id, slug)`; route `/categories/[slug]/[group]/[subcategory]` |
| `brands` | Brand facet | optional per product |
| `products` | One row per sellable product | `slug` is the route `/products/[slug]`; `sequence` orders "newest" |
| `product_images` | Gallery, `sort_order` 0 is primary | storage path or URL |
| `product_variants` | Option pills (e.g. wattage) | label lives on `products.variant_label` |
| `product_colors` | Colour swatches | CSS colour string |
| `product_specifications` | Verified label/value rows | shown only when present |
| `product_use_cases` | Shop by Use membership (for-homeowners, for-contractors, for-commercial) | many-to-many; no product is copied into a second category |
| `product_country_prices` | Availability and price per country | **the country-isolation table** |

Money: `price_minor` / `was_price_minor` are integer minor units with an
explicit `currency`. TZS, KES and UGX have zero decimals, so the integer is the
shilling amount. Formatting uses the country's locale
(`packages/country-config/src/money.ts`).

## Mapping to `Product` (packages/types)

| `Product` field | Source |
| --- | --- |
| `id`, `slug`, `sku`, `name`, `description`, `variantLabel`, `sequence`, `active` | `products` |
| `brand` | `brands.name` |
| `categorySlug`, `categoryName` | `categories` |
| `groupSlug` | `category_groups.slug` |
| `subcategorySlug` | `category_subcategories.slug` |
| `image`, `images` | `product_images` ordered by `sort_order` |
| `price`, `wasPrice`, `currency`, `inStock` | `product_country_prices` for the request country |
| `countries` | all active `product_country_prices.country_code` for the product |
| `variants`, `colors`, `specifications` | child tables ordered by `sort_order` |
| `useCases` | `product_use_cases.use_case` |

## Listing query (what the live adapter must do)

`CatalogClient.listProducts(query)` in the mock filters in this order; the SQL
is the same shape against `storefront_products`:

1. `country_code = :country and active` (never optional).
2. `category_slug = :category`, `group_slug = :group`, `subcategory_slug = :subcategory` when given; for the
   Shop by Use section instead `use_cases && :useCases` (any of the chosen
   use cases, across every department).
3. Facets (`brands`, `priceMin`, `priceMax`) are computed on the result of
   steps 1–2, **before** user filters, so the sidebar keeps showing every
   option in the section.
4. `brand in (:brands)`, `price_minor between :min and :max`, `in_stock`.
5. Sort: `newest` → `sequence desc`; `price-asc/desc` → `price_minor, sequence`;
   `name-asc` → `name collate "en-x-icu", sequence`.
6. `limit :pageSize offset (:page - 1) * :pageSize`, page size clamped to 1–48,
   page clamped to the last page; `total` from `count(*) over ()`.

`getProduct(slug, country)` joins the same view and returns `null` when the
product has no active row for that country, even if it exists elsewhere.

## Security model (to be written with the project)

- Storefront reads through the anon role with RLS allowing `select` on active
  rows only; writes happen through the admin app with authenticated roles.
- No price, stock or token data is ever trusted from the browser; totals are
  computed server-side (rules §4).
- Service-role keys stay in Vercel server-side variables, never `NEXT_PUBLIC_*`.

## Open decisions

- Supabase org/region/tier and whether Supabase Auth is used.
- Whether the sample catalogue is seeded as-is (with SAMPLE flags) or replaced
  by approved content before any public listing.
- Collation for `name-asc` across Swahili/English names.
