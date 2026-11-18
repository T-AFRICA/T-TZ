-- 0008_deliveries.sql — deliveries by TRONIC's own riders (DRAFT).
--
-- Forward-only, additive. Exercised only against a disposable PGlite
-- database with a Supabase role shim (database/client/tests); applying it
-- to a Supabase project needs owner approval. Requires 0006. Safe to run
-- again.
--
-- Owner decisions 2026-11-18: TRONIC's own riders deliver; customers see
-- status updates (no live map yet); proof of delivery is the customer's
-- code plus a photo and the customer's signature; riders use the Central
-- Admin, which reaches this database only through the signed country API.
--
-- Rules:
--   * An order is given to one rider while it is confirmed, processing or
--     packed, and can be given to another rider until it is picked up.
--   * A rider sees and changes only the orders given to them. The rider is
--     the administrator named in the signed request, never a value the
--     rider sends.
--   * The rider moves the order: picked up (dispatched), on the way
--     (in transit), delivered. Each step goes through
--     admin_update_order_status (0006), so the order history, Cash on
--     Delivery being marked paid, and "the same request applies once" work
--     exactly as for administrators.
--   * Delivered needs the customer's six-digit code, a photo and the
--     customer's signature; for an unpaid Cash on Delivery order, the cash
--     collected must equal the order total. Five wrong codes lock the order
--     for 15 minutes.
--   * The customer reads their code (their own order, or the order number
--     with the email or phone used at checkout) only while the order is on
--     its way. Riders and administrators never see it.
--   * A failed attempt is recorded with a reason; the order stays with the
--     rider, on its way.
--   * Photos and signatures are kept here, private, at most 1 MB each.

begin;

create table if not exists deliveries (
  order_id              uuid primary key references orders (id) on delete cascade,
  rider_id              uuid not null,           -- the rider's Central Admin user id
  rider_name            text not null check (char_length(rider_name) between 1 and 80),
  assigned_by           uuid not null,
  assigned_at           timestamptz not null default now(),
  code                  text not null check (code ~ '^[0-9]{6}$'),
  code_attempts         smallint not null default 0 check (code_attempts >= 0),
  code_locked_until     timestamptz,
  cash_collected_minor  bigint check (cash_collected_minor is null or cash_collected_minor >= 0),
  delivered_at          timestamptz,
  updated_at            timestamptz not null default now()
);

create index if not exists deliveries_rider_idx on deliveries (rider_id, assigned_at desc);

create table if not exists delivery_proofs (
  order_id      uuid not null references orders (id) on delete cascade,
  kind          text not null check (kind in ('photo', 'signature')),
  content_type  text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  bytes         bytea not null check (octet_length(bytes) between 100 and 1048576),
  sha256        text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  actor_id      uuid not null,
  created_at    timestamptz not null default now(),
  primary key (order_id, kind)
);

create table if not exists delivery_attempts (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references orders (id) on delete cascade,
  reason      text not null check (reason in ('customer_unreachable', 'customer_absent', 'address_not_found',
                                              'customer_refused', 'other')),
  note        text check (char_length(note) <= 300),
  actor_id    uuid not null,
  request_id  uuid not null unique,
  created_at  timestamptz not null default now()
);

create index if not exists delivery_attempts_order_idx on delivery_attempts (order_id, id);

alter table deliveries        enable row level security;
alter table delivery_proofs   enable row level security;
alter table delivery_attempts enable row level security;
revoke all on deliveries, delivery_proofs, delivery_attempts from public, anon, authenticated, service_role;

-- ----------------------------------------------------------------- assign --

