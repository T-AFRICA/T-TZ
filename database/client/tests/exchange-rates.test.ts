import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  acceptAdminInvitations,
  inviteAdmin,
  listAuditLog,
  listCountryExchangeRates,
  setCountryExchangeRate,
  updateCountry,
  withAdminAccess,
  type AdminAccess,
} from "../src/admin";
import { createAdminAuthUser, createAdminTestDatabase, type TestDatabase } from "../src/testing";

/**
 * The US dollar rate per country (admin migration 0008) on a disposable
 * PGlite database: who may set and read it, what is refused, that a change
 * is in the audit log, and that a rate typed for one currency does not
 * survive a change of the country's currency.
 */

let t: TestDatabase;
const users: Record<string, string> = {};
const mfa = (name: string): AdminAccess => ({ userId: users[name]!, aal: "aal2" });
const password = (name: string): AdminAccess => ({ userId: users[name]!, aal: "aal1" });

async function onboard(inviter: AdminAccess, name: string, role: string, country: string): Promise<void> {
  users[name] = await createAdminAuthUser(t.db, `${name}@example.test`, true);
  const invited = await inviteAdmin(t.db, inviter, { email: `${name}@example.test`, role, countryId: country });
  expect(invited, `invite ${name}`).toMatchObject({ ok: true });
  expect(await acceptAdminInvitations(t.db, password(name))).toEqual({ ok: true, accepted: 1 });
}

beforeAll(async () => {
  t = await createAdminTestDatabase();
  users.master = await createAdminAuthUser(t.db, "master@example.test", true);
  await t.db.query(`select app_private.provision_master_super_admin('master@example.test')`);
  await onboard(mfa("master"), "tz-super", "country_super_admin", "tz");
  await onboard(mfa("tz-super"), "tz-finance", "finance_viewer", "tz");
}, 60_000);

afterAll(async () => {
  await t.pg.close();
});

describe("a country's US dollar rate", () => {
  it("is set by a Master Super Admin, kept exactly, and replaced by the next one", async () => {
    expect(await listCountryExchangeRates(t.db, mfa("master"))).toEqual([]);
    expect(await setCountryExchangeRate(t.db, mfa("master"), "tz", "2650")).toEqual({ ok: true });
    expect(await setCountryExchangeRate(t.db, mfa("master"), "ke", "129.25")).toEqual({ ok: true });
    expect(await listCountryExchangeRates(t.db, mfa("master"))).toEqual([
      { countryId: "tz", currency: "TZS", unitsPerUsd: "2650.000000", setAt: expect.any(String) },
      { countryId: "ke", currency: "KES", unitsPerUsd: "129.250000", setAt: expect.any(String) },
    ]);

    expect(await setCountryExchangeRate(t.db, mfa("master"), "tz", "2700.5")).toEqual({ ok: true });
    const rates = await listCountryExchangeRates(t.db, mfa("master"));
    expect(rates.find((rate) => rate.countryId === "tz")?.unitsPerUsd).toBe("2700.500000");
    expect(rates).toHaveLength(2);
  });

  it("is written to the audit log with the rate before and after", async () => {
    const log = await listAuditLog(t.db, mfa("master"), { countryId: "tz" });
    const changes = log.entries.filter((entry) => entry.action === "country.exchange_rate");
    expect(changes).toHaveLength(2);
    expect(changes[0]).toMatchObject({ countryId: "tz", summary: { currency: "TZS", before: "2650.000000", after: "2700.500000" } });
    expect(changes[1]).toMatchObject({ summary: { currency: "TZS", before: null, after: "2650.000000" } });
  });

  it("cannot be set or read by anyone else, whatever their role, and the attempt is recorded", async () => {
    for (const who of [mfa("tz-super"), password("tz-finance")]) {
      expect(await setCountryExchangeRate(t.db, who, "tz", "1")).toEqual({ ok: false, code: "not_allowed" });
      expect(await listCountryExchangeRates(t.db, who)).toEqual([]);
    }
    // A Master Super Admin who has not passed the second factor is not one yet.
    expect(await setCountryExchangeRate(t.db, password("master"), "tz", "1")).toEqual({ ok: false, code: "not_allowed" });
    expect(await listCountryExchangeRates(t.db, password("master"))).toEqual([]);
    expect((await listCountryExchangeRates(t.db, mfa("master"))).find((rate) => rate.countryId === "tz")?.unitsPerUsd).toBe("2700.500000");

    const [events] = await t.db.query<{ n: number }>(
      `select count(*)::int as n from security_events where kind = 'permission_denied' and detail ->> 'operation' = 'set_country_exchange_rate'`,
    );
    expect(events?.n).toBeGreaterThanOrEqual(2);
    // The table itself is closed: no direct read or write for a signed-in administrator.
    for (const sql of [`select 1 from country_exchange_rates`, `update country_exchange_rates set units_per_usd = 1`, `delete from country_exchange_rates`]) {
      await expect(withAdminAccess(t.db, mfa("master"), (tx) => tx.query(sql))).rejects.toThrow(/permission denied/);
    }
  });

  it("refuses a rate that is not a plain number above zero, an unknown country, and a country without a currency", async () => {
    for (const rate of ["0", "-5", "abc", "1e9", "1,5", " 12", "12.1234567", "12345678901", "", "0x10", "2650; drop table countries"]) {
      expect(await setCountryExchangeRate(t.db, mfa("master"), "tz", rate), rate).toEqual({ ok: false, code: "invalid_request" });
    }
    expect(await setCountryExchangeRate(t.db, mfa("master"), "tz", "0.0000001")).toEqual({ ok: false, code: "invalid_request" });
    expect(await setCountryExchangeRate(t.db, mfa("master"), "nowhere", "10")).toEqual({ ok: false, code: "not_found" });
    // Congo's currency is not confirmed yet.
    expect(await setCountryExchangeRate(t.db, mfa("master"), "congo", "2800")).toEqual({ ok: false, code: "invalid_request" });
    // Called directly with values the client would not send.
    for (const value of ["null", "0", "-1", "1000000001"]) {
      const [row] = await withAdminAccess(t.db, mfa("master"), (tx) =>
        tx.query<{ result: unknown }>(`select set_country_exchange_rate('tz', ${value}::numeric) as result`),
      );
      const result = typeof row?.result === "string" ? JSON.parse(row.result) : row?.result;
      expect(result, value).toEqual({ ok: false, code: "invalid_request" });
    }
    expect((await listCountryExchangeRates(t.db, mfa("master"))).find((rate) => rate.countryId === "tz")?.unitsPerUsd).toBe("2700.500000");
  });

  it("does not apply after the country's currency changes, until a rate is typed for the new one", async () => {
    expect(await updateCountry(t.db, mfa("master"), "ke", { currency: "USD" })).toEqual({ ok: true });
    expect((await listCountryExchangeRates(t.db, mfa("master"))).map((rate) => rate.countryId)).toEqual(["tz"]);
    expect(await setCountryExchangeRate(t.db, mfa("master"), "ke", "1")).toEqual({ ok: true });
    expect((await listCountryExchangeRates(t.db, mfa("master"))).find((rate) => rate.countryId === "ke")).toMatchObject({ currency: "USD", unitsPerUsd: "1.000000" });
  });
});
