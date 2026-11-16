-- 0002_country_actions.sql — reaching a country's service, and auditing what was done there (DRAFT).
--
-- For the CENTRAL ADMIN Supabase project only. Forward-only, additive.
-- Exercised only against a disposable PGlite database
-- (database/client/tests). Requires 0001.
--
-- Country modules (orders first) are served by each country's own backend.
-- Two things are needed here for that:
--   * admin_country_endpoint(): where a country's service is, for any
--     administrator with a role in that country. Until now only holders of
--     settings.read could see the registry, so an Order Manager's request
--     could not be routed.
--   * record_country_action(): the audit entry for a change an
--     administrator made in a country through this console. The permission
--     an action needs is decided here, not by the caller.

begin;

-- The service address of a country the caller has a role in, or null. An
-- address only: the registry never holds a key.
create function admin_country_endpoint(p_country text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when app_private.admin_id() is not null and app_private.has_country(p_country) then (
      select jsonb_build_object('country_id', c.id, 'iso_code', c.iso_code, 'api_base_url', s.api_base_url, 'enabled', s.enabled)
        from countries c
        join country_service_registry s on s.country_id = c.id
       where c.id = p_country)
  end
$$;

-- Writes the audit entry for an action carried out in a country's own
-- system. Returns {"ok": true} or {"ok": false, "code": "not_allowed" | "invalid_request"}.
create function record_country_action(p_country text, p_action text, p_target_id text, p_summary jsonb)
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
    when 'order.status_change' then v_permission := 'orders.update'; v_target_type := 'order';
    when 'order.note_add'      then v_permission := 'orders.update'; v_target_type := 'order';
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

revoke all on function admin_country_endpoint(text) from public, anon, authenticated, service_role;
revoke all on function record_country_action(text, text, text, jsonb) from public, anon, authenticated, service_role;
grant execute on function admin_country_endpoint(text), record_country_action(text, text, text, jsonb) to authenticated;

commit;