-- Gives an order to a rider (or to another rider before pickup). Returns
--   {"ok": true, "replayed": false, "rider_id", "rider_name"}
--   {"ok": false, "code": "invalid_request" | "not_found"}
--   {"ok": false, "code": "not_assignable", "status": current}
create or replace function admin_assign_delivery(
  p_country      char(2),
  p_order_number text,
  p_rider        uuid,
  p_rider_name   text,
  p_actor        uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order  orders%rowtype;
  v_name   text := btrim(coalesce(p_rider_name, ''));
begin
  if p_rider is null or p_actor is null or char_length(v_name) not between 1 and 80 then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  select * into v_order from orders o
   where o.country_code = p_country and o.order_number = upper(btrim(p_order_number))
     for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_order.status not in ('confirmed', 'processing', 'packed') or v_order.delivery_method <> 'home' then
    return jsonb_build_object('ok', false, 'code', 'not_assignable', 'status', v_order.status);
  end if;

  insert into deliveries (order_id, rider_id, rider_name, assigned_by, code)
  values (v_order.id, p_rider, v_name, p_actor,
          -- Six digits from the strong random source behind gen_random_uuid().
          lpad(((('x' || substr(md5(gen_random_uuid()::text), 1, 8))::bit(32)::bigint) % 1000000)::text, 6, '0'))
  on conflict (order_id) do update
     set rider_id = excluded.rider_id, rider_name = excluded.rider_name,
         assigned_by = excluded.assigned_by, assigned_at = now(), updated_at = now();

  return jsonb_build_object('ok', true, 'replayed', false, 'rider_id', p_rider, 'rider_name', v_name);
end
$$;

-- The delivery of one order for administrators: rider, progress, cash,
-- which proofs exist, failed attempts. Never the code. Null when the order
-- has no delivery.
create or replace function admin_get_delivery(p_country char(2), p_order_number text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'rider_id', d.rider_id, 'rider_name', d.rider_name, 'assigned_at', d.assigned_at,
    'delivered_at', d.delivered_at, 'cash_collected_minor', d.cash_collected_minor,
    'code_locked', coalesce(d.code_locked_until > now(), false),
    'proofs', coalesce((select jsonb_agg(p.kind order by p.kind) from delivery_proofs p where p.order_id = o.id), '[]'::jsonb),
    'attempts', coalesce((select jsonb_agg(jsonb_build_object('reason', a.reason, 'note', a.note, 'actor_id', a.actor_id,
                                                              'created_at', a.created_at) order by a.id)
                            from delivery_attempts a where a.order_id = o.id), '[]'::jsonb))
    from orders o
    join deliveries d on d.order_id = o.id
   where o.country_code = p_country and o.order_number = upper(btrim(p_order_number))
$$;

-- One proof image, base64, for administrators. Null when there is none.
create or replace function admin_get_delivery_proof(p_country char(2), p_order_number text, p_kind text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object('content_type', p.content_type, 'data', encode(p.bytes, 'base64'), 'created_at', p.created_at)
    from orders o
    join delivery_proofs p on p.order_id = o.id and p.kind = p_kind
   where o.country_code = p_country and o.order_number = upper(btrim(p_order_number))
$$;

-- ------------------------------------------------------------------ rider --

-- The rider's own deliveries: everything still to do, and what they
-- delivered in the last 24 hours. Newest assignment first.
create or replace function rider_list_deliveries(p_country char(2), p_rider uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'order_number', o.order_number, 'status', o.status, 'contact_name', o.contact_name,
           'region', o.delivery_region, 'district', o.delivery_district, 'ward', o.delivery_ward,
           'street', o.delivery_street, 'payment_method', o.payment_method, 'payment_status', o.payment_status,
           'total_minor', o.total_minor, 'currency', o.currency,
           'currency_exponent', (select c.exponent from currencies c where c.code = o.currency),
           'item_count', (select coalesce(sum(l.quantity), 0) from order_lines l where l.order_id = o.id),
           'assigned_at', d.assigned_at)
         order by d.assigned_at desc), '[]'::jsonb)
    from deliveries d
    join orders o on o.id = d.order_id
   where o.country_code = p_country and d.rider_id = p_rider
     and (o.status in ('confirmed', 'processing', 'packed', 'dispatched', 'in_transit')
          or (o.status = 'delivered' and d.delivered_at > now() - interval '24 hours'))
$$;

-- One delivery of the rider, with what they need at the door; null when
-- the order is not theirs (the same answer as an unknown order).
create or replace function rider_get_delivery(p_country char(2), p_order_number text, p_rider uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'order_number', o.order_number, 'status', o.status,
    'contact', jsonb_build_object('name', o.contact_name, 'phone', o.contact_phone),
    'delivery', jsonb_build_object('region', o.delivery_region, 'district', o.delivery_district, 'ward', o.delivery_ward,
                                   'street', o.delivery_street, 'extra', o.delivery_extra, 'notes', o.delivery_notes),
    'payment_method', o.payment_method, 'payment_status', o.payment_status,
    'total_minor', o.total_minor, 'currency', o.currency,
    'currency_exponent', (select c.exponent from currencies c where c.code = o.currency),
    'cash_to_collect_minor', case when o.payment_method = 'pay_on_delivery' and o.payment_status = 'pending'
                                  then o.total_minor else 0 end,
    'lines', coalesce((select jsonb_agg(jsonb_build_object('name', l.name, 'sku', l.sku, 'color', l.color,
                                                           'variant', l.variant, 'quantity', l.quantity) order by l.line_no)
                         from order_lines l where l.order_id = o.id), '[]'::jsonb),
    'assigned_at', d.assigned_at, 'delivered_at', d.delivered_at,
    'code_locked_until', case when d.code_locked_until > now() then d.code_locked_until end,
    'attempts', coalesce((select jsonb_agg(jsonb_build_object('reason', a.reason, 'note', a.note, 'created_at', a.created_at)
                                           order by a.id)
                            from delivery_attempts a where a.order_id = o.id), '[]'::jsonb))
    from deliveries d
    join orders o on o.id = d.order_id
   where o.country_code = p_country and o.order_number = upper(btrim(p_order_number)) and d.rider_id = p_rider
