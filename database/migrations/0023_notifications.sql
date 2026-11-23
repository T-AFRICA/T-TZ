-- 0023_notifications.sql — notifications for customers, staff and riders (DRAFT).
--
-- Forward-only, additive. Exercised only against a disposable PGlite
-- database with a Supabase role shim (database/client/tests); applying it
-- to a Supabase project needs owner approval. Requires 0017. Safe to run
-- again.
--
-- Owner request 2026-11-23: the notification sections of the customer
-- site, the Central Admin and the rider's console show what really
-- happened.
--
-- A notification is written by the database when the thing happens (an
-- order placed, a status changed, a delivery given to a rider, a product
-- running low), in the same transaction, so nothing can claim an event that
-- did not take place and no page can create one. It holds what kind of
-- event it was and which order or product it is about: never a name, an
-- address, a phone, a price or the delivery code. The wording is chosen by
-- the application that shows it.
--
-- Nothing here sends an email, an SMS, a WhatsApp message or a push
-- notification: the notifications are read inside the sites.
--
-- Rules:
--   * A customer reads the notifications of their own account only (Row
--     Level Security) and can mark them read, nothing else. Visitors read
--     nothing. A guest order (no account) gets no customer notification.
--   * Staff and riders read theirs only through the signed country API:
--     the two tables below have no grants and no policies, and the
--     functions are executable by service_role only. The administrator is
--     the one named in the signed request, never a value they send.
--   * Three audiences, each behind its own permission: "orders" (orders.read),
--     "inventory" (inventory.read) and "rider" (deliveries.perform, the
--     rider's own). A rider's notification belongs to one rider and no other
--     rider reads it.
--   * An administrator is not told about their own action.
--   * What an administrator has seen is one number per audience (the newest
--     notification seen); it never moves backwards.

begin;

-- --------------------------------------------------------------- customers --

create table if not exists customer_notifications (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  order_id    uuid not null references orders (id) on delete cascade,
  kind        text not null check (kind in ('order_placed', 'confirmed', 'processing', 'packed', 'dispatched',
                                            'in_transit', 'delivered', 'cancelled', 'delivery_attempt',
                                            'payment_received', 'payment_failed', 'refunded')),
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);

create index if not exists customer_notifications_user_idx on customer_notifications (user_id, id desc);
create index if not exists customer_notifications_unread_idx on customer_notifications (user_id) where read_at is null;

alter table customer_notifications enable row level security;

drop policy if exists customer_notifications_own_read on customer_notifications;
create policy customer_notifications_own_read on customer_notifications
  for select to authenticated using (user_id = auth.uid());

-- Read only: the rows are written by the triggers below and marked read by
-- customer_mark_notifications_read.
revoke all on customer_notifications from public, anon, authenticated, service_role;
grant select on customer_notifications to authenticated;

-- Marks the signed-in customer's notifications read: one (p_id) or all of
-- them (null). Returns how many changed; 0 for a visitor or for a
-- notification of another account.
create or replace function customer_mark_notifications_read(p_id bigint)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user   uuid := auth.uid();
  v_count  integer;
begin
  if v_user is null then
    return 0;
  end if;
  update customer_notifications n
     set read_at = now()
   where n.user_id = v_user and n.read_at is null and (p_id is null or n.id = p_id);
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

-- ------------------------------------------------------- staff and riders --

-- The actor is the administrator whose action caused the event (their id in
-- the Central Admin, no foreign key: they are not users of this database);
-- null when a customer or the system caused it.
create table if not exists staff_notifications (
  id            bigint generated always as identity primary key,
  country_code  char(2) not null references countries (code),
  audience      text not null check (audience in ('orders', 'inventory', 'rider')),
  rider_id      uuid,
  kind          text not null check (kind in ('order_placed', 'order_cancelled', 'order_delivered', 'delivery_failed',
                                              'stock_low', 'stock_out',
                                              'delivery_assigned', 'delivery_reassigned', 'delivery_cancelled')),
  order_id      uuid references orders (id) on delete cascade,
  product_id    uuid references products (id) on delete cascade,
  actor_id      uuid,
  created_at    timestamptz not null default now(),
  constraint staff_notifications_rider_check check ((audience = 'rider') = (rider_id is not null)),
  constraint staff_notifications_subject_check check ((order_id is null) <> (product_id is null))
);

create index if not exists staff_notifications_audience_idx on staff_notifications (country_code, audience, id desc);
create index if not exists staff_notifications_rider_idx on staff_notifications (rider_id, id desc) where rider_id is not null;

-- The newest notification an administrator has seen, per audience.
create table if not exists staff_notification_reads (
  actor_id      uuid not null,
  country_code  char(2) not null references countries (code),
  audience      text not null check (audience in ('orders', 'inventory', 'rider')),
  seen_id       bigint not null check (seen_id >= 0),
  updated_at    timestamptz not null default now(),
  primary key (actor_id, country_code, audience)
);

alter table staff_notifications      enable row level security;
alter table staff_notification_reads enable row level security;
revoke all on staff_notifications, staff_notification_reads from public, anon, authenticated, service_role;

-- ----------------------------------------------------------------- events --

-- A new order: the customer's confirmation, and the staff who handle orders.
create or replace function notify_order_placed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.user_id is not null then
    insert into customer_notifications (user_id, order_id, kind) values (new.user_id, new.id, 'order_placed');
  end if;
  insert into staff_notifications (country_code, audience, kind, order_id)
  values (new.country_code, 'orders', 'order_placed', new.id);
  return null;
end
$$;

drop trigger if exists orders_notify_placed on orders;
create trigger orders_notify_placed
  after insert on orders
  for each row execute function notify_order_placed();

-- The customer follows their order: every status it reaches, and what
-- happened to an online payment. Cash on Delivery is paid at the door, so
-- "delivered" already says it.
create or replace function notify_order_changed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.user_id is null then
    return null;
  end if;
  if new.status is distinct from old.status and new.status <> 'pending_payment' then
    insert into customer_notifications (user_id, order_id, kind) values (new.user_id, new.id, new.status);
  end if;
  if new.payment_status is distinct from old.payment_status then
    if new.payment_status = 'paid' and new.payment_method <> 'pay_on_delivery' then
      insert into customer_notifications (user_id, order_id, kind) values (new.user_id, new.id, 'payment_received');
    elsif new.payment_status = 'refunded' then
      insert into customer_notifications (user_id, order_id, kind) values (new.user_id, new.id, 'refunded');
    elsif new.payment_status = 'failed' then
      insert into customer_notifications (user_id, order_id, kind) values (new.user_id, new.id, 'payment_failed');
    end if;
  end if;
  return null;
end
$$;

drop trigger if exists orders_notify_changed on orders;
create trigger orders_notify_changed
  after update of status, payment_status on orders
  for each row execute function notify_order_changed();

-- Staff hear about a cancellation and a completed delivery, with who did
-- it; the rider holding a cancelled order is told not to go.
create or replace function notify_order_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_country  char(2);
  v_rider    uuid;
begin
  if new.to_status not in ('cancelled', 'delivered') then
    return null;
  end if;
  select o.country_code into v_country from orders o where o.id = new.order_id;
  insert into staff_notifications (country_code, audience, kind, order_id, actor_id)
  values (v_country, 'orders',
          case new.to_status when 'cancelled' then 'order_cancelled' else 'order_delivered' end,
          new.order_id, new.actor_id);
  if new.to_status = 'cancelled' then
    select d.rider_id into v_rider from deliveries d where d.order_id = new.order_id;
    if v_rider is not null then
      insert into staff_notifications (country_code, audience, rider_id, kind, order_id, actor_id)
      values (v_country, 'rider', v_rider, 'delivery_cancelled', new.order_id, new.actor_id);
    end if;
  end if;
  return null;
end
$$;

drop trigger if exists order_status_events_notify on order_status_events;
create trigger order_status_events_notify
  after insert on order_status_events
  for each row execute function notify_order_event();

-- A delivery given to a rider, or moved to another rider before pickup.
create or replace function notify_delivery_assigned()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_country  char(2);
begin
  if tg_op = 'UPDATE' then
    if new.rider_id = old.rider_id then
      return null;
    end if;
  end if;
  select o.country_code into v_country from orders o where o.id = new.order_id;
  insert into staff_notifications (country_code, audience, rider_id, kind, order_id, actor_id)
  values (v_country, 'rider', new.rider_id, 'delivery_assigned', new.order_id, new.assigned_by);
  if tg_op = 'UPDATE' then
    insert into staff_notifications (country_code, audience, rider_id, kind, order_id, actor_id)
    values (v_country, 'rider', old.rider_id, 'delivery_reassigned', new.order_id, new.assigned_by);
  end if;
  return null;
end
$$;

drop trigger if exists deliveries_notify_assigned on deliveries;
create trigger deliveries_notify_assigned
  after insert or update of rider_id on deliveries
  for each row execute function notify_delivery_assigned();

-- A delivery attempt that failed: staff decide what happens next, and the
-- customer learns that the rider came.
create or replace function notify_delivery_attempt()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_country  char(2);
  v_user     uuid;
begin
  select o.country_code, o.user_id into v_country, v_user from orders o where o.id = new.order_id;
  insert into staff_notifications (country_code, audience, kind, order_id, actor_id)
  values (v_country, 'orders', 'delivery_failed', new.order_id, new.actor_id);
  if v_user is not null then
    insert into customer_notifications (user_id, order_id, kind) values (v_user, new.order_id, 'delivery_attempt');
  end if;
  return null;
end
$$;

drop trigger if exists delivery_attempts_notify on delivery_attempts;
create trigger delivery_attempts_notify
  after insert on delivery_attempts
  for each row execute function notify_delivery_attempt();

-- Stock that runs out, or falls to the product's low-stock level (0017).
-- Told once, when the line is crossed, not for every unit sold below it.
create or replace function notify_stock_level()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_kind  text;
begin
  if new.available = 0 and old.available > 0 then
    v_kind := 'stock_out';
  elsif new.available > 0 and new.available <= new.low_stock_at and old.available > old.low_stock_at then
    v_kind := 'stock_low';
  else
    return null;
  end if;
  insert into staff_notifications (country_code, audience, kind, product_id)
  values (new.country_code, 'inventory', v_kind, new.product_id);
  return null;
end
$$;

drop trigger if exists stock_levels_notify on stock_levels;
create trigger stock_levels_notify
  after update of available on stock_levels
  for each row execute function notify_stock_level();

-- ------------------------------------------------------------ staff reads --

-- The newest notifications of one audience for one administrator (30 days,
-- at most 50), with how many are newer than what they have seen. Null for
-- an audience that does not exist.
create or replace function admin_list_notifications(p_country char(2), p_audience text, p_actor uuid, p_limit integer)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with seen as (
    select coalesce((select r.seen_id from staff_notification_reads r
                      where r.actor_id = p_actor and r.country_code = p_country and r.audience = p_audience), 0) as id
  ),
  mine as (
    select n.id, n.kind, n.created_at, n.order_id, n.product_id
      from staff_notifications n
     where n.country_code = p_country
       and n.audience = p_audience
       and n.created_at > now() - interval '30 days'
       and case when p_audience = 'rider' then n.rider_id = p_actor else n.actor_id is distinct from p_actor end
  )
  select jsonb_build_object(
    'seen_id', (select s.id from seen s),
    'unread', (select count(*) from mine m where m.id > (select s.id from seen s)),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'kind', p.kind, 'created_at', p.created_at,
               'order_number', (select o.order_number from orders o where o.id = p.order_id),
               'product_slug', pr.slug, 'product_name', pr.name,
               'unread', p.id > (select s.id from seen s))
             order by p.id desc)
        from (select * from mine m order by m.id desc limit least(greatest(coalesce(p_limit, 30), 1), 50)) p
        left join products pr on pr.id = p.product_id), '[]'::jsonb))
   where p_actor is not null and p_audience in ('orders', 'inventory', 'rider')
