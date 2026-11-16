-- 0001_admin_core.sql — TRONIC Central Admin: identity, roles, countries, audit (DRAFT).
--
-- For the CENTRAL ADMIN Supabase project only. Never run it on a country
-- project (database/migrations is theirs). Forward-only, additive. Not
-- applied to any shared database: it is exercised against a disposable
-- PGlite database with a Supabase role shim (database/client/tests).
-- Applying it to a Supabase project needs owner approval.
--
-- What it holds: who the administrators are, which role each has in which
-- country, the country roster and service registry, and the audit trail.
-- It holds no customer, order, product or stock data of any country.
--
-- What it enforces:
--   * Row Level Security on every table. The anon role gets nothing. An
--     administrator reads only what their roles allow, country by country.
--   * No table can be written directly. Every change goes through a
--     function below that checks the caller's roles, refuses privilege
--     escalation and writes the audit log in the same transaction.
--   * Master Super Admin is granted only by app_private.provision_master_
--     super_admin(), which no API role can execute (owner, SQL editor).
--   * A suspended administrator, one without roles, or a super admin whose
--     session has not passed the second factor (JWT aal2) counts as nobody:
--     app_private.admin_id() is null and every policy and function refuses.
--   * The role and permission catalogue mirrors packages/permissions; a
--     test compares the two.

begin;

create schema if not exists app_private;

-- -------------------------------------------------------------- countries --

