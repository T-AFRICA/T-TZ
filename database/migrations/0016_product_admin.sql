-- 0016_product_admin.sql — products from the Central Admin (DRAFT).
--
-- Forward-only, additive. Exercised only against a disposable PGlite
-- database with a Supabase role shim (database/client/tests); applying it
-- to a Supabase project needs owner approval. Requires 0001, 0003, 0004
-- and 0006. Safe to run again.
--
-- Until now the catalogue could be changed by nobody but the database owner
-- (0003). This adds the administrative side the country's backend serves to
-- the Central Admin (/api/admin/v1/products): list, detail, create, edit,
-- publish and hide, photos and stock.
--
-- Owner decisions 2026-11-20:
--   * Photos are stored in this database (no outside storage) and served by
--     the storefront from its own address, /media/products/<id>.
--   * Nothing is deleted: a product is hidden, so orders and reports keep it.
--   * A new product starts as a draft. Someone with products.publish makes
--     it live; a live product can be hidden again.
--   * The SAMPLE catalogue stays and is edited from the admin (its SKUs
--     start with "SAMPLE-").
--
-- Rules:
--   * Customers and visitors get nothing new except the photos of live
--     products. The functions are executable by service_role only; the
--     storefront switches to it for a request it has already verified.
--   * products.active stays what the storefront reads (0003): live = active.
--     published_at says whether a product that is not active was live once
--     (hidden) or never (draft).
--   * A product goes live only with a price above zero, at least one photo
--     and an active category.
--   * Every change is recorded with the administrator and the request it
--     came from; the same request applied twice changes nothing again.

begin;

alter table products add column if not exists published_at timestamptz;
-- What is live today was published when it was created.
update products set published_at = created_at where active and published_at is null;

-- The photo itself, for images uploaded from the admin. product_images.url
-- of such an image is /media/products/<image id>.
create table if not exists product_image_files (
  image_id      uuid primary key references product_images (id) on delete cascade,
  content_type  text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  bytes         bytea not null check (octet_length(bytes) between 100 and 1048576),
  sha256        text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  created_at    timestamptz not null default now()
);

-- Who changed which product how, and when. The actor is the
-- administrator's id in the Central Admin (no foreign key).
create table if not exists catalogue_changes (
  id          bigint generated always as identity primary key,
  product_id  uuid references products (id) on delete set null,
  action      text not null check (action in ('product.create', 'product.update', 'product.publish', 'product.hide',
                                              'product.image_add', 'product.image_arrange', 'product.stock')),
  detail      jsonb not null default '{}'::jsonb,
  actor_id    uuid not null,
  request_id  uuid not null unique,
  created_at  timestamptz not null default now()
);

create index if not exists catalogue_changes_product_idx on catalogue_changes (product_id, id);

alter table product_image_files enable row level security;
alter table catalogue_changes   enable row level security;
revoke all on product_image_files, catalogue_changes from public, anon, authenticated, service_role;

-- draft | live | hidden
create or replace function catalogue_product_status(p_active boolean, p_published_at timestamptz)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case when p_active then 'live' when p_published_at is null then 'draft' else 'hidden' end
$$;

-- What the product form chooses from: the categories with their groups and
-- subcategories, the brands, and the country's currency.
create or replace function admin_catalogue_options(p_country char(2))
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'currency', c.currency,
    'currency_exponent', cur.exponent,
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', k.id, 'slug', k.slug, 'name', k.name, 'active', k.active,
               'groups', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'id', g.id, 'slug', g.slug, 'name', g.name, 'active', g.active,
                          'subcategories', coalesce((
                            select jsonb_agg(jsonb_build_object('id', s.id, 'slug', s.slug, 'name', s.name, 'active', s.active)
                                             order by s.sort_order, s.name)
                              from category_subcategories s where s.group_id = g.id), '[]'::jsonb))
                        order by g.sort_order, g.name)
                   from category_groups g where g.category_id = k.id), '[]'::jsonb))
             order by k.sort_order, k.name)
        from categories k), '[]'::jsonb),
    'brands', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name) order by b.name) from brands b), '[]'::jsonb))
    from countries c
    join currencies cur on cur.code = c.currency
   where c.code = p_country
$$;

