-- 0002_product_search.sql — product search (DRAFT, not applied anywhere).
--
-- Proposal for review before the Supabase project exists (see 0001). It is
-- the SQL counterpart of packages/api-client/src/product-search.ts, which the
-- mock catalogue runs today; the live adapter calls search_products() with
-- bound parameters, never string-built SQL. Additive only: one extension,
-- two indexes, one helper and one read-only function. Applying it to any
-- shared or production database needs owner approval.
--
-- Why trigram indexes and not full-text search: queries are short product
-- names, SKUs and model codes ("24W LED", "TR-LED-24"), where substring and
-- typo tolerance matter more than stemming. pg_trgm covers ILIKE '%…%' and
-- similarity() with a GIN index. Revisit tsvector when long descriptions
-- become searchable.

begin;

create extension if not exists pg_trgm;

-- Letters and digits only, lower case: "TR-LED 24" and "trled24" compare equal.
create or replace function search_compact(value text)
returns text
language sql
immutable
parallel safe
as $$
  select regexp_replace(lower(coalesce(value, '')), '[^[:alnum:]]+', '', 'g')
$$;

create index if not exists products_name_trgm_idx
  on products using gin (lower(name) gin_trgm_ops) where active;

create index if not exists products_sku_compact_trgm_idx
  on products using gin (search_compact(sku) gin_trgm_ops) where active;

-- Ranked search within one country. Tiers match product-search.ts:
--   0 exact SKU, 1 exact model, 2 exact name, 3 name prefix,
--   4 all words in the name or query inside SKU/model,
--   5 all words in name/SKU/brand/category, 6 fuzzy (trigram similarity).
-- Reads the storefront_products view, so inactive products, inactive
-- country rows and other countries are excluded by construction.
create or replace function search_products(
  search_text  text,
  country      char(2),
  max_results  integer default 6
)
returns table (
  id uuid, slug text, sku text, name text, category_name text, image text,
  currency char(3), price_minor bigint, was_price_minor bigint, in_stock boolean, tier integer
)
language sql
stable
security invoker
set search_path = public
as $$
  with q as (
    select
      left(regexp_replace(lower(trim(search_text)), '\s+', ' ', 'g'), 80) as text,
      search_compact(left(search_text, 80)) as compact
  ),
  words as (
    select array_remove(regexp_split_to_array((select text from q), '[^[:alnum:]]+'), '') as list
  ),
  candidates as (
    select
      sp.*,
      lower(sp.name) as lname,
      search_compact(sp.sku) as csku,
      (select array_agg(search_compact(s.value))
         from product_specifications s
        where s.product_id = sp.id and s.label ~* '^model\M') as models,
      lower(concat_ws(' ', sp.name, sp.sku, sp.brand, sp.category_name, sp.group_slug, sp.subcategory_slug)) as haystack
    from storefront_products sp
    where sp.country_code = country
  ),
  ranked as (
    select c.*,
      case
        when c.csku = (select compact from q) then 0
        when (select compact from q) = any (coalesce(c.models, '{}')) then 1
        when c.lname = (select text from q) then 2
        when c.lname like (select replace(replace(replace(text, '\', '\\'), '%', '\%'), '_', '\_') from q) || '%' then 3
        when (select bool_and(strpos(c.lname, w) > 0) from unnest((select list from words)) w)
          or (length((select compact from q)) >= 3 and strpos(c.csku, (select compact from q)) > 0) then 4
        when (select bool_and(strpos(c.haystack, w) > 0) from unnest((select list from words)) w) then 5
        when similarity(c.lname, (select text from q)) >= 0.3 then 6
      end as tier
    from candidates c
  )
  select r.id, r.slug, r.sku, r.name, r.category_name, r.image,
         r.currency, r.price_minor, r.was_price_minor, r.in_stock, r.tier
  from ranked r
  where r.tier is not null
    and length((select compact from q)) > 0
  order by r.tier, length(r.name), r.sequence desc
  limit least(greatest(coalesce(max_results, 6), 1), 48)
$$;

-- Anonymous storefront reads go through the view's RLS (see 0001); the
-- function adds no privileges of its own (security invoker).
grant execute on function search_products(text, char, integer) to anon, authenticated;

commit;
