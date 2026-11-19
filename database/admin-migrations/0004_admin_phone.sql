-- 0004_admin_phone.sql — a name and phone number for riders (DRAFT).
--
-- For the CENTRAL ADMIN Supabase project only. Forward-only, additive.
-- Exercised only against a disposable PGlite database
-- (database/client/tests). Requires 0003. Safe to run again.
--
-- Owner decisions 2026-11-19: the customer can call the rider on the way,
-- on the rider's own phone; a rider is added with the existing email
-- invitation plus their name and phone, and that name and phone are what
-- the customer sees. They are kept on the administrator's profile, set by
-- whoever may assign deliveries in a country where the person is a rider,
-- and handed to the country with each assignment.

begin;

alter table admin_profiles add column if not exists phone text
  check (phone is null or phone ~ '^\+[0-9]{9,15}$');

-- What the inviter typed, copied to the profile at the first sign-in.
alter table admin_invitations add column if not exists full_name text
  check (full_name is null or char_length(full_name) between 2 and 80);
alter table admin_invitations add column if not exists phone text
  check (phone is null or phone ~ '^\+[0-9]{9,15}$');

-- The riders of a country, now with their phone.
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
        select jsonb_agg(jsonb_build_object('user_id', p.user_id, 'email', p.email, 'name', p.full_name, 'phone', p.phone)
                         order by coalesce(p.full_name, p.email))
          from admin_profiles p
         where p.status = 'active'
           and exists (select 1 from admin_role_assignments a
                        where a.user_id = p.user_id and a.role_key = 'rider' and a.country_id = p_country
                          and a.revoked_at is null)),
        '[]'::jsonb)
  end
$$;

-- Sets a rider's name and phone (null phone clears it). Returns {"ok": true}
-- or {"ok": false, "code": "not_allowed" | "invalid_request"}.
create or replace function admin_set_rider_contact(p_country text, p_rider uuid, p_name text, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name  text := nullif(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), '');
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
begin
  if app_private.admin_id() is null or not app_private.has_permission('deliveries.assign', p_country)
     or not exists (select 1 from admin_role_assignments a
                     where a.user_id = p_rider and a.role_key = 'rider' and a.country_id = p_country and a.revoked_at is null) then
    if app_private.admin_id() is not null then
      perform app_private.security_event('permission_denied', left(p_country, 24), jsonb_build_object('operation', 'rider.contact'));
    end if;
    return jsonb_build_object('ok', false, 'code', 'not_allowed');
  end if;
  if v_name is null or char_length(v_name) not between 2 and 80
     or (v_phone is not null and v_phone !~ '^\+[0-9]{9,15}$') then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  update admin_profiles set full_name = v_name, phone = v_phone, updated_at = now() where user_id = p_rider;
  perform app_private.audit('rider.contact', p_country, 'admin', p_rider::text, jsonb_build_object('phone', v_phone is not null));
  return jsonb_build_object('ok', true);
end
$$;

-- invite_admin with the person's name and phone (both optional). A new
-- person's invitation keeps them for the first sign-in; an existing
-- administrator gets them only where their profile has none yet (a rider's
-- page edits them afterwards).
create or replace function invite_admin(p_email text, p_role text, p_country text, p_name text, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name   text := nullif(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), '');
  v_phone  text := nullif(btrim(coalesce(p_phone, '')), '');
  v_result jsonb;
begin
  if (v_name is not null and char_length(v_name) not between 2 and 80)
     or (v_phone is not null and v_phone !~ '^\+[0-9]{9,15}$') then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  v_result := invite_admin(p_email, p_role, p_country);
  if (v_result ->> 'ok')::boolean then
    if v_result ->> 'outcome' = 'invited' then
      update admin_invitations set full_name = v_name, phone = v_phone where id = (v_result ->> 'invitation_id')::uuid;
    else
      update admin_profiles p
         set full_name = coalesce(p.full_name, v_name), phone = coalesce(p.phone, v_phone), updated_at = now()
       where p.email = lower(btrim(p_email));
    end if;
  end if;
  return v_result;
end
$$;

-- As in 0001, and the first sign-in also fills the profile's name and
-- phone from the invitation where the profile has none.
create or replace function accept_admin_invitations()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user       uuid := auth.uid();
  v_email      text;
  v_confirmed  timestamptz;
  v_status     text;
  v_inv        admin_invitations%rowtype;
  v_accepted   integer := 0;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'code', 'not_allowed');
  end if;
  select lower(u.email), u.email_confirmed_at into v_email, v_confirmed from auth.users u where u.id = v_user;
  if v_email is null or v_confirmed is null then
    return jsonb_build_object('ok', false, 'code', 'email_not_confirmed');
  end if;
  select p.status into v_status from admin_profiles p where p.user_id = v_user;
  if v_status = 'suspended' then
    return jsonb_build_object('ok', false, 'code', 'not_allowed');
  end if;

  for v_inv in
    select * from admin_invitations i
     where i.email = v_email and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
     order by i.created_at
       for update
  loop
    if not app_private.actor_may_grant(v_inv.invited_by, v_inv.role_key, v_inv.country_id) then
      update admin_invitations set revoked_at = now() where id = v_inv.id;
      continue;
    end if;

    insert into admin_profiles (user_id, email) values (v_user, v_email) on conflict (user_id) do nothing;
    update admin_profiles p
       set full_name = coalesce(p.full_name, v_inv.full_name), phone = coalesce(p.phone, v_inv.phone)
     where p.user_id = v_user and (v_inv.full_name is not null or v_inv.phone is not null);
    insert into admin_role_assignments (user_id, role_key, country_id, granted_by)
    values (v_user, v_inv.role_key, v_inv.country_id, v_inv.invited_by)
    on conflict do nothing;
    update admin_invitations set accepted_at = now(), accepted_by = v_user where id = v_inv.id;
    perform app_private.audit('invitation.accept', v_inv.country_id, 'admin', v_user::text,
                              jsonb_build_object('role', v_inv.role_key, 'invited_by', v_inv.invited_by));
    v_accepted := v_accepted + 1;
  end loop;

  return jsonb_build_object('ok', true, 'accepted', v_accepted);
exception
  when unique_violation then
    -- Another profile already uses this email address (an account that was
    -- deleted and recreated in Auth). An owner has to resolve it.
    return jsonb_build_object('ok', false, 'code', 'email_in_use');
end
$$;

revoke all on function admin_set_rider_contact(text, uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function invite_admin(text, text, text, text, text) from public, anon, authenticated, service_role;
grant execute on function admin_set_rider_contact(text, uuid, text, text) to authenticated;
grant execute on function invite_admin(text, text, text, text, text) to authenticated;

commit;
