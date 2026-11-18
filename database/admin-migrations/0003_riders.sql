-- 0003_riders.sql — delivery riders (DRAFT).
--
-- For the CENTRAL ADMIN Supabase project only. Forward-only, additive.
-- Exercised only against a disposable PGlite database
-- (database/client/tests). Requires 0002. Safe to run again.
--
-- Owner decision 2026-11-18: TRONIC's own riders deliver orders, using the
-- Central Admin on their phones.
--   * deliveries.assign: give an order to a rider and follow the delivery
--     (Order Manager, Country Super Admin).
--   * deliveries.perform: carry out the deliveries assigned to oneself
--     (the new Rider role). Which orders those are is decided by the
--     country's backend, from the signed request's administrator.
--   * record_country_action() learns the delivery actions.

begin;

insert into permissions (key, scope, description) values
  ('deliveries.assign',  'country', 'Assign orders to riders and follow their deliveries'),
  ('deliveries.perform', 'country', 'Carry out the deliveries assigned to them')
on conflict (key) do update set scope = excluded.scope, description = excluded.description;

insert into roles (key, name, scope, grantable_by, requires_mfa, sort_order) values
  ('rider', 'Rider', 'country', 'country_super_admin', false, 10)
on conflict (key) do nothing;

insert into role_permissions (role_key, permission_key) values
  ('country_super_admin', 'deliveries.assign'),
  ('country_super_admin', 'deliveries.perform'),
  ('order_manager',       'deliveries.assign'),
  ('rider',               'deliveries.perform')
on conflict do nothing;

-- The riders of a country (holders of the Rider role there), for the
-- assignment list. Visible to whoever may assign deliveries there.
create or replace function admin_list_riders(p_country text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when app_private.admin_id() is not null and app_private.has_permission('deliveries.assign', p_country) then
      coalesce((
        select jsonb_agg(jsonb_build_object('user_id', p.user_id, 'email', p.email, 'name', p.full_name)
                         order by coalesce(p.full_name, p.email))
          from admin_profiles p
         where p.status = 'active'
           and exists (select 1 from admin_role_assignments a
                        where a.user_id = p.user_id and a.role_key = 'rider' and a.country_id = p_country
                          and a.revoked_at is null)),
        '[]'::jsonb)
  end
$$;

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
    when 'order.status_change' then v_permission := 'orders.update';      v_target_type := 'order';
    when 'order.note_add'      then v_permission := 'orders.update';      v_target_type := 'order';
    when 'delivery.assign'     then v_permission := 'deliveries.assign';  v_target_type := 'order';
    when 'delivery.pickup'     then v_permission := 'deliveries.perform'; v_target_type := 'order';
    when 'delivery.start'      then v_permission := 'deliveries.perform'; v_target_type := 'order';
    when 'delivery.deliver'    then v_permission := 'deliveries.perform'; v_target_type := 'order';
    when 'delivery.fail'       then v_permission := 'deliveries.perform'; v_target_type := 'order';
    else return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end case;

  if app_private.admin_id() is null or not app_private.has_permission(v_permission, p_country)
     or not exists (select 1 from countries c where c.id = p_country) then
    if app_private.admin_id() is not null then
      perform app_private.security_event('permission_denied', left(p_country, 24), jsonb_build_object('operation', p_action));
    end if;
    return jsonb_build_object('ok', false, 'code', 'not_allowed');
  end if;
  if char_length(coalesce(p_target_id, '')) not between 1 and 60
     or jsonb_typeof(coalesce(p_summary, '{}'::jsonb)) <> 'object'
     or pg_column_size(coalesce(p_summary, '{}'::jsonb)) > 1500 then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;

  perform app_private.audit(p_action, p_country, v_target_type, p_target_id, coalesce(p_summary, '{}'::jsonb));
  return jsonb_build_object('ok', true);
end
$$;

revoke all on function admin_list_riders(text) from public, anon, authenticated, service_role;
grant execute on function admin_list_riders(text) to authenticated;

commit;
