-- 0021_order_quantity_500.sql — up to 500 units of a product in one order
-- line (DRAFT).
--
-- Forward-only. Exercised only against a disposable PGlite database with a
-- Supabase role shim (database/client/tests); applying it to a Supabase
-- project needs owner approval. Requires 0004 and 0015. Safe to run again.
--
-- Owner decision 2026-11-21: a customer may order up to 500 units of one
-- product in a line (it was 99 here and 10 on the website). Run this before
-- the storefront that offers the higher quantity is deployed: until then
-- the database refuses a line of more than 99 units as an invalid request.
--
-- What changes:
--   * order_lines.quantity may be 1 to 500.
--   * place_cod_order() accepts a line quantity of 1 to 500. Everything
--     else in it is as in 0004: prices come from the catalogue, stock is
--     checked and reserved under a lock, one idempotency key gives one
--     order, and a line that asks for more than is in stock is refused.
--   * Who may run it is unchanged (0015): signed-in customers only.
--
-- Known and accepted with this change (security audit 2026-11-21, F-10):
-- there is still no limit on how many unpaid Cash on Delivery orders one
-- account may hold, so a larger line reserves more stock until staff
-- cancel the order.

begin;

alter table order_lines drop constraint if exists order_lines_quantity_check;
alter table order_lines add constraint order_lines_quantity_check check (quantity between 1 and 500);