$$;

-- Records that the administrator has seen their notifications up to
-- p_through (an id their list showed). Never beyond the newest notification
-- they may read, and never backwards. Returns {"ok": true, "seen_id"} or
-- {"ok": false, "code": "invalid_request"}.
create or replace function admin_mark_notifications_seen(p_country char(2), p_audience text, p_actor uuid, p_through bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_newest  bigint;
  v_seen    bigint;
begin
  if p_actor is null or p_through is null or p_through < 0
     or p_audience is null or p_audience not in ('orders', 'inventory', 'rider') then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  select coalesce(max(n.id), 0) into v_newest
    from staff_notifications n
   where n.country_code = p_country
     and n.audience = p_audience
     and case when p_audience = 'rider' then n.rider_id = p_actor else true end;
  insert into staff_notification_reads as r (actor_id, country_code, audience, seen_id)
  values (p_actor, p_country, p_audience, least(p_through, v_newest))
  on conflict (actor_id, country_code, audience)
  do update set seen_id = greatest(r.seen_id, excluded.seen_id), updated_at = now()
  returning r.seen_id into v_seen;
  return jsonb_build_object('ok', true, 'seen_id', v_seen);
end
$$;

-- ----------------------------------------------------------------- grants --

revoke execute on function notify_order_placed() from public, anon, authenticated;
revoke execute on function notify_order_changed() from public, anon, authenticated;
revoke execute on function notify_order_event() from public, anon, authenticated;
revoke execute on function notify_delivery_assigned() from public, anon, authenticated;
revoke execute on function notify_delivery_attempt() from public, anon, authenticated;
revoke execute on function notify_stock_level() from public, anon, authenticated;
revoke execute on function admin_list_notifications(char, text, uuid, integer) from public, anon, authenticated;
revoke execute on function admin_mark_notifications_seen(char, text, uuid, bigint) from public, anon, authenticated;
revoke execute on function customer_mark_notifications_read(bigint) from public, anon;

grant execute on function admin_list_notifications(char, text, uuid, integer) to service_role;
grant execute on function admin_mark_notifications_seen(char, text, uuid, bigint) to service_role;
grant execute on function customer_mark_notifications_read(bigint) to authenticated;

commit;