-- `id` is the stable key used in assignments and URLs. It is not the ISO
-- code: Congo is listed before it is known which Congo is meant, so its
-- ISO code, currency and time zone stay null until an owner confirms them.
create table countries (
  id              text primary key check (id ~ '^[a-z][a-z0-9_]{1,23}$'),
  name            text not null unique check (char_length(name) between 2 and 60),
  iso_code        char(2) unique check (iso_code ~ '^[A-Z]{2}$'),
  currency        char(3) check (currency ~ '^[A-Z]{3}$'),
  timezone        text check (timezone ~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+){1,2}$'),
  website_domain  text check (website_domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$'),
  status          text not null default 'planned'
                    check (status in ('active', 'planned', 'pending_confirmation', 'suspended')),
  sort_order      smallint not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users (id) on delete set null,
  -- A country cannot operate before its code, currency and time zone are known.
  constraint countries_active_is_complete
    check (status <> 'active' or (iso_code is not null and currency is not null and timezone is not null))
);

insert into countries (id, name, iso_code, currency, timezone, status, sort_order) values
  ('tz',    'Tanzania', 'TZ', 'TZS', 'Africa/Dar_es_Salaam', 'active',               1),
  ('ke',    'Kenya',    'KE', 'KES', 'Africa/Nairobi',       'planned',              2),
  ('ug',    'Uganda',   'UG', 'UGX', 'Africa/Kampala',       'planned',              3),
  ('rw',    'Rwanda',   'RW', 'RWF', 'Africa/Kigali',        'planned',              4),
  ('congo', 'Congo',    null, null,  null,                   'pending_confirmation', 5);

-- Where each country's services are. References only: no key, password or
-- connection string is ever stored here.
create table country_service_registry (
  country_id            text primary key references countries (id) on delete cascade,
  api_base_url          text check (char_length(api_base_url) <= 200
                                    and api_base_url ~ '^https://[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[0-9]{1,5})?(/[A-Za-z0-9._~-]+)*$'),
  vercel_project        text check (vercel_project ~ '^[A-Za-z0-9._-]{1,100}$'),
  supabase_project_ref  text check (supabase_project_ref ~ '^[a-z0-9]{8,40}$'),
  enabled               boolean not null default false,
  updated_at            timestamptz not null default now(),
  updated_by            uuid references auth.users (id) on delete set null,
  constraint country_service_enabled_has_url check (not enabled or api_base_url is not null)
);

insert into country_service_registry (country_id) select id from countries;

-- ------------------------------------------------- roles and permissions --

create table permissions (
  key          text primary key check (key ~ '^[a-z]+(\.[a-z_]+){1,2}$'),
  scope        text not null check (scope in ('global', 'country')),
  description  text not null
);

create table roles (
  key           text primary key check (key ~ '^[a-z][a-z_]{2,40}$'),
  name          text not null unique,
  scope         text not null check (scope in ('global', 'country')),
  grantable_by  text not null check (grantable_by in ('provisioning', 'master', 'country_super_admin')),
  requires_mfa  boolean not null,
  sort_order    smallint not null default 0,
  -- A global role is never handed out inside the application.
  constraint roles_global_is_provisioned check (scope <> 'global' or grantable_by = 'provisioning')
);

create table role_permissions (
  role_key        text not null references roles (key) on delete cascade,
  permission_key  text not null references permissions (key) on delete cascade,
  primary key (role_key, permission_key)
);

insert into permissions (key, scope, description) values
  ('products.read',      'country', 'See the country''s products'),
  ('products.create',    'country', 'Add products'),
  ('products.update',    'country', 'Edit products, SKUs, prices and images'),
  ('products.publish',   'country', 'Publish and unpublish products'),
  ('categories.manage',  'country', 'Manage categories, subcategories and brands'),
  ('inventory.read',     'country', 'See stock levels and history'),
  ('inventory.adjust',   'country', 'Adjust stock'),
  ('orders.read',        'country', 'See orders'),
  ('orders.update',      'country', 'Move orders through their lifecycle and add notes'),
  ('customers.read',     'country', 'See customer profiles and order history'),
  ('customers.support',  'country', 'Record customer support activity'),
  ('content.read',       'country', 'See website content'),
  ('content.edit',       'country', 'Edit website content drafts'),
  ('content.publish',    'country', 'Publish and unpublish website content'),
  ('promotions.read',    'country', 'See promotions and campaigns'),
  ('promotions.manage',  'country', 'Create and change promotions and campaigns'),
  ('reports.read',       'country', 'See the country''s reports'),
  ('staff.read',         'country', 'See the country''s administrators and their roles'),
  ('staff.manage',       'country', 'Invite staff and assign or remove staff roles in the country'),
  ('audit.read',         'country', 'See the country''s audit log'),
  ('settings.read',      'country', 'See the country''s operational settings and service status'),
  ('settings.update',    'country', 'Change the country''s operational settings'),
  ('global.countries.manage', 'global', 'Change country configuration and status'),
  ('global.services.manage',  'global', 'Register and check country services'),
  ('global.admins.manage',    'global', 'Create Country Super Admins, suspend and reinstate administrators'),
  ('global.audit.read',       'global', 'See the audit log of every country and of global actions'),
  ('global.security.read',    'global', 'See security events');

insert into roles (key, name, scope, grantable_by, requires_mfa, sort_order) values
  ('master_super_admin',  'Master Super Admin',         'global',  'provisioning',        true,  1),
  ('country_super_admin', 'Country Super Admin',        'country', 'master',              true,  2),
  ('product_manager',     'Product Manager',            'country', 'country_super_admin', false, 3),
  ('inventory_manager',   'Inventory Manager',          'country', 'country_super_admin', false, 4),
  ('order_manager',       'Order Manager',              'country', 'country_super_admin', false, 5),
  ('content_manager',     'Content Manager',            'country', 'country_super_admin', false, 6),
  ('marketing_manager',   'Marketing Manager',          'country', 'country_super_admin', false, 7),
  ('finance_viewer',      'Finance / Reporting Viewer', 'country', 'country_super_admin', false, 8),
  ('customer_support',    'Customer Support',           'country', 'country_super_admin', false, 9);

-- Master Super Admin holds every permission by role and lists none.
insert into role_permissions (role_key, permission_key)
select 'country_super_admin', key from permissions where scope = 'country';

insert into role_permissions (role_key, permission_key) values
  ('product_manager',   'products.read'),
  ('product_manager',   'products.create'),
  ('product_manager',   'products.update'),
  ('product_manager',   'products.publish'),
  ('product_manager',   'categories.manage'),
  ('product_manager',   'inventory.read'),
  ('inventory_manager', 'inventory.read'),
  ('inventory_manager', 'inventory.adjust'),
  ('inventory_manager', 'products.read'),
  ('order_manager',     'orders.read'),
  ('order_manager',     'orders.update'),
  ('order_manager',     'customers.read'),
  ('order_manager',     'inventory.read'),
  ('order_manager',     'products.read'),
  ('content_manager',   'content.read'),
  ('content_manager',   'content.edit'),
  ('content_manager',   'content.publish'),
  ('content_manager',   'products.read'),
  ('marketing_manager', 'promotions.read'),
  ('marketing_manager', 'promotions.manage'),
  ('marketing_manager', 'content.read'),
  ('marketing_manager', 'content.edit'),
  ('marketing_manager', 'products.read'),
  ('marketing_manager', 'reports.read'),
  ('finance_viewer',    'reports.read'),
  ('finance_viewer',    'orders.read'),
  ('customer_support',  'customers.read'),
  ('customer_support',  'customers.support'),
  ('customer_support',  'orders.read');

-- ---------------------------------------------------------- administrators --

create table admin_profiles (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  email              text not null unique check (email = lower(email) and char_length(email) between 3 and 254),
  full_name          text check (char_length(full_name) between 2 and 80),
  status             text not null default 'active' check (status in ('active', 'suspended')),
  suspended_at       timestamptz,
  suspended_by       uuid,
  suspension_reason  text check (char_length(suspension_reason) <= 300),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint admin_profiles_suspension check ((status = 'suspended') = (suspended_at is not null))
);

-- One row per role an administrator holds. Country roles carry the country
-- they apply to; the global role carries none. A removed role keeps its row
-- (revoked_at), so the history of who could do what stays.
create table admin_role_assignments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references admin_profiles (user_id) on delete cascade,
  role_key    text not null references roles (key),
  country_id  text references countries (id),
  granted_by  uuid,                              -- null: the provisioning step
  granted_at  timestamptz not null default now(),
  revoked_at  timestamptz,
  revoked_by  uuid
);

