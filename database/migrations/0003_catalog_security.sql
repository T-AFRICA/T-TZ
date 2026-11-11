-- 0003_catalog_security.sql — catalogue access control and money units (DRAFT).
--
-- Forward-only, additive. Not applied to any shared database: it is
-- exercised against a disposable PGlite database with a Supabase role shim
-- (database/client/tests). Applying it to the Supabase project needs owner
-- approval.
--
-- What it enforces (review 2026-11-11):
--   * Row Level Security on every catalogue table. The anon and
--     authenticated roles can read only the public catalogue: active
--     products in an active category, priced in an active country.
--   * Explicit grants. Supabase grants ALL on new public tables to anon and
--     authenticated by default; this revokes that and grants SELECT on the
--     catalogue only. Nobody but the owner can write the catalogue.
--   * Publication and country rules in the read model: storefront_products
--     is a security-invoker view, so the RLS above applies to it, and it
--     joins only active countries. search_products reads that view.
--   * Money units: a currencies table records each ISO 4217 exponent, and a
--     trigger keeps every price in its country's currency.

begin;

-- ---------------------------------------------------------------- money --

-- Every *_minor column is an integer in this currency's ISO 4217 minor
-- unit: TZS 28,000 is stored as 2800000 (exponent 2); UGX 50,000 as 50000.
create table if not exists currencies (
  code      char(3) primary key,
  exponent  smallint not null check (exponent between 0 and 3)
);

insert into currencies (code, exponent) values ('TZS', 2), ('KES', 2), ('UGX', 0)
on conflict (code) do update set exponent = excluded.exponent;

alter table countries
  add constraint countries_currency_fkey foreign key (currency) references currencies (code);

create or replace function product_country_prices_currency_check()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.currency is distinct from (select c.currency from countries c where c.code = new.country_code) then
    raise exception 'price currency % does not match the currency of country %', new.currency, new.country_code
      using errcode = 'check_violation';
  end if;
  return new;
end
$$;

drop trigger if exists product_country_prices_currency on product_country_prices;
create trigger product_country_prices_currency
  before insert or update of currency, country_code on product_country_prices
  for each row execute function product_country_prices_currency_check();

-- ------------------------------------------------------------ read model --

-- Same columns as 0001, now evaluated with the caller's rights (so RLS
-- applies) and restricted to active countries.
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
  (select url from product_images i where i.product_id = p.id order by i.sort_order limit 1) as image
from products p
join categories c            on c.id = p.category_id and c.active
left join category_groups g  on g.id = p.group_id
left join category_subcategories sc on sc.id = p.subcategory_id
left join brands b           on b.id = p.brand_id
join product_country_prices pcp on pcp.product_id = p.id and pcp.active
join countries co            on co.code = pcp.country_code and co.active
where p.active;

-- pg_trgm lives in "extensions" on Supabase and in "public" elsewhere.
alter function search_products(text, char, integer) set search_path = public, extensions;

-- ------------------------------------------------------- row level security --

alter table currencies               enable row level security;
alter table countries                enable row level security;
alter table categories               enable row level security;
alter table category_groups          enable row level security;
alter table category_subcategories   enable row level security;
alter table brands                   enable row level security;
alter table products                 enable row level security;
alter table product_images           enable row level security;
alter table product_variants         enable row level security;
alter table product_colors           enable row level security;
alter table product_use_cases        enable row level security;
alter table product_specifications   enable row level security;
alter table product_country_prices   enable row level security;

-- Read-only policies for the public catalogue. There are no INSERT, UPDATE
-- or DELETE policies, so even a mistaken grant could not write through RLS.
-- Subqueries are themselves filtered by the policies of the tables they
-- read; the chain has no cycle (products -> categories, prices -> countries).
create policy currencies_public_read on currencies
  for select to anon, authenticated using (true);

create policy countries_public_read on countries
  for select to anon, authenticated using (active);

create policy categories_public_read on categories
  for select to anon, authenticated using (active);

create policy category_groups_public_read on category_groups
  for select to anon, authenticated
  using (active and exists (select 1 from categories c where c.id = category_groups.category_id));

create policy category_subcategories_public_read on category_subcategories
  for select to anon, authenticated
  using (active and exists (select 1 from category_groups g where g.id = category_subcategories.group_id));

create policy brands_public_read on brands
  for select to anon, authenticated using (true);

-- A price row is public when it is active and its country is active.
create policy product_country_prices_public_read on product_country_prices
  for select to anon, authenticated
  using (active and exists (select 1 from countries co where co.code = product_country_prices.country_code));

-- A product is public when it is active, its category is active and it is
-- priced in at least one active country.
create policy products_public_read on products
  for select to anon, authenticated
  using (
    active
    and exists (select 1 from categories c where c.id = products.category_id)
    and exists (select 1 from product_country_prices pcp where pcp.product_id = products.id)
  );

create policy product_images_public_read on product_images
  for select to anon, authenticated using (exists (select 1 from products p where p.id = product_images.product_id));

create policy product_variants_public_read on product_variants
  for select to anon, authenticated using (exists (select 1 from products p where p.id = product_variants.product_id));

create policy product_colors_public_read on product_colors
  for select to anon, authenticated using (exists (select 1 from products p where p.id = product_colors.product_id));

create policy product_use_cases_public_read on product_use_cases
  for select to anon, authenticated using (exists (select 1 from products p where p.id = product_use_cases.product_id));

create policy product_specifications_public_read on product_specifications
  for select to anon, authenticated using (exists (select 1 from products p where p.id = product_specifications.product_id));

-- ----------------------------------------------------------------- grants --

-- Undo Supabase's default "ALL to anon, authenticated" on public tables,
-- now and for tables created later by this role, then grant reads only.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

grant usage on schema public to anon, authenticated;

grant select on
  currencies, countries, categories, category_groups, category_subcategories, brands,
  products, product_images, product_variants, product_colors, product_use_cases,
  product_specifications, product_country_prices, storefront_products
to anon, authenticated;

revoke execute on function product_country_prices_currency_check() from public, anon, authenticated;
revoke execute on function search_compact(text) from public;
revoke execute on function search_products(text, char, integer) from public;
grant execute on function search_compact(text) to anon, authenticated;
grant execute on function search_products(text, char, integer) to anon, authenticated;

commit;