create or replace function place_cod_order(
  p_idempotency_key        uuid,
  p_country                char(2),
  p_contact                jsonb,
  p_delivery               jsonb,
  p_lines                  jsonb,
  p_expected_total_minor   bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user        uuid := auth.uid();
  v_hash        text;
  v_existing    orders%rowtype;
  v_currency    char(3);
  v_line        jsonb;
  v_qty         integer;
  v_color       text;
  v_variant     text;
  v_product     record;
  v_available   integer;
  v_problems    jsonb := '[]'::jsonb;
  v_items       jsonb := '[]'::jsonb;
  v_subtotal    bigint := 0;
  v_count       integer := 0;
  v_order_id    uuid;
  v_number      text;
  v_name        text := btrim(coalesce(p_contact ->> 'name', ''));
  v_email       text := lower(btrim(coalesce(p_contact ->> 'email', '')));
  v_phone       text := btrim(coalesce(p_contact ->> 'phone', ''));
  v_method      text := coalesce(p_delivery ->> 'method', '');
  v_region      text := btrim(coalesce(p_delivery ->> 'region', ''));
  v_district    text := btrim(coalesce(p_delivery ->> 'district', ''));
  v_ward        text := btrim(coalesce(p_delivery ->> 'ward', ''));
  v_street      text := btrim(coalesce(p_delivery ->> 'street', ''));
  v_extra       text := nullif(btrim(coalesce(p_delivery ->> 'extra', '')), '');
  v_notes       text := nullif(btrim(coalesce(p_delivery ->> 'notes', '')), '');
  i             integer := 0;
begin
  -- 1. Shape of the request. Same limits as features/checkout/validation.ts.
  if p_idempotency_key is null
     or jsonb_typeof(p_contact) is distinct from 'object'
     or jsonb_typeof(p_delivery) is distinct from 'object'
     or jsonb_typeof(p_lines) is distinct from 'array'
     or jsonb_array_length(p_lines) not between 1 and 50
     or char_length(v_name) not between 2 and 80
     or char_length(v_email) not between 3 and 254
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$'
     or v_phone !~ '^\+[0-9]{9,15}$'
     or v_method <> 'home'
     or char_length(v_region) not between 2 and 60
     or char_length(v_district) not between 2 and 60
     or char_length(v_ward) not between 2 and 60
     or char_length(v_street) not between 3 and 120
     or char_length(coalesce(v_extra, '')) > 120
     or char_length(coalesce(v_notes, '')) > 300
     or (p_expected_total_minor is not null and p_expected_total_minor < 0)
  then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;

  select c.currency into v_currency from countries c where c.code = p_country and c.active;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;

  -- 2. Idempotency: one request per key, serialised on the key.
  v_hash := encode(sha256(convert_to(jsonb_build_array(p_country, p_contact, p_delivery, p_lines)::text, 'UTF8')), 'hex');
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));
  select * into v_existing from orders o where o.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> v_hash or v_existing.user_id is distinct from v_user then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    return jsonb_build_object(
      'ok', true, 'replayed', true, 'order_number', v_existing.order_number,
      'subtotal_minor', v_existing.subtotal_minor, 'total_minor', v_existing.total_minor,
      'currency', v_existing.currency,
      'item_count', (select coalesce(sum(l.quantity), 0) from order_lines l where l.order_id = v_existing.id));
  end if;

  -- 3. Lock the stock rows of every requested product, in a fixed order so
  --    concurrent orders cannot deadlock.
  perform 1
     from stock_levels s
     join products p on p.id = s.product_id
    where s.country_code = p_country
      and p.slug in (select e ->> 'product' from jsonb_array_elements(p_lines) e)
    order by s.product_id
      for update of s;

  -- 4. Reprice and check every line against the live catalogue.
  for v_line in select e from jsonb_array_elements(p_lines) e loop
    if jsonb_typeof(v_line) is distinct from 'object'
       or jsonb_typeof(v_line -> 'quantity') is distinct from 'number'
       or (v_line ->> 'quantity') !~ '^[0-9]{1,3}$'
       or (v_line ->> 'quantity')::integer not between 1 and 500
       or jsonb_typeof(v_line -> 'product') is distinct from 'string'
       or (v_line ? 'color' and jsonb_typeof(v_line -> 'color') not in ('string', 'null'))
       or (v_line ? 'variant' and jsonb_typeof(v_line -> 'variant') not in ('string', 'null'))
    then
      return jsonb_build_object('ok', false, 'code', 'invalid_request');
    end if;
    v_qty := (v_line ->> 'quantity')::integer;
    v_color := v_line ->> 'color';
    v_variant := v_line ->> 'variant';

    -- The same product and options twice is a malformed cart.
    if (select count(*) from jsonb_array_elements(p_lines) o
         where o ->> 'product' = v_line ->> 'product'
           and (o ->> 'color') is not distinct from v_color
           and (o ->> 'variant') is not distinct from v_variant) > 1 then
      return jsonb_build_object('ok', false, 'code', 'invalid_request');
    end if;

    select p.id, p.slug, p.sku, p.name, pcp.price_minor
      into v_product
      from products p
      join categories c on c.id = p.category_id and c.active
      join product_country_prices pcp on pcp.product_id = p.id and pcp.country_code = p_country and pcp.active
     where p.slug = v_line ->> 'product' and p.active;

    if not found then
      v_problems := v_problems || jsonb_build_object('product', v_line ->> 'product', 'issue', 'unavailable');
      continue;
    end if;

    if (exists (select 1 from product_colors pc where pc.product_id = v_product.id)
          and not exists (select 1 from product_colors pc where pc.product_id = v_product.id and pc.name = v_color))
       or (not exists (select 1 from product_colors pc where pc.product_id = v_product.id) and v_color is not null)
       or (exists (select 1 from product_variants pv where pv.product_id = v_product.id)
          and not exists (select 1 from product_variants pv where pv.product_id = v_product.id and pv.name = v_variant))
       or (not exists (select 1 from product_variants pv where pv.product_id = v_product.id) and v_variant is not null)
    then
      v_problems := v_problems || jsonb_build_object('product', v_product.slug, 'issue', 'invalid_options');
      continue;
    end if;

    -- Stock for this line, minus what earlier lines of this order take.
    select s.available - coalesce((
             select sum((it ->> 'quantity')::integer)
               from jsonb_array_elements(v_items) it
              where (it ->> 'product_id')::uuid = v_product.id), 0)
      into v_available
      from stock_levels s
     where s.product_id = v_product.id and s.country_code = p_country;

    if v_available is null or v_available < v_qty then
      v_problems := v_problems || jsonb_build_object(
        'product', v_product.slug, 'issue', 'out_of_stock', 'available', greatest(coalesce(v_available, 0), 0));
      continue;
    end if;

    v_items := v_items || jsonb_build_object(
      'product_id', v_product.id, 'slug', v_product.slug, 'sku', v_product.sku, 'name', v_product.name,
      'color', v_color, 'variant', v_variant, 'quantity', v_qty, 'unit_price_minor', v_product.price_minor);
    v_subtotal := v_subtotal + v_product.price_minor * v_qty;
    v_count := v_count + v_qty;
  end loop;

  if jsonb_array_length(v_problems) > 0 then
    return jsonb_build_object('ok', false, 'code', 'lines_unavailable', 'problems', v_problems);
  end if;

  -- 5. The customer confirms the price they saw. Delivery fees are not set
  --    yet (confirmed before payment), so the total is the subtotal.
  if p_expected_total_minor is not null and p_expected_total_minor <> v_subtotal then
    return jsonb_build_object('ok', false, 'code', 'price_changed', 'total_minor', v_subtotal, 'currency', v_currency);
  end if;

  -- 6. Write the order, its lines and the stock reservation.
  loop
    v_number := p_country || '-' || to_char(now() at time zone 'Africa/Dar_es_Salaam', 'YYMMDD') || '-'
                || upper(substr(md5(gen_random_uuid()::text), 1, 8));
    exit when not exists (select 1 from orders o where o.order_number = v_number);
  end loop;

  insert into orders (
    order_number, user_id, idempotency_key, request_hash, country_code, currency,
    payment_method, contact_name, contact_email, contact_phone,
    delivery_method, delivery_region, delivery_district, delivery_ward, delivery_street,
    delivery_extra, delivery_notes, subtotal_minor, delivery_fee_minor, total_minor)
  values (
    v_number, v_user, p_idempotency_key, v_hash, p_country, v_currency,
    'pay_on_delivery', v_name, v_email, v_phone,
    v_method, v_region, v_district, v_ward, v_street,
    v_extra, v_notes, v_subtotal, null, v_subtotal)
  returning id into v_order_id;

  for v_line in select e from jsonb_array_elements(v_items) e loop
    i := i + 1;
    insert into order_lines (
      order_id, line_no, product_id, product_slug, sku, name, color, variant,
      quantity, unit_price_minor, line_total_minor)
    values (
      v_order_id, i, (v_line ->> 'product_id')::uuid, v_line ->> 'slug', v_line ->> 'sku', v_line ->> 'name',
      v_line ->> 'color', v_line ->> 'variant', (v_line ->> 'quantity')::integer,
      (v_line ->> 'unit_price_minor')::bigint,
      (v_line ->> 'unit_price_minor')::bigint * (v_line ->> 'quantity')::integer);

    update stock_levels
       set available = available - (v_line ->> 'quantity')::integer, updated_at = now()
     where product_id = (v_line ->> 'product_id')::uuid and country_code = p_country;
  end loop;

  return jsonb_build_object(
    'ok', true, 'replayed', false, 'order_number', v_number,
    'subtotal_minor', v_subtotal, 'total_minor', v_subtotal, 'currency', v_currency, 'item_count', v_count);
end
$$;

revoke execute on function place_cod_order(uuid, char, jsonb, jsonb, jsonb, bigint) from public, anon;
grant execute on function place_cod_order(uuid, char, jsonb, jsonb, jsonb, bigint) to authenticated;

commit;
