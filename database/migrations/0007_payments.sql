-- 0007_payments.sql — online payment records (DRAFT).
--
-- Forward-only, additive. Exercised only against a disposable PGlite
-- database with a Supabase role shim (database/client/tests); applying it
-- to a Supabase project needs owner approval. Requires 0004. Safe to run
-- again.
--
-- No payment provider is connected yet. This prepares the records an
-- approved gateway will write to, so the checkout and the gateway adapter
-- can be built against a fixed contract (payment module brief, 2026-11-18).
--
-- Rules (rulesd §4):
--   * A payment belongs to one order. Its amount and currency are copied
--     from the order on the server; nothing the browser sends sets them.
--   * Payment status is separate from the order's fulfilment status:
--       not_initiated -> pending -> processing -> successful -> refunded
--                                              -> failed | cancelled | expired
--     Only a verified gateway answer (the initiation response, a status
--     check or a signed webhook) moves a payment; the browser never can.
--   * One payment in progress per order, and at most one successful one:
--     a second payment for the same order is refused, not charged.
--   * Gateway events are applied once: the same event id again changes
--     nothing. An event whose amount, currency, gateway or reference does
--     not match is recorded as rejected and changes nothing.
--   * A successful payment marks the order paid and confirms it if it was
--     waiting for payment. Failed, cancelled or expired payments leave the
--     order waiting, so the customer can try again.
--   * Customers read their own payments (through their own orders); the
--     event log and every function belong to the server (service_role).
--   * Logged fields are codes and identifiers only: no card data, no PIN,
--     no raw gateway payload.

begin;

-- Orders may name an online method once its gateway is approved.
alter table orders drop constraint if exists orders_payment_method_check;
alter table orders add constraint orders_payment_method_check
  check (payment_method in ('pay_on_delivery', 'mobile_money', 'card', 'bank_transfer'));

create table if not exists payments (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references orders (id) on delete restrict,
  country_code       char(2) not null references countries (code),
  method             text not null check (method in ('mobile_money', 'card', 'bank_transfer')),
  gateway            text not null check (gateway ~ '^[a-z][a-z0-9_]{1,31}$'),
  wallet_provider    text check (wallet_provider is null or wallet_provider ~ '^[a-z][a-z0-9_]{1,31}$'),
  payer_phone        text check (payer_phone is null or payer_phone ~ '^\+[0-9]{9,15}$'),
  -- TRONIC's own transaction reference, given to the gateway and the customer.
  reference          text not null unique,
  -- The gateway's transaction id, once it has one.
  gateway_reference  text check (gateway_reference is null or char_length(gateway_reference) between 1 and 100),
  status             text not null default 'not_initiated'
                       check (status in ('not_initiated', 'pending', 'processing', 'successful',
                                         'failed', 'cancelled', 'expired', 'refunded')),
  amount_minor       bigint not null check (amount_minor > 0),
  currency           char(3) not null references currencies (code),
  idempotency_key    uuid not null unique,
  failure_code       text check (failure_code is null or failure_code ~ '^[a-z][a-z0-9_]{1,40}$'),
  expires_at         timestamptz not null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  completed_at       timestamptz,
  unique (gateway, gateway_reference)
);

create unique index if not exists payments_one_active_per_order on payments (order_id)
  where status in ('not_initiated', 'pending', 'processing');
create unique index if not exists payments_one_paid_per_order on payments (order_id)
  where status in ('successful', 'refunded');
create index if not exists payments_order_idx on payments (order_id, created_at);
create index if not exists payments_due_idx on payments (expires_at) where status in ('not_initiated', 'pending');