create unique index admin_role_assignments_active_key
  on admin_role_assignments (user_id, role_key, coalesce(country_id, ''))
  where revoked_at is null;
create index admin_role_assignments_country_idx on admin_role_assignments (country_id) where revoked_at is null;

create function app_private.assignment_scope_check()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_scope text;
begin
  select r.scope into v_scope from roles r where r.key = new.role_key;
  if (v_scope = 'global') <> (new.country_id is null) then
    raise exception 'role % (% scope) does not fit country %', new.role_key, v_scope, coalesce(new.country_id, 'none')
      using errcode = 'check_violation';
  end if;
  return new;
end
$$;

create trigger admin_role_assignments_scope
  before insert or update of role_key, country_id on admin_role_assignments
  for each row execute function app_private.assignment_scope_check();

-- A role offered to an email address. It becomes an assignment when the
-- person signs in with that address, confirmed by Supabase Auth.
create table admin_invitations (
  id           uuid primary key default gen_random_uuid(),
  email        text not null check (email = lower(email) and char_length(email) between 3 and 254),
  role_key     text not null references roles (key),
  country_id   text not null references countries (id),
  invited_by   uuid not null references admin_profiles (user_id) on delete cascade,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '7 days'),
  accepted_at  timestamptz,
  accepted_by  uuid,
  revoked_at   timestamptz,
  revoked_by   uuid,
  constraint admin_invitations_one_end check (accepted_at is null or revoked_at is null)
);

create unique index admin_invitations_pending_key
  on admin_invitations (email, role_key, country_id)
  where accepted_at is null and revoked_at is null;

-- ------------------------------------------------------- audit and events --

-- Append-only record of privileged actions. Safe identifiers only: never a
-- password, token, key, payment detail or meter token.
create table audit_logs (
  id           bigint generated always as identity primary key,
  occurred_at  timestamptz not null default now(),
  actor_id     uuid,                               -- null: the provisioning step
  actor_email  text,
  action       text not null check (action ~ '^[a-z_]+(\.[a-z_]+){1,2}$'),
  country_id   text references countries (id),     -- null: a global action
  target_type  text,
  target_id    text,
  summary      jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object')
);

create index audit_logs_country_idx on audit_logs (country_id, occurred_at desc);
create index audit_logs_time_idx on audit_logs (occurred_at desc);

create function app_private.audit_logs_are_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_logs is append-only' using errcode = 'insufficient_privilege';
end
$$;

create trigger audit_logs_no_change
  before update or delete on audit_logs
  for each row execute function app_private.audit_logs_are_append_only();
create trigger audit_logs_no_truncate
  before truncate on audit_logs
  for each statement execute function app_private.audit_logs_are_append_only();

-- Refused attempts, for the Master Super Admin to review.
create table security_events (
  id           bigint generated always as identity primary key,
  occurred_at  timestamptz not null default now(),
  kind         text not null check (kind in ('permission_denied', 'country_denied', 'grant_denied',
                                             'suspended_access', 'mfa_required', 'service_signature_rejected')),
  actor_id     uuid,
  country_id   text,
  detail       jsonb not null default '{}'::jsonb
                 check (jsonb_typeof(detail) = 'object' and pg_column_size(detail) <= 1200)
);

create index security_events_time_idx on security_events (occurred_at desc);

-- Result of asking a country's service whether it answers. Written only
-- after a real request; a country that was never asked has no row.
create table country_health_checks (
  id           bigint generated always as identity primary key,
  country_id   text not null references countries (id) on delete cascade,
  checked_at   timestamptz not null default now(),
  checked_by   uuid,
  ok           boolean not null,
  status_code  integer check (status_code between 100 and 599),
  latency_ms   integer check (latency_ms between 0 and 600000),
  error_code   text check (error_code ~ '^[a-z_]{1,40}$')
);

create index country_health_checks_latest_idx on country_health_checks (country_id, checked_at desc);

-- ------------------------------------------------------- who is the caller --

-- The calling administrator, or null when they do not count: unknown,
-- suspended, without roles, or holding a role that asks for a second
-- factor in a session that has not passed it (JWT claim aal <> 'aal2').
create function app_private.admin_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.user_id
    from admin_profiles p
   where p.user_id = auth.uid()
     and p.status = 'active'
     and exists (select 1 from admin_role_assignments a where a.user_id = p.user_id and a.revoked_at is null)
     and (coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
          or not exists (select 1
                           from admin_role_assignments a
                           join roles r on r.key = a.role_key
                          where a.user_id = p.user_id and a.revoked_at is null and r.requires_mfa))
$$;

create function app_private.is_master()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1
                   from admin_role_assignments a
                  where a.user_id = app_private.admin_id()
                    and a.role_key = 'master_super_admin'
                    and a.country_id is null
                    and a.revoked_at is null)