$$;

-- A step of the rider's delivery. p_action:
--   pickup   packed -> dispatched
--   start    dispatched -> in_transit
--   deliver  in_transit -> delivered, with the code, both proofs and, for an
--            unpaid Cash on Delivery order, the cash collected
--   fail     a failed attempt (dispatched or in transit), with a reason
-- Returns
--   {"ok": true, "replayed": bool, "status": text, "payment_status": text}
--   {"ok": false, "code": "invalid_request" | "not_found"}
--   {"ok": false, "code": "wrong_step", "status": current}
--   {"ok": false, "code": "wrong_code", "attempts_left": n}
--   {"ok": false, "code": "code_locked", "locked_until": ts}
--   {"ok": false, "code": "proof_missing" | "cash_mismatch"}
-- p_request makes a step apply once.
create or replace function rider_update_delivery(
  p_country          char(2),
  p_order_number     text,
  p_rider            uuid,
  p_action           text,
  p_request          uuid,
  p_code             text,
  p_cash_minor       bigint,
  p_photo            bytea,
  p_photo_type       text,
  p_signature        bytea,
  p_signature_type   text,
  p_reason           text,
  p_note             text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order     orders%rowtype;
  v_delivery  deliveries%rowtype;
  v_to        text;
  v_result    jsonb;
  v_note      text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if p_rider is null or p_request is null or p_action not in ('pickup', 'start', 'deliver', 'fail') then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;

  select * into v_order from orders o
   where o.country_code = p_country and o.order_number = upper(btrim(p_order_number))
     for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  select * into v_delivery from deliveries d where d.order_id = v_order.id for update;
  if not found or v_delivery.rider_id <> p_rider then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  -- The same request again: answer as the first time.
  if exists (select 1 from order_status_events e where e.request_id = p_request and e.order_id = v_order.id)
     or exists (select 1 from delivery_attempts a where a.request_id = p_request and a.order_id = v_order.id) then
    return jsonb_build_object('ok', true, 'replayed', true, 'status', v_order.status, 'payment_status', v_order.payment_status);
  end if;

  if p_action = 'fail' then
    if v_order.status not in ('dispatched', 'in_transit') then
      return jsonb_build_object('ok', false, 'code', 'wrong_step', 'status', v_order.status);
    end if;
    if p_reason is null or p_reason not in ('customer_unreachable', 'customer_absent', 'address_not_found',
                                            'customer_refused', 'other')
       or char_length(coalesce(v_note, '')) > 300 or (p_reason = 'other' and v_note is null) then
      return jsonb_build_object('ok', false, 'code', 'invalid_request');
    end if;
    insert into delivery_attempts (order_id, reason, note, actor_id, request_id)
    values (v_order.id, p_reason, v_note, p_rider, p_request);
    update deliveries set updated_at = now() where order_id = v_order.id;
    return jsonb_build_object('ok', true, 'replayed', false, 'status', v_order.status, 'payment_status', v_order.payment_status);
  end if;

  v_to := case p_action when 'pickup' then 'dispatched' when 'start' then 'in_transit' else 'delivered' end;
  if (p_action = 'pickup' and v_order.status <> 'packed')
     or (p_action = 'start' and v_order.status <> 'dispatched')
     or (p_action = 'deliver' and v_order.status <> 'in_transit') then
    return jsonb_build_object('ok', false, 'code', 'wrong_step', 'status', v_order.status);
  end if;

  if p_action = 'deliver' then
    if v_delivery.code_locked_until is not null and v_delivery.code_locked_until > now() then
      return jsonb_build_object('ok', false, 'code', 'code_locked', 'locked_until', v_delivery.code_locked_until);
    end if;
    if p_code is null or p_code !~ '^[0-9]{6}$' or p_code <> v_delivery.code then
      update deliveries
         set code_attempts = case when code_attempts + 1 >= 5 then 0 else code_attempts + 1 end,
             code_locked_until = case when code_attempts + 1 >= 5 then now() + interval '15 minutes' else null end,
             updated_at = now()
       where order_id = v_order.id
      returning * into v_delivery;
      if v_delivery.code_locked_until is not null then
        return jsonb_build_object('ok', false, 'code', 'code_locked', 'locked_until', v_delivery.code_locked_until);
      end if;
      return jsonb_build_object('ok', false, 'code', 'wrong_code', 'attempts_left', 5 - v_delivery.code_attempts);
    end if;
    if p_photo is null or p_signature is null
       or p_photo_type not in ('image/jpeg', 'image/png', 'image/webp')
       or p_signature_type not in ('image/jpeg', 'image/png', 'image/webp')
       or octet_length(p_photo) not between 100 and 1048576
       or octet_length(p_signature) not between 100 and 1048576 then
      return jsonb_build_object('ok', false, 'code', 'proof_missing');
    end if;
    if v_order.payment_method = 'pay_on_delivery' and v_order.payment_status = 'pending'
       and (p_cash_minor is null or p_cash_minor <> v_order.total_minor) then
      return jsonb_build_object('ok', false, 'code', 'cash_mismatch');
    end if;
  end if;

  v_result := admin_update_order_status(p_country, v_order.order_number, v_to, null, p_rider, p_request);
  if (v_result ->> 'ok')::boolean is not true then
    return jsonb_build_object('ok', false, 'code', 'wrong_step', 'status', coalesce(v_result ->> 'status', v_order.status));
  end if;

  if p_action = 'deliver' then
    insert into delivery_proofs (order_id, kind, content_type, bytes, sha256, actor_id) values
      (v_order.id, 'photo', p_photo_type, p_photo, encode(sha256(p_photo), 'hex'), p_rider),
      (v_order.id, 'signature', p_signature_type, p_signature, encode(sha256(p_signature), 'hex'), p_rider)
    on conflict (order_id, kind) do nothing;
    update deliveries
       set delivered_at = now(), code_attempts = 0, code_locked_until = null,
           cash_collected_minor = case when v_order.payment_method = 'pay_on_delivery' then p_cash_minor end,
           updated_at = now()
     where order_id = v_order.id;
  else
    update deliveries set updated_at = now() where order_id = v_order.id;
  end if;

  return jsonb_build_object('ok', true, 'replayed', false, 'status', v_result ->> 'status',
                            'payment_status', v_result ->> 'payment_status');
end
$$;

-- --------------------------------------------------------------- customer --

-- The customer's delivery code while the order is on its way: for the
-- signed-in owner of the order, or with the email or phone used at checkout.
-- {"code": "123456"} or null. A wrong pair and an unknown order are the same null.
create or replace function customer_delivery_code(p_order_number text, p_contact text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object('code', d.code)
    from orders o
    join deliveries d on d.order_id = o.id
   where o.order_number = upper(btrim(p_order_number))
     and o.status in ('dispatched', 'in_transit')
     and ((auth.uid() is not null and o.user_id = auth.uid())
          or (nullif(btrim(coalesce(p_contact, '')), '') is not null
              and (o.contact_email = lower(btrim(p_contact)) or o.contact_phone = btrim(p_contact))))
$$;

revoke execute on function admin_assign_delivery(char, text, uuid, text, uuid) from public, anon, authenticated;
revoke execute on function admin_get_delivery(char, text) from public, anon, authenticated;
revoke execute on function admin_get_delivery_proof(char, text, text) from public, anon, authenticated;
revoke execute on function rider_list_deliveries(char, uuid) from public, anon, authenticated;
revoke execute on function rider_get_delivery(char, text, uuid) from public, anon, authenticated;
revoke execute on function rider_update_delivery(char, text, uuid, text, uuid, text, bigint, bytea, text, bytea, text, text, text) from public, anon, authenticated;
revoke execute on function customer_delivery_code(text, text) from public;

grant execute on function admin_assign_delivery(char, text, uuid, text, uuid) to service_role;
grant execute on function admin_get_delivery(char, text) to service_role;
grant execute on function admin_get_delivery_proof(char, text, text) to service_role;
grant execute on function rider_list_deliveries(char, uuid) to service_role;
grant execute on function rider_get_delivery(char, text, uuid) to service_role;
grant execute on function rider_update_delivery(char, text, uuid, text, uuid, text, bigint, bytea, text, bytea, text, text, text) to service_role;
grant execute on function customer_delivery_code(text, text) to anon, authenticated;

commit;