-- Every change, and every refused attempt to change, a payment.
create table if not exists payment_events (
  id                bigint generated always as identity primary key,
  payment_id        uuid not null references payments (id) on delete cascade,
  source            text not null check (source in ('checkout', 'gateway_response', 'status_check', 'webhook', 'expiry')),
  gateway_event_id  text check (gateway_event_id is null or char_length(gateway_event_id) between 1 and 200),
  from_status       text not null,
  to_status         text not null,
  outcome           text not null check (outcome in ('applied', 'unchanged', 'rejected')),
  detail            text check (detail is null or detail ~ '^[a-z][a-z0-9_]{1,40}$'),
  created_at        timestamptz not null default now()
);

-- Replay guard: an accepted gateway event is applied once.
create unique index if not exists payment_events_once on payment_events (payment_id, gateway_event_id)
  where gateway_event_id is not null and outcome <> 'rejected';
create index if not exists payment_events_payment_idx on payment_events (payment_id, id);

alter table payments       enable row level security;
alter table payment_events enable row level security;
revoke all on payments, payment_events from public, anon, authenticated, service_role;

-- A customer sees the payments of orders they can see (their own; 0004).
drop policy if exists payments_own_read on payments;
create policy payments_own_read on payments
  for select to authenticated
  using (exists (select 1 from orders o where o.id = payments.order_id));
grant select (order_id, method, wallet_provider, reference, gateway_reference, status, amount_minor, currency,
              created_at, completed_at)
  on payments to authenticated;

-- ---------------------------------------------------------------- rules --

create or replace function payment_next_statuses(p_status text)
returns text[]
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_status
    when 'not_initiated' then array['pending', 'processing', 'successful', 'failed', 'cancelled', 'expired']
    when 'pending'       then array['processing', 'successful', 'failed', 'cancelled', 'expired']
    when 'processing'    then array['successful', 'failed', 'cancelled', 'expired']
    when 'successful'    then array['refunded']
    else array[]::text[]
  end
$$;

create or replace function payment_summary(p payments)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'reference', p.reference, 'status', p.status, 'method', p.method, 'gateway', p.gateway,
    'wallet_provider', p.wallet_provider, 'gateway_reference', p.gateway_reference,
    'amount_minor', p.amount_minor, 'currency', p.currency, 'expires_at', p.expires_at,
    'created_at', p.created_at, 'completed_at', p.completed_at)
$$;

-- --------------------------------------------------------- start a payment --

