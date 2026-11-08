-- 0001_catalog.sql — catalogue schema v1 (DRAFT, not applied anywhere).
--
-- Forward-only. Mirrors the TypeScript contracts in packages/types/src/product.ts
-- and the filtering semantics of MockCatalogClient (packages/api-client/src/catalog.ts)
-- so the Phase 4 live adapter can be a straight translation of the same query.
-- Money is integer minor units with an explicit ISO 4217 currency; TZS, KES and
-- UGX have zero decimals, so the integer is the shilling amount itself.
--
-- Written for PostgreSQL 15+ (Supabase). The Supabase project does not exist
-- yet; see docs/database/schema-v1.md for the open decisions.

begin;

create extension if not exists pgcrypto;

-- Countries the platform serves. Rows are reference data managed by owners.
create table if not exists countries (
  code        char(2) primary key,                 -- ISO 3166-1 alpha-2, e.g. 'TZ'
  name        text not null,
  currency    char(3) not null,                    -- ISO 4217, e.g. 'TZS'
  locale      text not null,                       -- BCP 47, e.g. 'en-TZ'
  active      boolean not null default true
);

-- Top-level departments (the eight navbar sections) and their groups.
create table if not exists categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,                -- e.g. 'lighting'
  name        text not null,
  sort_order  integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists category_groups (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references categories (id) on delete restrict,
  slug          text not null,                     -- e.g. 'indoor-lighting' (unique within the category)
  name          text not null,
  sort_order    integer not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (category_id, slug)
);

create table if not exists brands (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null unique
);

-- One row per sellable product. Variants (sizes, wattages) and colours are
-- modelled in child tables so a product can have options without duplication.
create table if not exists products (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,          -- route /products/[slug]
  sku               text not null unique,
  name              text not null,
  description       text,
  brand_id          uuid references brands (id) on delete set null,
  category_id       uuid not null references categories (id) on delete restrict,
  group_id          uuid references category_groups (id) on delete set null,
  variant_label     text,                          -- e.g. 'Wattage', shown above variant pills
  active            boolean not null default true,
  sequence          integer not null default 0,    -- catalogue order; "newest" sorts descending
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists products_category_group_idx on products (category_id, group_id) where active;
create index if not exists products_brand_idx on products (brand_id) where active;
create index if not exists products_sequence_idx on products (sequence desc);

create table if not exists product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products (id) on delete cascade,
  url         text not null,                       -- storage path or absolute URL
  alt         text,
  sort_order  integer not null default 0           -- 0 is the primary image
);

create index if not exists product_images_product_idx on product_images (product_id, sort_order);

create table if not exists product_variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products (id) on delete cascade,
  name        text not null,                       -- e.g. '9W'
  sort_order  integer not null default 0,
  unique (product_id, name)
);

create table if not exists product_colors (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products (id) on delete cascade,
  name        text not null,
  swatch      text not null,                       -- CSS colour for the swatch circle
  sort_order  integer not null default 0,
  unique (product_id, name)
);

-- Shop by Use: a product can serve several use cases (the groups of the
-- "use-case" section) without being duplicated into another category.
create table if not exists product_use_cases (
  product_id  uuid not null references products (id) on delete cascade,
  use_case    text not null,                       -- e.g. 'for-homeowners'
  primary key (product_id, use_case)
);

create index if not exists product_use_cases_use_case_idx on product_use_cases (use_case);

create table if not exists product_specifications (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products (id) on delete cascade,
  label       text not null,
  value       text not null,
  sort_order  integer not null default 0,
  unique (product_id, label)
);

-- Per-country availability and pricing. A product is visible in a country
-- only when a row exists here and is active: this is the country isolation
-- rule the mock client enforces with `countries.includes(code)`.
create table if not exists product_country_prices (
  product_id        uuid not null references products (id) on delete cascade,
  country_code      char(2) not null references countries (code),
  currency          char(3) not null,              -- must equal countries.currency; checked by trigger later
  price_minor       bigint not null check (price_minor >= 0),
  was_price_minor   bigint check (was_price_minor is null or was_price_minor > price_minor),
  in_stock          boolean not null default false,
  active            boolean not null default true,
  updated_at        timestamptz not null default now(),
  primary key (product_id, country_code)
);

create index if not exists product_country_prices_lookup_idx
  on product_country_prices (country_code, active, in_stock, price_minor);

-- Public read model used by the storefront listing query (Phase 4). The
-- storefront never reads base tables directly; RLS on the view's tables
-- grants anon SELECT on active rows only (policies are defined with the
-- Supabase project in a later migration, after the owner decision).
create or replace view storefront_products as
select
  p.id,
  p.slug,
  p.sku,
  p.name,
  p.description,
  b.name            as brand,
  c.slug            as category_slug,
  c.name            as category_name,
  g.slug            as group_slug,
  p.variant_label,
  p.sequence,
  (select array_agg(u.use_case order by u.use_case) from product_use_cases u where u.product_id = p.id) as use_cases,
  pcp.country_code,
  pcp.currency,
  pcp.price_minor,
  pcp.was_price_minor,
  pcp.in_stock,
  (select url from product_images i where i.product_id = p.id order by i.sort_order limit 1) as image
from products p
join categories c            on c.id = p.category_id and c.active
left join category_groups g  on g.id = p.group_id
left join brands b           on b.id = p.brand_id
join product_country_prices pcp on pcp.product_id = p.id and pcp.active
where p.active;

commit;