$$;

-- True when the caller has any role in the country (or is a Master Super Admin).
create function app_private.has_country(p_country text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select app_private.is_master()
      or exists (select 1
                   from admin_role_assignments a
                  where a.user_id = app_private.admin_id()
                    and a.country_id = p_country
                    and a.revoked_at is null)
$$;

-- True when the caller holds the permission in that country. A Master
-- Super Admin holds every permission, the global ones included.
create function app_private.has_permission(p_permission text, p_country text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select app_private.is_master()
      or exists (select 1
                   from admin_role_assignments a
                   join role_permissions rp on rp.role_key = a.role_key
                  where a.user_id = app_private.admin_id()
                    and a.country_id = p_country
                    and a.revoked_at is null
                    and rp.permission_key = p_permission)
$$;

-- May `p_actor` give or take away `p_role` in `p_country`? The actor is an
-- explicit argument so an invitation can be re-checked against its inviter
-- at the moment it is accepted.
--   * Global roles: never (provisioning only).
--   * Country Super Admin: an active Master Super Admin.
--   * Staff roles: an active Master Super Admin, or an active administrator
--     holding staff.manage in that same country.
create function app_private.actor_may_grant(p_actor uuid, p_role text, p_country text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select r.scope = 'country'
       and r.grantable_by <> 'provisioning'
       and p_country is not null
       and exists (select 1 from countries c where c.id = p_country)
       and exists (select 1 from admin_profiles p where p.user_id = p_actor and p.status = 'active')
       and (
         exists (select 1
                   from admin_role_assignments a
                  where a.user_id = p_actor and a.role_key = 'master_super_admin'
                    and a.country_id is null and a.revoked_at is null)
         or (r.grantable_by = 'country_super_admin'
             and exists (select 1
                           from admin_role_assignments a
                           join role_permissions rp on rp.role_key = a.role_key
                          where a.user_id = p_actor and a.country_id = p_country
                            and a.revoked_at is null and rp.permission_key = 'staff.manage'))
       )
      from roles r
     where r.key = p_role), false)
$$;

create function app_private.audit(p_action text, p_country text, p_target_type text, p_target_id text, p_summary jsonb)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into audit_logs (actor_id, actor_email, action, country_id, target_type, target_id, summary)
  values (auth.uid(), (select p.email from admin_profiles p where p.user_id = auth.uid()),
          p_action, p_country, p_target_type, p_target_id, coalesce(p_summary, '{}'::jsonb))
$$;

create function app_private.security_event(p_kind text, p_country text, p_detail jsonb)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into security_events (kind, actor_id, country_id, detail)
  values (p_kind, auth.uid(), p_country, coalesce(p_detail, '{}'::jsonb))
$$;

-- ------------------------------------------------------ row level security --

alter table countries                 enable row level security;
alter table country_service_registry  enable row level security;
alter table permissions               enable row level security;
alter table roles                     enable row level security;
alter table role_permissions          enable row level security;
alter table admin_profiles            enable row level security;
alter table admin_role_assignments    enable row level security;
alter table admin_invitations         enable row level security;
alter table audit_logs                enable row level security;
alter table security_events           enable row level security;
alter table country_health_checks     enable row level security;

-- Read-only policies for the authenticated role. There are no INSERT,
-- UPDATE or DELETE policies and no such grants: writes happen only inside
-- the functions below. "(select f())" lets Postgres evaluate the helper
-- once per statement instead of once per row.

create policy countries_read on countries
  for select to authenticated using ((select app_private.has_country(id)));

create policy country_service_registry_read on country_service_registry
  for select to authenticated using ((select app_private.has_permission('settings.read', country_id)));

create policy permissions_read on permissions
  for select to authenticated using ((select app_private.admin_id()) is not null);
create policy roles_read on roles
  for select to authenticated using ((select app_private.admin_id()) is not null);
create policy role_permissions_read on role_permissions
  for select to authenticated using ((select app_private.admin_id()) is not null);

-- An assignment is visible to its holder, to a Master Super Admin, and to
-- whoever may see the staff of the assignment's country.
create policy admin_role_assignments_read on admin_role_assignments
  for select to authenticated
  using (
    user_id = (select app_private.admin_id())
    or (select app_private.is_master())
    or (country_id is not null and (select app_private.has_permission('staff.read', country_id)))
  );

-- A profile is visible to its owner, to a Master Super Admin, and to whoever
-- may see the staff of a country that person has (or had) a role in.
create policy admin_profiles_read on admin_profiles
  for select to authenticated
  using (
    user_id = (select app_private.admin_id())
    or (select app_private.is_master())
    or exists (select 1
                 from admin_role_assignments a
                where a.user_id = admin_profiles.user_id
                  and a.country_id is not null
                  and app_private.has_permission('staff.read', a.country_id))
  );

create policy admin_invitations_read on admin_invitations
  for select to authenticated using ((select app_private.has_permission('staff.read', country_id)));

-- Global actions (no country) are for a Master Super Admin only.
create policy audit_logs_read on audit_logs
  for select to authenticated
  using (
    (select app_private.is_master())
    or (country_id is not null and (select app_private.has_permission('audit.read', country_id)))
  );

create policy security_events_read on security_events
  for select to authenticated using ((select app_private.is_master()));

create policy country_health_checks_read on country_health_checks
  for select to authenticated using ((select app_private.has_permission('settings.read', country_id)));

-- ------------------------------------------------------------- the session --

-- What the admin application needs to know about the signed-in user: their
-- own profile and active roles. It answers even before the second factor,
-- because the application must know whether to ask for one; it never
-- returns anything about anyone else.
create function admin_session()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select jsonb_build_object(
              'known', true,
              'user_id', p.user_id,
              'email', p.email,
              'full_name', p.full_name,
              'status', p.status,
              'assignments', coalesce((
                select jsonb_agg(jsonb_build_object('role', a.role_key, 'country_id', a.country_id)
                                 order by a.granted_at, a.id)
                  from admin_role_assignments a
                 where a.user_id = p.user_id and a.revoked_at is null), '[]'::jsonb),
              'mfa_required', exists (
                select 1
                  from admin_role_assignments a
                  join roles r on r.key = a.role_key
                 where a.user_id = p.user_id and a.revoked_at is null and r.requires_mfa))
       from admin_profiles p
      where p.user_id = auth.uid()),
    jsonb_build_object('known', false))
