-- 0007_category_actions.sql — category and brand changes in the Central Admin's audit log (DRAFT).
--
-- For the CENTRAL ADMIN Supabase project only. Forward-only. Exercised only
-- against a disposable PGlite database (database/client/tests). Requires
-- 0006. Safe to run again.
--
-- The categories module (country migration 0018, 2026-11-20) changes a
-- country's categories and brands through the signed country API. Each
-- change the country accepts is also recorded here: same function as 0006
-- with category.save, category.banner and brand.save added.

begin;

create or replace function record_country_action(p_country text, p_action text, p_target_id text, p_summary jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_permission   text;
  v_target_type  text;
begin
  -- The actions this console can carry out in a country, each with the
  -- permission it needs and the kind of record it changes.
  case p_action
    when 'order.status_change'   then v_permission := 'orders.update';      v_target_type := 'order';
    when 'order.note_add'        then v_permission := 'orders.update';      v_target_type := 'order';
    when 'delivery.assign'       then v_permission := 'deliveries.assign';  v_target_type := 'order';
    when 'delivery.pickup'       then v_permission := 'deliveries.perform'; v_target_type := 'order';
    when 'delivery.start'        then v_permission := 'deliveries.perform'; v_target_type := 'order';
    when 'delivery.deliver'      then v_permission := 'deliveries.perform'; v_target_type := 'order';
    when 'delivery.fail'         then v_permission := 'deliveries.perform'; v_target_type := 'order';
    when 'product.create'        then v_permission := 'products.create';    v_target_type := 'product';
    when 'product.update'        then v_permission := 'products.update';    v_target_type := 'product';
    when 'product.publish'       then v_permission := 'products.publish';   v_target_type := 'product';
    when 'product.hide'          then v_permission := 'products.publish';   v_target_type := 'product';
    when 'product.image_add'     then v_permission := 'products.update';    v_target_type := 'product';
    when 'product.image_arrange' then v_permission := 'products.update';    v_target_type := 'product';
    when 'product.stock'         then v_permission := 'inventory.adjust';   v_target_type := 'product';
    when 'inventory.adjust'      then v_permission := 'inventory.adjust';   v_target_type := 'product';
    when 'inventory.low_stock'   then v_permission := 'inventory.adjust';   v_target_type := 'product';
    when 'category.save'         then v_permission := 'categories.manage';  v_target_type := 'category';
    when 'category.banner'       then v_permission := 'categories.manage';  v_target_type := 'category';
    when 'brand.save'            then v_permission := 'categories.manage';  v_target_type := 'brand';
    else return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end case;

  if app_private.admin_id() is null or not app_private.has_permission(v_permission, p_country)
     or not exists (select 1 from countries c where c.id = p_country) then
    if app_private.admin_id() is not null then
      perform app_private.security_event('permission_denied', left(p_country, 24), jsonb_build_object('operation', p_action));
    end if;
    return jsonb_build_object('ok', false, 'code', 'not_allowed');
  end if;
  if char_length(coalesce(p_target_id, '')) not between 1 and 80
     or jsonb_typeof(coalesce(p_summary, '{}'::jsonb)) <> 'object'
     or pg_column_size(coalesce(p_summary, '{}'::jsonb)) > 1500 then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;

  perform app_private.audit(p_action, p_country, v_target_type, p_target_id, coalesce(p_summary, '{}'::jsonb));
  return jsonb_build_object('ok', true);
end
$$;

commit;
