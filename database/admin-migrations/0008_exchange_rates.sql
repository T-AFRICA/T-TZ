-- 0008_exchange_rates.sql — a US dollar rate per country for the combined reports (DRAFT).
--
-- For the CENTRAL ADMIN Supabase project only. Forward-only. Exercised only
-- against a disposable PGlite database (database/client/tests). Requires
-- 0001. Safe to run again.
--
-- Owner decision 2026-11-23: the Global Combined Reports add the countries
-- up in US dollars at a rate the Master Super Admin types in. No rate
-- service is called and no rate is guessed: a country without a rate keeps
-- its own currency and stays out of the dollar totals.
--
-- Rules:
--   * One rate per country: how many units of the country's currency one
--     US dollar is (2650 for "1 USD = 2,650 TZS").
--   * Master Super Admin only, to read and to change. A change is written
--     to the audit log with the rate before and after.
--   * The rate is kept with the currency it was typed for. If the country's
--     currency is changed later, the old rate no longer applies and reads
--     as "no rate".
--   * The rate is for reports. Nothing is charged, refunded or priced with
--     it, and no order amount is stored in dollars.

begin;

create table if not exists country_exchange_rates (
  country_id     text primary key references countries (id) on delete cascade,
  currency       char(3) not null check (currency ~ '^[A-Z]{3}$'),
  units_per_usd  numeric(20, 6) not null check (units_per_usd > 0 and units_per_usd <= 1000000000),
  set_at         timestamptz not null default now(),
  set_by         uuid references auth.users (id) on delete set null
);

alter table country_exchange_rates enable row level security;
revoke all on country_exchange_rates from public, anon, authenticated, service_role;

-- The rate of every country that has one for its current currency:
-- [{"country_id", "currency", "units_per_usd" (text, exact), "set_at"}].
-- Master Super Admin only; anyone else gets an empty list.
create or replace function list_country_exchange_rates()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select jsonb_agg(jsonb_build_object('country_id', r.country_id, 'currency', r.currency,
                                        'units_per_usd', r.units_per_usd::text, 'set_at', r.set_at)
                     order by c.sort_order, c.id)
      from country_exchange_rates r
      join countries c on c.id = r.country_id and c.currency = r.currency
     where app_private.admin_id() is not null and app_private.is_master()), '[]'::jsonb)
$$;

-- Sets a country's rate. Returns {"ok": true} or
-- {"ok": false, "code": "not_allowed" | "not_found" | "invalid_request"}.
-- "invalid_request": no rate, a rate that is not above zero, or a country
-- whose currency is not known yet.
create or replace function set_country_exchange_rate(p_country text, p_units_per_usd numeric)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor     uuid := app_private.admin_id();
  v_currency  char(3);
  v_before    numeric;
  v_rate      numeric;
begin
  if v_actor is null or not app_private.is_master() then
    if v_actor is not null then
      perform app_private.security_event('permission_denied', left(p_country, 24), jsonb_build_object('operation', 'set_country_exchange_rate'));
    end if;
    return jsonb_build_object('ok', false, 'code', 'not_allowed');
  end if;
  if p_units_per_usd is null or p_units_per_usd <= 0 or p_units_per_usd > 1000000000 then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  select c.currency into v_currency from countries c where c.id = p_country for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_currency is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;

  v_rate := round(p_units_per_usd, 6);
  if v_rate <= 0 then
    return jsonb_build_object('ok', false, 'code', 'invalid_request');
  end if;
  select r.units_per_usd into v_before from country_exchange_rates r where r.country_id = p_country and r.currency = v_currency;

  insert into country_exchange_rates as r (country_id, currency, units_per_usd, set_by)
  values (p_country, v_currency, v_rate, v_actor)
  on conflict (country_id)
  do update set currency = excluded.currency, units_per_usd = excluded.units_per_usd, set_at = now(), set_by = excluded.set_by;

  perform app_private.audit('country.exchange_rate', p_country, 'country', p_country, jsonb_build_object(
    'currency', v_currency, 'before', v_before::text, 'after', v_rate::text));
  return jsonb_build_object('ok', true);
end
$$;

revoke all on function list_country_exchange_rates() from public, anon, authenticated, service_role;
revoke all on function set_country_exchange_rate(text, numeric) from public, anon, authenticated, service_role;
grant execute on function list_country_exchange_rates() to authenticated;
grant execute on function set_country_exchange_rate(text, numeric) to authenticated;

commit;