$$;

-- Turns the pending invitations for the caller's confirmed email address
-- into role assignments. Called by the application after sign-in. An
-- invitation counts only while its inviter is still active and still
-- allowed to give that role; otherwise it is withdrawn.
create function accept_admin_invitations()
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

-- ------------------------------------------------------------------ roles --

-- Gives `p_role` in `p_country` to the person with `p_email`. If they are
-- already an administrator the role is assigned at once; otherwise an
-- invitation waits for their first sign-in.
-- Returns {"ok": true, "outcome": "granted" | "invited", ...} or
--         {"ok": false, "code": "not_allowed" | "invalid_request" | "own_account"
--                               | "account_suspended" | "already_assigned" | "already_invited"}.
create function invite_admin(p_email text, p_role text, p_country text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor    uuid := app_private.admin_id();
  v_email    text := lower(btrim(coalesce(p_email, '')));
  v_target   admin_profiles%rowtype;
  v_id       uuid;
begin
  if v_actor is null then
    return jsonb_build_object('ok', false, 'code', 'not_allowed');
  end if;
  if char_length(v_email) not between 3 and 254
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$'
     or not exists (select 1 from roles r where r.key = p_role)
     or not exists (select 1 from countries c where c.id = p_country)
  then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  if not app_private.actor_may_grant(v_actor, p_role, p_country) then
    perform app_private.security_event('grant_denied', p_country, jsonb_build_object('role', p_role));
    return jsonb_build_object('ok', false, 'code', 'not_allowed');
  end if;

  select * into v_target from admin_profiles p where p.email = v_email;
  if found then
    if v_target.user_id = v_actor then
      return jsonb_build_object('ok', false, 'code', 'own_account');
    end if;
    if v_target.status <> 'active' then
      return jsonb_build_object('ok', false, 'code', 'account_suspended');
    end if;
    if exists (select 1 from admin_role_assignments a
                where a.user_id = v_target.user_id and a.role_key = p_role
                  and a.country_id = p_country and a.revoked_at is null) then
      return jsonb_build_object('ok', false, 'code', 'already_assigned');
    end if;
    insert into admin_role_assignments (user_id, role_key, country_id, granted_by)
    values (v_target.user_id, p_role, p_country, v_actor)
    returning id into v_id;
    perform app_private.audit('role.grant', p_country, 'admin', v_target.user_id::text,
                              jsonb_build_object('role', p_role, 'email', v_email));
    return jsonb_build_object('ok', true, 'outcome', 'granted', 'assignment_id', v_id);
  end if;

  if v_email = (select p.email from admin_profiles p where p.user_id = v_actor) then
    return jsonb_build_object('ok', false, 'code', 'own_account');
  end if;
  if exists (select 1 from admin_invitations i
              where i.email = v_email and i.role_key = p_role and i.country_id = p_country
                and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()) then
    return jsonb_build_object('ok', false, 'code', 'already_invited');
  end if;
  -- An expired invitation for the same role makes way for the new one.
  update admin_invitations set revoked_at = now(), revoked_by = v_actor
   where email = v_email and role_key = p_role and country_id = p_country
     and accepted_at is null and revoked_at is null;
  insert into admin_invitations (email, role_key, country_id, invited_by)
  values (v_email, p_role, p_country, v_actor)
  returning id into v_id;
  perform app_private.audit('invitation.create', p_country, 'invitation', v_id::text,
                            jsonb_build_object('role', p_role, 'email', v_email));
  return jsonb_build_object('ok', true, 'outcome', 'invited', 'invitation_id', v_id);
end
$$;

create function revoke_admin_invitation(p_invitation uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor  uuid := app_private.admin_id();
  v_inv    admin_invitations%rowtype;
begin
  if v_actor is null then
    return jsonb_build_object('ok', false, 'code', 'not_allowed');
  end if;
  select * into v_inv from admin_invitations i where i.id = p_invitation for update;
  if not found or not app_private.actor_may_grant(v_actor, v_inv.role_key, v_inv.country_id) then
    -- The same answer for "not there" and "not yours to see".
    return jsonb_build_object('ok', false, 'code', 'not_allowed');
  end if;
  if v_inv.accepted_at is not null or v_inv.revoked_at is not null then
    return jsonb_build_object('ok', false, 'code', 'not_pending');
  end if;
  update admin_invitations set revoked_at = now(), revoked_by = v_actor where id = v_inv.id;
  perform app_private.audit('invitation.revoke', v_inv.country_id, 'invitation', v_inv.id::text,
                            jsonb_build_object('role', v_inv.role_key, 'email', v_inv.email));
  return jsonb_build_object('ok', true);
end
$$;

-- Takes a role away. Global roles are not touched here (provisioning only)
-- and nobody removes their own role.
create function revoke_admin_role(p_assignment uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor  uuid := app_private.admin_id();
  v_row    admin_role_assignments%rowtype;
begin
  if v_actor is null then
    return jsonb_build_object('ok', false, 'code', 'not_allowed');
  end if;
  select * into v_row from admin_role_assignments a where a.id = p_assignment for update;
  if not found or v_row.country_id is null
     or not app_private.actor_may_grant(v_actor, v_row.role_key, v_row.country_id) then
    if found then
      perform app_private.security_event('grant_denied', v_row.country_id,
                                         jsonb_build_object('role', v_row.role_key, 'operation', 'revoke'));
    end if;
    return jsonb_build_object('ok', false, 'code', 'not_allowed');
  end if;
  if v_row.user_id = v_actor then
    return jsonb_build_object('ok', false, 'code', 'own_account');
  end if;
  if v_row.revoked_at is not null then
    return jsonb_build_object('ok', false, 'code', 'not_active');
  end if;
  update admin_role_assignments set revoked_at = now(), revoked_by = v_actor where id = v_row.id;
  perform app_private.audit('role.revoke', v_row.country_id, 'admin', v_row.user_id::text,
                            jsonb_build_object('role', v_row.role_key));
  return jsonb_build_object('ok', true);
end
$$;

-- ----------------------------------------------------- suspend, reinstate --

-- Switches an account off in every country at once: from this moment
-- app_private.admin_id() is null for it, whatever its session says. Only a
-- Master Super Admin, never on themselves, never on a Master Super Admin.
create function set_admin_status(p_user uuid, p_status text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor   uuid := app_private.admin_id();
  v_target  admin_profiles%rowtype;
  v_reason  text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_actor is null or not app_private.is_master() then
    if v_actor is not null then
      perform app_private.security_event('permission_denied', null, jsonb_build_object('operation', 'set_admin_status'));
    end if;
    return jsonb_build_object('ok', false, 'code', 'not_allowed');
  end if;
  if p_status not in ('active', 'suspended') or char_length(coalesce(v_reason, '')) > 300 then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  select * into v_target from admin_profiles p where p.user_id = p_user for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_target.user_id = v_actor then
    return jsonb_build_object('ok', false, 'code', 'own_account');
  end if;
  if exists (select 1 from admin_role_assignments a
              where a.user_id = v_target.user_id and a.role_key = 'master_super_admin' and a.revoked_at is null) then
    return jsonb_build_object('ok', false, 'code', 'master_is_provisioned');
  end if;
  if v_target.status = p_status then
    return jsonb_build_object('ok', true, 'changed', false);
  end if;

  if p_status = 'suspended' then
    update admin_profiles
       set status = 'suspended', suspended_at = now(), suspended_by = v_actor, suspension_reason = v_reason, updated_at = now()
     where user_id = v_target.user_id;
    perform app_private.audit('admin.suspend', null, 'admin', v_target.user_id::text,
                              jsonb_build_object('email', v_target.email, 'reason', v_reason));
  else
    update admin_profiles
       set status = 'active', suspended_at = null, suspended_by = null, suspension_reason = null, updated_at = now()
     where user_id = v_target.user_id;
    perform app_private.audit('admin.reinstate', null, 'admin', v_target.user_id::text,
                              jsonb_build_object('email', v_target.email));
  end if;
  return jsonb_build_object('ok', true, 'changed', true);
end
$$;

-- --------------------------------------------------------------- countries --

-- Changes a country's configuration. Master Super Admin only. `p_patch`
-- may carry name, iso_code, currency, timezone, website_domain and status;
-- a JSON null clears a value. The table's own constraints decide what is
-- valid (an active country needs its code, currency and time zone).
create function update_country(p_country text, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor   uuid := app_private.admin_id();
  v_before  countries%rowtype;
  v_after   countries%rowtype;
  v_extra   text;
begin
  if v_actor is null or not app_private.is_master() then
    if v_actor is not null then
      perform app_private.security_event('permission_denied', p_country, jsonb_build_object('operation', 'update_country'));
    end if;
    return jsonb_build_object('ok', false, 'code', 'not_allowed');
  end if;
  if jsonb_typeof(p_patch) is distinct from 'object' then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  select k into v_extra from jsonb_object_keys(p_patch) k
   where k not in ('name', 'iso_code', 'currency', 'timezone', 'website_domain', 'status') limit 1;
  if v_extra is not null then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  select * into v_before from countries c where c.id = p_country for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  update countries c
     set name           = case when p_patch ? 'name' then btrim(p_patch ->> 'name') else c.name end,
         iso_code       = case when p_patch ? 'iso_code' then upper(p_patch ->> 'iso_code') else c.iso_code end,
         currency       = case when p_patch ? 'currency' then upper(p_patch ->> 'currency') else c.currency end,
         timezone       = case when p_patch ? 'timezone' then p_patch ->> 'timezone' else c.timezone end,
         website_domain = case when p_patch ? 'website_domain' then lower(p_patch ->> 'website_domain') else c.website_domain end,
         status         = case when p_patch ? 'status' then p_patch ->> 'status' else c.status end,
         updated_at     = now(),
         updated_by     = v_actor
   where c.id = p_country
  returning * into v_after;

  if v_after.timezone is not null and not exists (select 1 from pg_timezone_names z where z.name = v_after.timezone) then
    raise exception 'unknown time zone' using errcode = 'check_violation';
  end if;

  perform app_private.audit('country.update', p_country, 'country', p_country, jsonb_build_object(
    'before', jsonb_build_object('name', v_before.name, 'iso_code', v_before.iso_code, 'currency', v_before.currency,
                                 'timezone', v_before.timezone, 'website_domain', v_before.website_domain, 'status', v_before.status),
    'after',  jsonb_build_object('name', v_after.name, 'iso_code', v_after.iso_code, 'currency', v_after.currency,
                                 'timezone', v_after.timezone, 'website_domain', v_after.website_domain, 'status', v_after.status)));
  return jsonb_build_object('ok', true);
exception
  when check_violation or not_null_violation or string_data_right_truncation then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'already_exists');
end
$$;

-- Registers where a country's services are. Master Super Admin only.
-- `p_patch` may carry api_base_url, vercel_project, supabase_project_ref
-- and enabled. References only: never a key or a connection string.
create function update_country_service(p_country text, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor   uuid := app_private.admin_id();
  v_before  country_service_registry%rowtype;
  v_after   country_service_registry%rowtype;
  v_extra   text;
begin
  if v_actor is null or not app_private.is_master() then
    if v_actor is not null then
      perform app_private.security_event('permission_denied', p_country, jsonb_build_object('operation', 'update_country_service'));
    end if;
    return jsonb_build_object('ok', false, 'code', 'not_allowed');
  end if;
  if jsonb_typeof(p_patch) is distinct from 'object'
     or (p_patch ? 'enabled' and jsonb_typeof(p_patch -> 'enabled') is distinct from 'boolean') then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  select k into v_extra from jsonb_object_keys(p_patch) k
   where k not in ('api_base_url', 'vercel_project', 'supabase_project_ref', 'enabled') limit 1;
  if v_extra is not null then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  select * into v_before from country_service_registry s where s.country_id = p_country for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  update country_service_registry s
     set api_base_url         = case when p_patch ? 'api_base_url' then p_patch ->> 'api_base_url' else s.api_base_url end,
         vercel_project       = case when p_patch ? 'vercel_project' then p_patch ->> 'vercel_project' else s.vercel_project end,
         supabase_project_ref = case when p_patch ? 'supabase_project_ref' then p_patch ->> 'supabase_project_ref' else s.supabase_project_ref end,
         enabled              = case when p_patch ? 'enabled' then (p_patch ->> 'enabled')::boolean else s.enabled end,
         updated_at           = now(),
         updated_by           = v_actor
   where s.country_id = p_country
  returning * into v_after;

  perform app_private.audit('country_service.update', p_country, 'country_service', p_country, jsonb_build_object(
    'before', jsonb_build_object('api_base_url', v_before.api_base_url, 'vercel_project', v_before.vercel_project,
                                 'supabase_project_ref', v_before.supabase_project_ref, 'enabled', v_before.enabled),
    'after',  jsonb_build_object('api_base_url', v_after.api_base_url, 'vercel_project', v_after.vercel_project,
                                 'supabase_project_ref', v_after.supabase_project_ref, 'enabled', v_after.enabled)));
  return jsonb_build_object('ok', true);
exception
  when check_violation or not_null_violation then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
end
$$;

-- Records the outcome of a real request to a country's service.
create function record_country_health_check(p_country text, p_ok boolean, p_status_code integer, p_latency_ms integer, p_error_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if app_private.admin_id() is null or not app_private.has_permission('settings.read', p_country)
     or not exists (select 1 from countries c where c.id = p_country) then
    return jsonb_build_object('ok', false, 'code', 'not_allowed');
  end if;
  insert into country_health_checks (country_id, checked_by, ok, status_code, latency_ms, error_code)
  values (p_country, auth.uid(), coalesce(p_ok, false), p_status_code, p_latency_ms, p_error_code);
  return jsonb_build_object('ok', true);
exception
  when check_violation then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
end
$$;

-- The application reports an attempt it refused (a country or a permission
-- the signed-in user does not have). Any signed-in user of the admin Auth
-- project can cause a row, so the content is limited to a kind, a country
-- key and a small detail object.
create function record_security_event(p_kind text, p_country text, p_detail jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null
     or p_kind not in ('permission_denied', 'country_denied', 'suspended_access', 'mfa_required')
     or char_length(coalesce(p_country, '')) > 24
     or jsonb_typeof(coalesce(p_detail, '{}'::jsonb)) <> 'object'
     or pg_column_size(coalesce(p_detail, '{}'::jsonb)) > 1200 then
    return;
  end if;
  perform app_private.security_event(p_kind, p_country, p_detail);
end
$$;

-- ------------------------------------------------------------ provisioning --

-- THE ONLY WAY to create a Master Super Admin. Run by the database owner
-- (Supabase SQL editor); no API role can execute it. The person must
-- already have an account in this project's Auth with a confirmed email.
--   select app_private.provision_master_super_admin('owner@example.com');
create function app_private.provision_master_super_admin(p_email text)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_user   uuid;
begin
  select u.id into v_user from auth.users u where lower(u.email) = v_email and u.email_confirmed_at is not null;
  if v_user is null then
    raise exception 'no Auth user with a confirmed email address %', v_email;
  end if;
  insert into admin_profiles (user_id, email) values (v_user, v_email) on conflict (user_id) do nothing;
  if (select p.status from admin_profiles p where p.user_id = v_user) <> 'active' then
    raise exception 'the account % is suspended', v_email;
  end if;
  insert into admin_role_assignments (user_id, role_key, country_id, granted_by)
  values (v_user, 'master_super_admin', null, null)
  on conflict do nothing;
  insert into audit_logs (actor_id, actor_email, action, target_type, target_id, summary)
  values (null, null, 'master.provision', 'admin', v_user::text, jsonb_build_object('email', v_email));
  return v_user;
end
$$;

-- Takes the Master Super Admin role away. Owner only, like the above.
create function app_private.revoke_master_super_admin(p_email text)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_user   uuid;
begin
  select p.user_id into v_user from admin_profiles p where p.email = v_email;
  if v_user is null then
    raise exception 'no administrator with the email address %', v_email;
  end if;
  update admin_role_assignments set revoked_at = now()
   where user_id = v_user and role_key = 'master_super_admin' and revoked_at is null;
  insert into audit_logs (actor_id, actor_email, action, target_type, target_id, summary)
  values (null, null, 'master.revoke', 'admin', v_user::text, jsonb_build_object('email', v_email));
end
$$;

-- ----------------------------------------------------------------- grants --

-- Undo Supabase's default "ALL to anon, authenticated, service_role" on
-- everything above, then grant exactly what is needed. The service_role is
-- included: this application never uses it, and without grants a leaked
-- service key cannot read or change these tables either.
revoke all on all tables in schema public from public, anon, authenticated, service_role;
revoke all on all sequences in schema public from public, anon, authenticated, service_role;
revoke all on all functions in schema public from public, anon, authenticated, service_role;
revoke all on all functions in schema app_private from public, anon, authenticated, service_role;
revoke all on schema app_private from public, anon, service_role;
alter default privileges in schema public revoke all on tables from anon, authenticated, service_role;
alter default privileges in schema public revoke all on sequences from anon, authenticated, service_role;
alter default privileges in schema public revoke all on functions from anon, authenticated, service_role;

grant usage on schema public to authenticated;
grant usage on schema app_private to authenticated;

grant select on
  countries, country_service_registry, permissions, roles, role_permissions,
  admin_profiles, admin_role_assignments, admin_invitations,
  audit_logs, security_events, country_health_checks
to authenticated;

-- Helpers the policies call. Everything else in app_private stays owner-only.
grant execute on function
  app_private.admin_id(),
  app_private.is_master(),
  app_private.has_country(text),
  app_private.has_permission(text, text)
to authenticated;

grant execute on function
  admin_session(),
  accept_admin_invitations(),
  invite_admin(text, text, text),
  revoke_admin_invitation(uuid),
  revoke_admin_role(uuid),
  set_admin_status(uuid, text, text),
  update_country(text, jsonb),
  update_country_service(text, jsonb),
  record_country_health_check(text, boolean, integer, integer, text),
  record_security_event(text, text, jsonb)
to authenticated;

commit;
