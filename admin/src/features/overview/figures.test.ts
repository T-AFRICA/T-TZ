import { describe, expect, it, vi } from "vitest";
import type { CountryApiResult, CountrySummary } from "@tronic/api-contracts";
import type { Actor } from "@tronic/permissions";
import { addFigures, collectFigures, noFiguresReason, type FigureCountry } from "./figures";

/**
 * The Overview's business figures: who is asked, what is added up, what is
 * never added up, and what a country that cannot be read does to the page.
 */

const tz: FigureCountry = { id: "tz", name: "Tanzania", isoCode: "TZ" };
const ke: FigureCountry = { id: "ke", name: "Kenya", isoCode: "KE" };
const ug: FigureCountry = { id: "ug", name: "Uganda", isoCode: "UG" };

const summary = (overrides: Partial<CountrySummary> = {}): CountrySummary => ({
  ok: true,
  currency: "TZS",
  currencyExponent: 2,
  ordersTotal: 40,
  ordersToday: 3,
  ordersOpen: 7,
  ordersByStatus: { pending_payment: 2, delivered: 30, cancelled: 3 },
  sales30DaysMinor: 5_600_000,
  customerAccounts: 120,
  productsActive: 28,
  productsOutOfStock: 1,
  productsLowStock: 4,
  lowStockThreshold: 5,
  ...overrides,
});

const answer = (data: CountrySummary): CountryApiResult<CountrySummary> => ({ available: true, data, statusCode: 200, latencyMs: 12 });
const refusal = (reason: "not_configured" | "timeout" | "rejected" | "no_iso_code"): CountryApiResult<CountrySummary> => ({ available: false, reason, statusCode: null, latencyMs: null });

const actor = (assignments: Actor["assignments"], overrides: Partial<Actor> = {}): Actor => ({ userId: "user-1", status: "active", assignments, mfaVerified: true, ...overrides });
const master = actor([{ role: "master_super_admin", countryId: null }]);

describe("who is asked", () => {
  it("asks only the countries the administrator holds reports.read in", async () => {
    // Reports in Tanzania (Finance viewer); orders only in Kenya (Order Manager has no reports.read).
    const mixed = actor([
      { role: "finance_viewer", countryId: "tz" },
      { role: "order_manager", countryId: "ke" },
    ]);
    const ask = vi.fn(async () => answer(summary()));
    const results = await collectFigures(mixed, [tz, ke], ask);
    expect(ask).toHaveBeenCalledTimes(1);
    expect(ask).toHaveBeenCalledWith(tz);
    expect(results.map((result) => [result.country.id, result.state])).toEqual([
      ["tz", "counted"],
      ["ke", "not_permitted"],
    ]);
  });

  it("asks nothing for a suspended administrator, one without a second factor, or a country they have no role in", async () => {
    const ask = vi.fn(async () => answer(summary()));
    const suspended = actor([{ role: "finance_viewer", countryId: "tz" }], { status: "suspended" });
    const noSecondFactor = actor([{ role: "master_super_admin", countryId: null }], { mfaVerified: false });
    const elsewhere = actor([{ role: "finance_viewer", countryId: "tz" }]);
    for (const [who, countries] of [
      [suspended, [tz]],
      [noSecondFactor, [tz, ke]],
      [elsewhere, [ke, ug]],
    ] as const) {
      const results = await collectFigures(who, countries, ask);
      expect(results.every((result) => result.state === "not_permitted")).toBe(true);
    }
    expect(ask).not.toHaveBeenCalled();
  });

  it("asks every country for a Master Super Admin, and one that fails does not stop the others", async () => {
    const ask = vi.fn(async (country: FigureCountry) => {
      if (country.id === "ke") return refusal("timeout");
      if (country.id === "ug") throw new Error("socket hang up");
      return answer(summary());
    });
    const results = await collectFigures(master, [tz, ke, ug], ask);
    expect(ask).toHaveBeenCalledTimes(3);
    expect(results).toMatchObject([
      { country: tz, state: "counted" },
      { country: ke, state: "unavailable", reason: "timeout" },
      { country: ug, state: "unavailable", reason: "unreachable" },
    ]);
  });
});

describe("what is added up", () => {
  it("adds counts as they are and keeps each country's sales in its own currency", () => {
    const figures = addFigures([
      { country: tz, state: "counted", summary: summary() },
      { country: ke, state: "counted", summary: summary({ currency: "KES", ordersTotal: 10, ordersToday: 1, ordersOpen: 2, ordersByStatus: {}, sales30DaysMinor: 1_250_000, customerAccounts: 30, productsActive: 12, productsOutOfStock: 0, productsLowStock: 2 }) },
      { country: ug, state: "unavailable", reason: "not_configured" },
    ]);
    expect(figures).toMatchObject({ countries: 3, counted: 2, productsOnSale: 40, customers: 150, orders: 50, ordersToday: 4, ordersOpen: 9, ordersAwaiting: 2, outOfStock: 1, lowStock: 6 });
    // Two currencies, two lines: nothing on the object is their sum.
    expect(figures.sales).toEqual([
      { id: "tz", name: "Tanzania", isoCode: "TZ", currency: "TZS", exponent: 2, minor: 5_600_000 },
      { id: "ke", name: "Kenya", isoCode: "KE", currency: "KES", exponent: 2, minor: 1_250_000 },
    ]);
    expect(Object.values(figures)).not.toContain(5_600_000 + 1_250_000);
    expect(figures.leftOut).toMatchObject([{ country: ug, state: "unavailable", reason: "not_configured" }]);
  });

  it("counts nothing from a country that did not answer, and says so", () => {
    const figures = addFigures([
      { country: tz, state: "unavailable", reason: "timeout" },
      { country: ke, state: "not_permitted" },
    ]);
    expect(figures).toMatchObject({ countries: 2, counted: 0, orders: 0, customers: 0, sales: [] });
    expect(figures.leftOut).toHaveLength(2);
  });
});

describe("why there are no figures", () => {
  it("tells no role, not connected and a failed connection apart", () => {
    expect(noFiguresReason(addFigures([]))).toBe("no_countries");
    expect(noFiguresReason(addFigures([{ country: tz, state: "not_permitted" }]))).toBe("not_permitted");
    expect(
      noFiguresReason(
        addFigures([
          { country: tz, state: "unavailable", reason: "not_configured" },
          { country: ke, state: "unavailable", reason: "no_iso_code" },
          { country: ug, state: "not_permitted" },
        ]),
      ),
    ).toBe("not_connected");
    // A country that is set up and still gave nothing is a failure, never "not connected yet".
    expect(
      noFiguresReason(
        addFigures([
          { country: tz, state: "unavailable", reason: "rejected" },
          { country: ke, state: "unavailable", reason: "not_configured" },
        ]),
      ),
    ).toBe("failed");
  });
});