-- Opens a payment for an order that waits for an online payment. Returns
--   {"ok": true, "replayed": bool, "payment": {...}}
--   {"ok": false, "code": "invalid_request" | "not_found" | "idempotency_conflict"
--                        | "method_mismatch" | "not_payable" | "already_paid"}
--   {"ok": false, "code": "payment_in_progress", "payment": {...}}
-- The same idempotency key again returns the same payment.
create or replace function payment_start(
  p_country          char(2),
  p_order_number     text,
  p_method           text,
  p_gateway          text,
  p_wallet_provider  text,
  p_payer_phone      text,
  p_idempotency_key  uuid,
  p_expires_at       timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order    orders%rowtype;
  v_payment  payments%rowtype;
  v_ref      text;
begin
  if p_idempotency_key is null or p_expires_at is null or p_expires_at <= now()
     or p_method is null or p_method not in ('mobile_money', 'card', 'bank_transfer')
     or p_gateway is null or p_gateway !~ '^[a-z][a-z0-9_]{1,31}$'
     or (p_method = 'mobile_money' and (p_wallet_provider is null or p_payer_phone is null))
     or (p_wallet_provider is not null and p_wallet_provider !~ '^[a-z][a-z0-9_]{1,31}$')
     or (p_payer_phone is not null and p_payer_phone !~ '^\+[0-9]{9,15}$')
  then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;

  select * into v_order from orders o
   where o.country_code = p_country and o.order_number = upper(btrim(p_order_number))
     for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  select * into v_payment from payments p where p.idempotency_key = p_idempotency_key;
  if found then
    if v_payment.order_id <> v_order.id or v_payment.method <> p_method or v_payment.gateway <> p_gateway then
      return jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    end if;
    return jsonb_build_object('ok', true, 'replayed', true, 'payment', payment_summary(v_payment));
  end if;

  if v_order.payment_method <> p_method then
    return jsonb_build_object('ok', false, 'code', 'method_mismatch');
  end if;
  if exists (select 1 from payments p where p.order_id = v_order.id and p.status in ('successful', 'refunded'))
     or v_order.payment_status in ('paid', 'refunded') then
    return jsonb_build_object('ok', false, 'code', 'already_paid');
  end if;
  if v_order.status <> 'pending_payment' or v_order.total_minor <= 0 then
    return jsonb_build_object('ok', false, 'code', 'not_payable');
  end if;

  select * into v_payment from payments p
   where p.order_id = v_order.id and p.status in ('not_initiated', 'pending', 'processing');
  if found then
    return jsonb_build_object('ok', false, 'code', 'payment_in_progress', 'payment', payment_summary(v_payment));
  end if;

  loop
    v_ref := p_country || 'P-' || upper(substr(md5(gen_random_uuid()::text), 1, 12));
    exit when not exists (select 1 from payments p where p.reference = v_ref);
  end loop;

  insert into payments (order_id, country_code, method, gateway, wallet_provider, payer_phone, reference,
                        amount_minor, currency, idempotency_key, expires_at)
  values (v_order.id, v_order.country_code, p_method, p_gateway, p_wallet_provider, p_payer_phone, v_ref,
          v_order.total_minor, v_order.currency, p_idempotency_key, p_expires_at)
  returning * into v_payment;

  -- A new attempt after a failed one: the order is waiting again.
  update orders set payment_status = 'pending' where id = v_order.id and payment_status = 'failed';

  insert into payment_events (payment_id, source, from_status, to_status, outcome, detail)
  values (v_payment.id, 'checkout', 'not_initiated', 'not_initiated', 'applied', 'created');

  return jsonb_build_object('ok', true, 'replayed', false, 'payment', payment_summary(v_payment));
end
$$;

-- ------------------------------------------------- apply a gateway answer --

-- Applies what the gateway said about a payment: its answer to the
-- initiation, a status check, or a webhook whose signature the server has
-- already verified. Returns
--   {"ok": true, "changed": bool, "replayed": bool, "payment": {...},
--    "order_status": text, "order_payment_status": text, "notice": text|null}
--   {"ok": false, "code": "invalid_request" | "not_found"}
--   {"ok": false, "code": "gateway_mismatch" | "amount_mismatch" | "amount_missing"
--                        | "reference_mismatch" | "invalid_transition", "status": current}
-- A refusal is recorded in payment_events and changes nothing else.
create or replace function payment_apply_update(
  p_reference          text,
  p_gateway            text,
  p_source             text,
  p_gateway_event_id   text,
  p_status             text,
  p_gateway_reference  text,
  p_amount_minor       bigint,
  p_currency           text,
  p_failure_code       text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id  uuid;
  v_order     orders%rowtype;
  v_payment   payments%rowtype;
  v_refusal   text;
  v_notice    text;
  v_from      text;
  v_failure   text := nullif(btrim(coalesce(p_failure_code, '')), '');
begin
  if p_reference is null or p_gateway is null or p_status is null
     or p_source not in ('gateway_response', 'status_check', 'webhook')
     or p_status not in ('pending', 'processing', 'successful', 'failed', 'cancelled', 'expired', 'refunded')
     or char_length(coalesce(p_gateway_event_id, 'x')) not between 1 and 200
     or char_length(coalesce(p_gateway_reference, 'x')) not between 1 and 100
     or (v_failure is not null and v_failure !~ '^[a-z][a-z0-9_]{1,40}$')
  then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;

  -- Lock the order first, then the payment, in the same order as payment_start.
  select p.order_id into v_order_id from payments p where p.reference = p_reference;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  select * into v_order from orders o where o.id = v_order_id for update;
  select * into v_payment from payments p where p.reference = p_reference for update;

  if p_gateway_event_id is not null and exists (
       select 1 from payment_events e
        where e.payment_id = v_payment.id and e.gateway_event_id = p_gateway_event_id and e.outcome <> 'rejected') then
    return jsonb_build_object('ok', true, 'changed', false, 'replayed', true, 'payment', payment_summary(v_payment),
                              'order_status', v_order.status, 'order_payment_status', v_order.payment_status, 'notice', null);
  end if;

  v_refusal := case
    when p_gateway <> v_payment.gateway then 'gateway_mismatch'
    when (p_amount_minor is not null and p_amount_minor <> v_payment.amount_minor)
      or (p_currency is not null and upper(p_currency) <> v_payment.currency) then 'amount_mismatch'
    when p_status in ('successful', 'refunded') and (p_amount_minor is null or p_currency is null) then 'amount_missing'
    when p_gateway_reference is not null and v_payment.gateway_reference is not null
      and p_gateway_reference <> v_payment.gateway_reference then 'reference_mismatch'
    -- The gateway's id of another payment never settles this one.
    when p_gateway_reference is not null and exists (
           select 1 from payments q
            where q.gateway = v_payment.gateway and q.gateway_reference = p_gateway_reference and q.id <> v_payment.id)
      then 'reference_mismatch'
    when p_status <> v_payment.status and not (p_status = any (payment_next_statuses(v_payment.status))) then 'invalid_transition'
    else null
  end;

  if v_refusal is not null then
    insert into payment_events (payment_id, source, gateway_event_id, from_status, to_status, outcome, detail)
    values (v_payment.id, p_source, p_gateway_event_id, v_payment.status, p_status, 'rejected', v_refusal);
    return jsonb_build_object('ok', false, 'code', v_refusal, 'status', v_payment.status);
  end if;

  if p_status = v_payment.status then
    update payments set gateway_reference = coalesce(gateway_reference, p_gateway_reference), updated_at = now()
     where id = v_payment.id and gateway_reference is null and p_gateway_reference is not null;
    insert into payment_events (payment_id, source, gateway_event_id, from_status, to_status, outcome)
    values (v_payment.id, p_source, p_gateway_event_id, v_payment.status, p_status, 'unchanged');
    select * into v_payment from payments p where p.id = v_payment.id;
    return jsonb_build_object('ok', true, 'changed', false, 'replayed', false, 'payment', payment_summary(v_payment),
                              'order_status', v_order.status, 'order_payment_status', v_order.payment_status, 'notice', null);
  end if;

  v_from := v_payment.status;
  update payments
     set status = p_status,
         gateway_reference = coalesce(gateway_reference, p_gateway_reference),
         failure_code = case when p_status in ('failed', 'cancelled', 'expired') then v_failure else failure_code end,
         updated_at = now(),
         completed_at = case when p_status in ('successful', 'failed', 'cancelled', 'expired', 'refunded') then now() else completed_at end
   where id = v_payment.id
  returning * into v_payment;

  if p_status = 'successful' then
    update orders
       set payment_status = 'paid',
           status = case when status = 'pending_payment' then 'confirmed' else status end
     where id = v_order.id
    returning * into v_order;
    -- Paid for an order that was cancelled meanwhile: the money must go back.
    if v_order.status = 'cancelled' then
      v_notice := 'order_cancelled_refund_needed';
    end if;
  elsif p_status = 'refunded' then
    update orders set payment_status = 'refunded' where id = v_order.id returning * into v_order;
  elsif p_status in ('failed', 'cancelled', 'expired') then
    update orders set payment_status = 'failed' where id = v_order.id and payment_status = 'pending'
    returning * into v_order;
    if not found then
      select * into v_order from orders o where o.id = v_order_id;
    end if;
  end if;

  insert into payment_events (payment_id, source, gateway_event_id, from_status, to_status, outcome, detail)
  values (v_payment.id, p_source, p_gateway_event_id, v_from, p_status, 'applied', v_notice);

  return jsonb_build_object('ok', true, 'changed', true, 'replayed', false, 'payment', payment_summary(v_payment),
                            'order_status', v_order.status, 'order_payment_status', v_order.payment_status, 'notice', v_notice);
end
$$;

-- ---------------------------------------------------------------- expiry --

-- Expires a payment that is past its time and still waiting. The server
-- calls this only after the gateway's own status check found no payment
-- (a timeout is not proof of failure). Returns
--   {"ok": true, "changed": bool, "payment": {...}} or {"ok": false, "code": "not_found"}
create or replace function payment_expire(p_reference text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id  uuid;
  v_payment   payments%rowtype;
begin
  select p.order_id into v_order_id from payments p where p.reference = p_reference;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  perform 1 from orders o where o.id = v_order_id for update;
  select * into v_payment from payments p where p.reference = p_reference for update;

  if v_payment.status not in ('not_initiated', 'pending') or v_payment.expires_at > now() then
    return jsonb_build_object('ok', true, 'changed', false, 'payment', payment_summary(v_payment));
  end if;

  insert into payment_events (payment_id, source, from_status, to_status, outcome)
  values (v_payment.id, 'expiry', v_payment.status, 'expired', 'applied');
  update payments set status = 'expired', failure_code = 'expired', updated_at = now(), completed_at = now()
   where id = v_payment.id
  returning * into v_payment;
  update orders set payment_status = 'failed' where id = v_order_id and payment_status = 'pending';

  return jsonb_build_object('ok', true, 'changed', true, 'payment', payment_summary(v_payment));
end
$$;

-- Payments of a country that are past their time and still waiting, oldest
-- first, for the reconciliation job.
create or replace function payment_list_due(p_country char(2), p_limit integer)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(d.reference order by d.expires_at), '[]'::jsonb)
    from (select p.reference, p.expires_at from payments p
           where p.country_code = p_country and p.status in ('not_initiated', 'pending') and p.expires_at <= now()
           order by p.expires_at
           limit least(greatest(coalesce(p_limit, 50), 1), 200)) d
$$;

-- One payment by its reference, with its order number, or null.
create or replace function payment_get(p_reference text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select payment_summary(p) || jsonb_build_object('order_number', o.order_number, 'country', p.country_code)
    from payments p
    join orders o on o.id = p.order_id
   where p.reference = p_reference
$$;

-- The payments of one order of the country, newest first.
create or replace function payment_list_for_order(p_country char(2), p_order_number text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(payment_summary(p) order by p.created_at desc), '[]'::jsonb)
    from payments p
    join orders o on o.id = p.order_id
   where o.country_code = p_country and o.order_number = upper(btrim(p_order_number))
$$;

revoke execute on function payment_next_statuses(text) from public, anon, authenticated;
revoke execute on function payment_summary(payments) from public, anon, authenticated;
revoke execute on function payment_start(char, text, text, text, text, text, uuid, timestamptz) from public, anon, authenticated;
revoke execute on function payment_apply_update(text, text, text, text, text, text, bigint, text, text) from public, anon, authenticated;
revoke execute on function payment_expire(text) from public, anon, authenticated;
revoke execute on function payment_list_due(char, integer) from public, anon, authenticated;
revoke execute on function payment_list_for_order(char, text) from public, anon, authenticated;
revoke execute on function payment_get(text) from public, anon, authenticated;
grant execute on function payment_get(text) to service_role;

grant execute on function payment_start(char, text, text, text, text, text, uuid, timestamptz) to service_role;
grant execute on function payment_apply_update(text, text, text, text, text, text, bigint, text, text) to service_role;
grant execute on function payment_expire(text) to service_role;
grant execute on function payment_list_due(char, integer) to service_role;
grant execute on function payment_list_for_order(char, text) to service_role;

commit;