-- A page of the catalogue for administrators, newest first, with the
-- number of products in each status. Filters: status, category slug, and a
-- search on the name or SKU (as typed, no wildcards).
create or replace function admin_list_products(p_country char(2), p_search text, p_category text, p_status text, p_limit integer, p_offset integer)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with base as (
    select p.id, p.slug, p.sku, p.name, p.category_id, p.sequence, p.updated_at,
           catalogue_product_status(p.active, p.published_at) as status,
           k.name as category_name, b.name as brand_name,
           pr.price_minor, pr.was_price_minor, s.available
      from products p
      join categories k on k.id = p.category_id
      left join brands b on b.id = p.brand_id
      left join product_country_prices pr on pr.product_id = p.id and pr.country_code = p_country
      left join stock_levels s on s.product_id = p.id and s.country_code = p_country
  ),
  found as (
    select * from base x
     where (p_status is null or x.status = p_status)
       and (nullif(btrim(coalesce(p_category, '')), '') is null
            or x.category_id = (select k.id from categories k where k.slug = lower(btrim(p_category))))
       and (nullif(btrim(coalesce(p_search, '')), '') is null
            or position(lower(btrim(p_search)) in lower(x.name)) > 0
            or position(upper(btrim(p_search)) in x.sku) > 0)
  )
  select jsonb_build_object(
    'total', (select count(*) from found),
    'counts', coalesce((select jsonb_object_agg(c.status, c.n) from (select status, count(*) as n from base group by status) c), '{}'::jsonb),
    'currency', (select c.currency from countries c where c.code = p_country),
    'currency_exponent', (select cur.exponent from countries c join currencies cur on cur.code = c.currency where c.code = p_country),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
               'slug', f.slug, 'sku', f.sku, 'name', f.name, 'status', f.status,
               'category_name', f.category_name, 'brand_name', f.brand_name,
               'price_minor', f.price_minor, 'was_price_minor', f.was_price_minor, 'available', f.available,
               'updated_at', f.updated_at,
               'image', (select jsonb_build_object('id', i.id, 'url', i.url) from product_images i
                          where i.product_id = f.id order by i.sort_order, i.id limit 1))
             order by f.sequence desc, f.slug)
        from (select * from found
               order by sequence desc, slug
               limit least(greatest(coalesce(p_limit, 25), 1), 100)
              offset greatest(coalesce(p_offset, 0), 0)) f), '[]'::jsonb))
$$;

-- One product in full for administrators, or null.
create or replace function admin_get_product(p_country char(2), p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', p.id, 'slug', p.slug, 'sku', p.sku, 'name', p.name, 'description', p.description,
    'brand_id', p.brand_id, 'category_id', p.category_id, 'group_id', p.group_id, 'subcategory_id', p.subcategory_id,
    'variant_label', p.variant_label,
    'status', catalogue_product_status(p.active, p.published_at), 'published_at', p.published_at,
    'created_at', p.created_at, 'updated_at', p.updated_at,
    'currency', c.currency, 'currency_exponent', cur.exponent,
    'price_minor', pr.price_minor, 'was_price_minor', pr.was_price_minor,
    'available', (select s.available from stock_levels s where s.product_id = p.id and s.country_code = p_country),
    'images', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'url', i.url, 'alt', i.alt,
                                          'uploaded', exists (select 1 from product_image_files f where f.image_id = i.id))
                       order by i.sort_order, i.id)
        from product_images i where i.product_id = p.id), '[]'::jsonb),
    'specifications', coalesce((
      select jsonb_agg(jsonb_build_object('label', x.label, 'value', x.value) order by x.sort_order, x.label)
        from product_specifications x where x.product_id = p.id), '[]'::jsonb),
    'variants', coalesce((select jsonb_agg(v.name order by v.sort_order, v.name) from product_variants v where v.product_id = p.id), '[]'::jsonb),
    'colors', coalesce((
      select jsonb_agg(jsonb_build_object('name', x.name, 'swatch', x.swatch) order by x.sort_order, x.name)
        from product_colors x where x.product_id = p.id), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('action', h.action, 'actor_id', h.actor_id, 'detail', h.detail, 'created_at', h.created_at)
                       order by h.id desc)
        from (select * from catalogue_changes h where h.product_id = p.id order by h.id desc limit 20) h), '[]'::jsonb))
    from products p
    join countries c on c.code = p_country
    join currencies cur on cur.code = c.currency
    left join product_country_prices pr on pr.product_id = p.id and pr.country_code = p_country
   where p.slug = lower(btrim(p_slug))
