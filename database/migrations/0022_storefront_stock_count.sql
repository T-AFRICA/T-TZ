-- 0022_storefront_stock_count.sql — the storefront shows how many units of a
-- product are available (DRAFT).
--
-- Forward-only. Exercised only against a disposable PGlite database with a
-- Supabase role shim (database/client/tests); applying it to a Supabase
-- project needs owner approval. Requires 0003 and 0004. Safe to run again.
--
-- Owner decision 2026-11-21: customers see the number of units available,
-- not only "in stock" or "out of stock". Until now that number was private
-- (0004): the storefront saw product_country_prices.in_stock and nothing
-- else. From here the count of a product that is on sale is public
-- information, on purpose.
--
-- What changes:
--   * storefront_products gains a last column, "available": the units in
--     stock_levels for that product and country, or null when the product
--     has no stock record. The view is otherwise the one of 0003 (same
--     columns in the same order, evaluated with the caller's rights).
--   * storefront_available(product, country) reads that one number for the
--     view. stock_levels itself stays private: visitors and customers still
--     cannot read or change the table.
--
-- What stays private: the count of a product that is not on sale. The
-- function answers only for a product the storefront lists (active product,
-- active category, an active price in an active country), so calling it
-- directly with the id of a draft or hidden product returns nothing.
--
-- A storefront from before this migration keeps working (it reads the
-- columns it knows); one from after it shows the count once this has run
-- and "In stock" until then.

begin;

create or replace function storefront_available(p_product uuid, p_country char(2))
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.available
    from stock_levels s
    join products p on p.id = s.product_id and p.active
    join categories c on c.id = p.category_id and c.active
    join product_country_prices pcp
      on pcp.product_id = p.id and pcp.country_code = s.country_code and pcp.active
    join countries co on co.code = s.country_code and co.active
   where s.product_id = p_product
     and s.country_code = p_country
$$;

revoke execute on function storefront_available(uuid, char) from public;
grant execute on function storefront_available(uuid, char) to anon, authenticated;

create or replace view storefront_products with (security_invoker = true) as
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
  sc.slug           as subcategory_slug,
  p.variant_label,
  p.sequence,
  (select array_agg(u.use_case order by u.use_case) from product_use_cases u where u.product_id = p.id) as use_cases,
  pcp.country_code,
  pcp.currency,
  pcp.price_minor,
  pcp.was_price_minor,
  pcp.in_stock,
  (select url from product_images i where i.product_id = p.id order by i.sort_order limit 1) as image,
  storefront_available(p.id, pcp.country_code) as available
from products p
join categories c            on c.id = p.category_id and c.active
left join category_groups g  on g.id = p.group_id
left join category_subcategories sc on sc.id = p.subcategory_id
left join brands b           on b.id = p.brand_id
join product_country_prices pcp on pcp.product_id = p.id and pcp.active
join countries co            on co.code = pcp.country_code and co.active
where p.active;

commit;