$$;

-- Creates (p_slug null) or edits a product. p_input:
--   {"slug" (create only), "name", "sku", "description", "brand_id", "category_id",
--    "group_id", "subcategory_id", "variant_label", "price_minor", "was_price_minor",
--    "specifications": [{"label", "value"}], "variants": ["…"], "colors": [{"name", "swatch"}]}
-- The slug never changes after creation: carts and links use it. Returns
--   {"ok": true, "replayed": bool, "slug", "status"}
--   {"ok": false, "code": "invalid_request" | "not_found" | "slug_taken" | "sku_taken" | "invalid_category" | "invalid_brand"}
create or replace function admin_save_product(p_country char(2), p_slug text, p_input jsonb, p_actor uuid, p_request uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uuid        constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_change      catalogue_changes%rowtype;
  v_product     products%rowtype;
  v_slug        text;
  v_name        text := btrim(coalesce(p_input ->> 'name', ''));
  v_sku         text := upper(btrim(coalesce(p_input ->> 'sku', '')));
  v_description text := nullif(btrim(coalesce(p_input ->> 'description', '')), '');
  v_label       text := nullif(btrim(coalesce(p_input ->> 'variant_label', '')), '');
  v_category    uuid;
  v_group       uuid;
  v_sub         uuid;
  v_brand       uuid;
  v_price       bigint;
  v_was         bigint;
  v_currency    char(3);
  v_specs       jsonb := coalesce(p_input -> 'specifications', '[]'::jsonb);
  v_variants    jsonb := coalesce(p_input -> 'variants', '[]'::jsonb);
  v_colors      jsonb := coalesce(p_input -> 'colors', '[]'::jsonb);
begin
  if p_actor is null or p_request is null or jsonb_typeof(p_input) is distinct from 'object' then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;

  -- The same request again: answer as the first time.
  select * into v_change from catalogue_changes c where c.request_id = p_request;
  if found then
    if v_change.action not in ('product.create', 'product.update') then
      return jsonb_build_object('ok', false, 'code', 'invalid_request');
    end if;
    select * into v_product from products p where p.id = v_change.product_id;
    return jsonb_build_object('ok', true, 'replayed', true, 'slug', v_product.slug,
                              'status', catalogue_product_status(v_product.active, v_product.published_at));
  end if;

  -- Plain fields.
  if char_length(v_name) not between 2 and 120
     or v_sku !~ '^[A-Z0-9][A-Z0-9-]{1,39}$'
     or char_length(coalesce(v_description, '')) > 4000
     or char_length(coalesce(v_label, '')) > 30
     or jsonb_typeof(p_input -> 'price_minor') is distinct from 'number'
     or (p_input -> 'was_price_minor' is not null and jsonb_typeof(p_input -> 'was_price_minor') not in ('number', 'null'))
     or coalesce(p_input ->> 'category_id', '') !~ v_uuid
     or (nullif(p_input ->> 'group_id', '') is not null and p_input ->> 'group_id' !~ v_uuid)
     or (nullif(p_input ->> 'subcategory_id', '') is not null and p_input ->> 'subcategory_id' !~ v_uuid)
     or (nullif(p_input ->> 'brand_id', '') is not null and p_input ->> 'brand_id' !~ v_uuid)
     or jsonb_typeof(v_specs) <> 'array' or jsonb_array_length(v_specs) > 30
     or jsonb_typeof(v_variants) <> 'array' or jsonb_array_length(v_variants) > 20
     or jsonb_typeof(v_colors) <> 'array' or jsonb_array_length(v_colors) > 12 then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  if (p_input ->> 'price_minor')::numeric <> trunc((p_input ->> 'price_minor')::numeric)
     or (p_input ->> 'price_minor')::numeric not between 1 and 1000000000000000 then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  v_price := (p_input ->> 'price_minor')::bigint;
  if jsonb_typeof(p_input -> 'was_price_minor') = 'number' then
    if (p_input ->> 'was_price_minor')::numeric <> trunc((p_input ->> 'was_price_minor')::numeric)
       or (p_input ->> 'was_price_minor')::numeric not between 1 and 1000000000000000 then
      return jsonb_build_object('ok', false, 'code', 'invalid_request');
    end if;
    v_was := (p_input ->> 'was_price_minor')::bigint;
    if v_was <= v_price then
      return jsonb_build_object('ok', false, 'code', 'invalid_request');
    end if;
  end if;

  -- Lists: shapes, lengths and no repeats.
  if exists (select 1 from jsonb_array_elements(v_specs) e
              where jsonb_typeof(e) <> 'object'
                 or char_length(btrim(coalesce(e ->> 'label', ''))) not between 1 and 60
                 or char_length(btrim(coalesce(e ->> 'value', ''))) not between 1 and 200)
     or (select count(distinct lower(btrim(e ->> 'label'))) from jsonb_array_elements(v_specs) e) <> jsonb_array_length(v_specs)
     or exists (select 1 from jsonb_array_elements(v_variants) e
                 where jsonb_typeof(e) <> 'string' or char_length(btrim(e #>> '{}')) not between 1 and 40)
     or (select count(distinct lower(btrim(e #>> '{}'))) from jsonb_array_elements(v_variants) e) <> jsonb_array_length(v_variants)
     or exists (select 1 from jsonb_array_elements(v_colors) e
                 where jsonb_typeof(e) <> 'object'
                    or char_length(btrim(coalesce(e ->> 'name', ''))) not between 1 and 40
                    or coalesce(e ->> 'swatch', '') !~ '^#[0-9a-fA-F]{6}$')
     or (select count(distinct lower(btrim(e ->> 'name'))) from jsonb_array_elements(v_colors) e) <> jsonb_array_length(v_colors) then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;

  -- Where it sits: the group belongs to the category, the subcategory to the group.
  v_category := (p_input ->> 'category_id')::uuid;
  v_group := nullif(p_input ->> 'group_id', '')::uuid;
  v_sub := nullif(p_input ->> 'subcategory_id', '')::uuid;
  v_brand := nullif(p_input ->> 'brand_id', '')::uuid;
  if not exists (select 1 from categories k where k.id = v_category)
     or (v_group is not null and not exists (select 1 from category_groups g where g.id = v_group and g.category_id = v_category))
     or (v_sub is not null and (v_group is null or not exists (select 1 from category_subcategories s where s.id = v_sub and s.group_id = v_group))) then
    return jsonb_build_object('ok', false, 'code', 'invalid_category');
  end if;
  if v_brand is not null and not exists (select 1 from brands b where b.id = v_brand) then
    return jsonb_build_object('ok', false, 'code', 'invalid_brand');
  end if;

  select c.currency into v_currency from countries c where c.code = p_country;
  if v_currency is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;

  begin
    if p_slug is null then
      v_slug := lower(btrim(coalesce(p_input ->> 'slug', '')));
      if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(v_slug) > 80 then
        return jsonb_build_object('ok', false, 'code', 'invalid_request');
      end if;
      if exists (select 1 from products p where p.slug = v_slug) then
        return jsonb_build_object('ok', false, 'code', 'slug_taken');
      end if;
      if exists (select 1 from products p where p.sku = v_sku) then
        return jsonb_build_object('ok', false, 'code', 'sku_taken');
      end if;
      insert into products (slug, sku, name, description, brand_id, category_id, group_id, subcategory_id, variant_label, active, sequence)
      values (v_slug, v_sku, v_name, v_description, v_brand, v_category, v_group, v_sub, v_label, false,
              coalesce((select max(p.sequence) from products p), 0) + 1)
      returning * into v_product;
      insert into product_country_prices (product_id, country_code, currency, price_minor, was_price_minor, in_stock, active)
      values (v_product.id, p_country, v_currency, v_price, v_was, false, true);
      insert into stock_levels (product_id, country_code, available) values (v_product.id, p_country, 0)
      on conflict (product_id, country_code) do nothing;
    else
      select * into v_product from products p where p.slug = lower(btrim(p_slug)) for update;
      if not found then
        return jsonb_build_object('ok', false, 'code', 'not_found');
      end if;
      if exists (select 1 from products p where p.sku = v_sku and p.id <> v_product.id) then
        return jsonb_build_object('ok', false, 'code', 'sku_taken');
      end if;
      update products
         set sku = v_sku, name = v_name, description = v_description, brand_id = v_brand, category_id = v_category,
             group_id = v_group, subcategory_id = v_sub, variant_label = v_label, updated_at = now()
       where id = v_product.id
      returning * into v_product;
      insert into product_country_prices (product_id, country_code, currency, price_minor, was_price_minor, in_stock, active)
      values (v_product.id, p_country, v_currency, v_price, v_was,
              coalesce((select s.available > 0 from stock_levels s where s.product_id = v_product.id and s.country_code = p_country), false), true)
      on conflict (product_id, country_code) do update
        set price_minor = excluded.price_minor, was_price_minor = excluded.was_price_minor, currency = excluded.currency,
            active = true, updated_at = now();
    end if;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'code', case when exists (select 1 from products p where p.sku = v_sku) then 'sku_taken' else 'slug_taken' end);
  end;

  -- The lists are replaced as sent, in the order sent.
  delete from product_specifications where product_id = v_product.id;
  insert into product_specifications (product_id, label, value, sort_order)
  select v_product.id, btrim(e ->> 'label'), btrim(e ->> 'value'), (n - 1)::integer
    from jsonb_array_elements(v_specs) with ordinality as t(e, n);
  delete from product_variants where product_id = v_product.id;
  insert into product_variants (product_id, name, sort_order)
  select v_product.id, btrim(e #>> '{}'), (n - 1)::integer
    from jsonb_array_elements(v_variants) with ordinality as t(e, n);
  delete from product_colors where product_id = v_product.id;
  insert into product_colors (product_id, name, swatch, sort_order)
  select v_product.id, btrim(e ->> 'name'), lower(e ->> 'swatch'), (n - 1)::integer
    from jsonb_array_elements(v_colors) with ordinality as t(e, n);

  insert into catalogue_changes (product_id, action, detail, actor_id, request_id)
  values (v_product.id, case when p_slug is null then 'product.create' else 'product.update' end,
          jsonb_build_object('sku', v_sku, 'name', v_name, 'price_minor', v_price), p_actor, p_request);

  return jsonb_build_object('ok', true, 'replayed', false, 'slug', v_product.slug,
                            'status', catalogue_product_status(v_product.active, v_product.published_at));
end
$$;

-- Makes a product live (p_publish) or hides it. Returns
--   {"ok": true, "replayed": bool, "status"}
--   {"ok": false, "code": "invalid_request" | "not_found"}
--   {"ok": false, "code": "not_ready", "missing": ["price" | "image" | "category"]}
create or replace function admin_set_product_status(p_country char(2), p_slug text, p_publish boolean, p_actor uuid, p_request uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_change   catalogue_changes%rowtype;
  v_product  products%rowtype;
  v_missing  text[] := array[]::text[];
begin
  if p_actor is null or p_request is null or p_publish is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  select * into v_change from catalogue_changes c where c.request_id = p_request;
  if found then
    if v_change.action not in ('product.publish', 'product.hide') then
      return jsonb_build_object('ok', false, 'code', 'invalid_request');
    end if;
    select * into v_product from products p where p.id = v_change.product_id;
    return jsonb_build_object('ok', true, 'replayed', true, 'status', catalogue_product_status(v_product.active, v_product.published_at));
  end if;

  select * into v_product from products p where p.slug = lower(btrim(p_slug)) for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  if p_publish then
    if not exists (select 1 from product_country_prices pr
                    where pr.product_id = v_product.id and pr.country_code = p_country and pr.active and pr.price_minor > 0) then
      v_missing := array_append(v_missing, 'price');
    end if;
    if not exists (select 1 from product_images i where i.product_id = v_product.id) then
      v_missing := array_append(v_missing, 'image');
    end if;
    if not exists (select 1 from categories k where k.id = v_product.category_id and k.active) then
      v_missing := array_append(v_missing, 'category');
    end if;
    if cardinality(v_missing) > 0 then
      return jsonb_build_object('ok', false, 'code', 'not_ready', 'missing', to_jsonb(v_missing));
    end if;
    update products set active = true, published_at = coalesce(published_at, now()), updated_at = now()
     where id = v_product.id returning * into v_product;
  else
    -- A live product loaded without published_at (the SAMPLE script) was live: hidden, not draft.
    update products set active = false, updated_at = now(),
                        published_at = case when active then coalesce(published_at, now()) else published_at end
     where id = v_product.id returning * into v_product;
  end if;

  insert into catalogue_changes (product_id, action, detail, actor_id, request_id)
  values (v_product.id, case when p_publish then 'product.publish' else 'product.hide' end, '{}'::jsonb, p_actor, p_request);
  return jsonb_build_object('ok', true, 'replayed', false, 'status', catalogue_product_status(v_product.active, v_product.published_at));
end
$$;

-- Adds a photo at the end of the product's photos (at most 12). Returns
--   {"ok": true, "replayed": bool, "image_id"}
--   {"ok": false, "code": "invalid_request" | "not_found" | "too_many_images"}
create or replace function admin_add_product_image(p_country char(2), p_slug text, p_content_type text, p_bytes bytea, p_alt text,
                                                   p_actor uuid, p_request uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_change   catalogue_changes%rowtype;
  v_product  uuid;
  v_image    uuid;
  v_alt      text := nullif(btrim(coalesce(p_alt, '')), '');
begin
  if p_actor is null or p_request is null or p_bytes is null
     or p_content_type not in ('image/jpeg', 'image/png', 'image/webp')
     or octet_length(p_bytes) not between 100 and 1048576
     or char_length(coalesce(v_alt, '')) > 120 then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  select * into v_change from catalogue_changes c where c.request_id = p_request;
  if found then
    if v_change.action <> 'product.image_add' then
      return jsonb_build_object('ok', false, 'code', 'invalid_request');
    end if;
    return jsonb_build_object('ok', true, 'replayed', true, 'image_id', v_change.detail ->> 'image_id');
  end if;

  select p.id into v_product from products p where p.slug = lower(btrim(p_slug)) for update;
  if v_product is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if (select count(*) from product_images i where i.product_id = v_product) >= 12 then
    return jsonb_build_object('ok', false, 'code', 'too_many_images');
  end if;

  v_image := gen_random_uuid();
  insert into product_images (id, product_id, url, alt, sort_order)
  values (v_image, v_product, '/media/products/' || v_image, v_alt,
          coalesce((select max(i.sort_order) + 1 from product_images i where i.product_id = v_product), 0));
  insert into product_image_files (image_id, content_type, bytes, sha256)
  values (v_image, p_content_type, p_bytes, encode(sha256(p_bytes), 'hex'));
  update products set updated_at = now() where id = v_product;
  insert into catalogue_changes (product_id, action, detail, actor_id, request_id)
  values (v_product, 'product.image_add', jsonb_build_object('image_id', v_image, 'bytes', octet_length(p_bytes)), p_actor, p_request);
  return jsonb_build_object('ok', true, 'replayed', false, 'image_id', v_image);
end
$$;

-- Keeps the photos listed in p_keep, in that order (the first is the main
-- photo), and removes the others. A live product keeps at least one.
-- Returns {"ok": true, "replayed": bool} or
--   {"ok": false, "code": "invalid_request" | "not_found" | "last_image"}
create or replace function admin_arrange_product_images(p_country char(2), p_slug text, p_keep uuid[], p_actor uuid, p_request uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product  products%rowtype;
  v_removed  integer;
begin
  if p_actor is null or p_request is null or p_keep is null or cardinality(p_keep) > 12
     or cardinality(p_keep) <> (select count(distinct k) from unnest(p_keep) k) then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  if exists (select 1 from catalogue_changes c where c.request_id = p_request) then
    return jsonb_build_object('ok', true, 'replayed', true);
  end if;

  select * into v_product from products p where p.slug = lower(btrim(p_slug)) for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if exists (select 1 from unnest(p_keep) k where not exists (select 1 from product_images i where i.id = k and i.product_id = v_product.id)) then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  if v_product.active and cardinality(p_keep) = 0 then
    return jsonb_build_object('ok', false, 'code', 'last_image');
  end if;

  delete from product_images i where i.product_id = v_product.id and not (i.id = any (p_keep));
  get diagnostics v_removed = row_count;
  update product_images i set sort_order = (t.n - 1)::integer
    from unnest(p_keep) with ordinality as t(id, n)
   where i.id = t.id;
  update products set updated_at = now() where id = v_product.id;
  insert into catalogue_changes (product_id, action, detail, actor_id, request_id)
  values (v_product.id, 'product.image_arrange', jsonb_build_object('kept', cardinality(p_keep), 'removed', v_removed), p_actor, p_request);
  return jsonb_build_object('ok', true, 'replayed', false);
end
$$;

-- One photo of a product for administrators (a draft's photos too):
--   {"url", "content_type", "data" (base64)} for an uploaded photo,
--   {"url"} for one that is only a path (the SAMPLE catalogue), null if none.
create or replace function admin_get_product_image(p_country char(2), p_slug text, p_image uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when f.image_id is null then jsonb_build_object('url', i.url)
              else jsonb_build_object('url', i.url, 'content_type', f.content_type,
                                      'data', translate(encode(f.bytes, 'base64'), E'\n', '')) end
    from product_images i
    join products p on p.id = i.product_id
    left join product_image_files f on f.image_id = i.id
   where p.slug = lower(btrim(p_slug)) and i.id = p_image
$$;

-- Sets how many units the country has of a product (0 to 100000). Returns
--   {"ok": true, "replayed": bool, "available"} or {"ok": false, "code": "invalid_request" | "not_found"}
create or replace function admin_set_product_stock(p_country char(2), p_slug text, p_available integer, p_actor uuid, p_request uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_change   catalogue_changes%rowtype;
  v_product  uuid;
  v_before   integer;
begin
  if p_actor is null or p_request is null or p_available is null or p_available not between 0 and 100000 then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  select * into v_change from catalogue_changes c where c.request_id = p_request;
  if found then
    if v_change.action <> 'product.stock' then
      return jsonb_build_object('ok', false, 'code', 'invalid_request');
    end if;
    return jsonb_build_object('ok', true, 'replayed', true, 'available', (v_change.detail ->> 'to')::integer);
  end if;

  select p.id into v_product from products p where p.slug = lower(btrim(p_slug)) for update;
  if v_product is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  select s.available into v_before from stock_levels s where s.product_id = v_product and s.country_code = p_country for update;
  -- The trigger of 0004 keeps the storefront's in_stock in step.
  insert into stock_levels (product_id, country_code, available) values (v_product, p_country, p_available)
  on conflict (product_id, country_code) do update set available = excluded.available, updated_at = now();
  insert into catalogue_changes (product_id, action, detail, actor_id, request_id)
  values (v_product, 'product.stock', jsonb_build_object('from', v_before, 'to', p_available), p_actor, p_request);
  return jsonb_build_object('ok', true, 'replayed', false, 'available', p_available);
end
$$;

-- The storefront serves a photo of a live product from its own address.
create or replace function public_product_image(p_image uuid)
returns table (content_type text, bytes bytea)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select f.content_type, f.bytes
    from product_image_files f
    join product_images i on i.id = f.image_id
    join products p on p.id = i.product_id
   where f.image_id = p_image and p.active
$$;

revoke execute on function catalogue_product_status(boolean, timestamptz) from public, anon, authenticated;
revoke execute on function admin_catalogue_options(char) from public, anon, authenticated;
revoke execute on function admin_list_products(char, text, text, text, integer, integer) from public, anon, authenticated;
revoke execute on function admin_get_product(char, text) from public, anon, authenticated;
revoke execute on function admin_save_product(char, text, jsonb, uuid, uuid) from public, anon, authenticated;
revoke execute on function admin_set_product_status(char, text, boolean, uuid, uuid) from public, anon, authenticated;
revoke execute on function admin_add_product_image(char, text, text, bytea, text, uuid, uuid) from public, anon, authenticated;
revoke execute on function admin_arrange_product_images(char, text, uuid[], uuid, uuid) from public, anon, authenticated;
revoke execute on function admin_get_product_image(char, text, uuid) from public, anon, authenticated;
revoke execute on function admin_set_product_stock(char, text, integer, uuid, uuid) from public, anon, authenticated;
revoke execute on function public_product_image(uuid) from public;

grant execute on function catalogue_product_status(boolean, timestamptz) to service_role;
grant execute on function admin_catalogue_options(char) to service_role;
grant execute on function admin_list_products(char, text, text, text, integer, integer) to service_role;
grant execute on function admin_get_product(char, text) to service_role;
grant execute on function admin_save_product(char, text, jsonb, uuid, uuid) to service_role;
grant execute on function admin_set_product_status(char, text, boolean, uuid, uuid) to service_role;
grant execute on function admin_add_product_image(char, text, text, bytea, text, uuid, uuid) to service_role;
grant execute on function admin_arrange_product_images(char, text, uuid[], uuid, uuid) to service_role;
grant execute on function admin_get_product_image(char, text, uuid) to service_role;
grant execute on function admin_set_product_stock(char, text, integer, uuid, uuid) to service_role;
grant execute on function public_product_image(uuid) to anon, authenticated;

commit;
