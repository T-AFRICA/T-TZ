import { describe, expect, it } from "vitest";
import type { OrdersReport, ProductsReport, SalesReport, StockReport } from "@tronic/api-contracts";
import { combine, growthPercent, sortRows, statusGroupsOf, toUsdCents, type CountryInput } from "./combine";
import { globalReportCsv } from "./csv";
import { globalHref, readGlobalQuery, signedPercent, usd, usdShort } from "./query";
import { CONNECTION_LABEL, connectionOf } from "./states";

/**
 * The combined report's arithmetic: what is added up, what is converted at
 * which rate, what is left out, and what a hostile address or product name
 * cannot do.
 */

const sales = (currency: string, exponent: number, days: [placed: number, paidOrders: number, paidMinor: number, cancelled: number][], open = 0): SalesReport => ({
  ok: true,
  currency,
  currencyExponent: exponent,
  days: days.map(([placed, paidOrders, paidMinor, cancelled], index) => ({ day: `2026-11-${String(index + 1).padStart(2, "0")}`, placed, paidOrders, paidMinor, cancelled })),
  totals: {
    placed: days.reduce((sum, day) => sum + day[0], 0),
    paidOrders: days.reduce((sum, day) => sum + day[1], 0),
    paidMinor: days.reduce((sum, day) => sum + day[2], 0),
    cancelled: days.reduce((sum, day) => sum + day[3], 0),
    open,
  },
  byPayment: [],
});
const orders = (currency: string, exponent: number, delivered: number, placed: number): OrdersReport => ({ ok: true, currency, currencyExponent: exponent, placed, byStatus: { delivered }, byRegion: [], riders: [] });
const products = (currency: string, exponent: number, items: [slug: string, name: string, sku: string, units: number, amountMinor: number][], categories: [slug: string, name: string, units: number, amountMinor: number][]): ProductsReport => ({
  ok: true,
  currency,
  currencyExponent: exponent,
  paidMinor: items.reduce((sum, item) => sum + item[4], 0),
  units: items.reduce((sum, item) => sum + item[3], 0),
  products: items.map(([slug, name, sku, units, amountMinor]) => ({ slug, name, sku, units, amountMinor })),
  categories: categories.map(([slug, name, units, amountMinor]) => ({ slug, name, units, amountMinor })),
});
const stock = (currency: string, exponent: number, attention: [slug: string, available: number][]): StockReport => ({
  ok: true,
  currency,
  currencyExponent: exponent,
  products: 10,
  out: attention.filter((item) => item[1] === 0).length,
  low: attention.filter((item) => item[1] > 0).length,
  units: 100,
  valueMinor: 0,
  movements: [],
  attention: attention.map(([slug, available]) => ({ slug, name: slug, sku: slug.toUpperCase(), available, lowStockAt: 5, live: true })),
});

/** Tanzania: TZS has no minor unit here (exponent 0). 2,650 TZS = 1 USD. */
const tanzania: CountryInput = {
  id: "tz",
  name: "Tanzania",
  isoCode: "TZ",
  status: "active",
  currency: "TZS",
  rate: { unitsPerUsd: 2650, setAt: "2026-11-23T08:00:00.000Z" },
  unavailable: null,
  data: {
    sales: sales("TZS", 0, [[4, 2, 5_300_000, 1], [6, 4, 7_950_000, 0]], 3),
    previous: sales("TZS", 0, [[5, 4, 10_600_000, 0]]),
    orders: orders("TZS", 0, 6, 10),
    products: products("TZS", 0, [["led-panel", "LED Panel 24W", "LED-PL24", 30, 9_275_000], ["top-plug", "13A Top Plug", "PLG-13", 50, 3_975_000]], [["lighting", "Lighting", 30, 9_275_000], ["switches", "Switches & Sockets", 50, 3_975_000]]),
    stock: stock("TZS", 0, [["led-panel", 0]]),
    customers: 120,
  },
};
/** Kenya: KES in cents (exponent 2). 132.5 KES = 1 USD. */
const kenya: CountryInput = {
  id: "ke",
  name: "Kenya",
  isoCode: "KE",
  status: "planned",
  currency: "KES",
  rate: { unitsPerUsd: 132.5, setAt: "2026-11-23T08:00:00.000Z" },
  unavailable: null,
  data: {
    sales: sales("KES", 2, [[3, 2, 26_500_000, 1]], 0),
    previous: sales("KES", 2, [[2, 1, 13_250_000, 0]]),
    orders: orders("KES", 2, 2, 3),
    products: products("KES", 2, [["led-panel-ke", "LED Panel 24W", "led-pl24", 10, 26_500_000]], [["lighting", "Lighting", 10, 26_500_000]]),
    stock: stock("KES", 2, []),
    customers: 40,
  },
};
const uganda: CountryInput = { id: "ug", name: "Uganda", isoCode: "UG", status: "planned", currency: "UGX", rate: null, unavailable: "not_configured", data: null };

describe("money", () => {
  it("converts a country's minor units to US cents at that country's rate", () => {
    expect(toUsdCents(13_250_000, 0, 2650)).toBe(500_000);
    expect(toUsdCents(26_500_000, 2, 132.5)).toBe(200_000);
    expect(toUsdCents(1, 0, 2650)).toBe(0);
    // No rate, a zero rate or a broken amount is never a number that looks real.
    expect([toUsdCents(100, 0, 0), toUsdCents(100, 0, -5), toUsdCents(Number.NaN, 0, 10), toUsdCents(100, 0, Number.NaN)]).toEqual([0, 0, 0, 0]);
  });

  it("compares with the period before only when there was something before", () => {
    expect(growthPercent(150, 100)).toBe(50);
    expect(growthPercent(50, 100)).toBe(-50);
    expect([growthPercent(10, 0), growthPercent(10, null), growthPercent(10, undefined)]).toEqual([null, null, null]);
  });

  it("writes dollars and changes with their sign in the text", () => {
    expect(usd(123_456)).toBe("$1,234.56");
    expect([usdShort(176_000_000), usdShort(82_450_000), usdShort(95_000)]).toEqual(["$1.76M", "$824.5K", "$950"]);
    expect([signedPercent(8.44), signedPercent(-3), signedPercent(0)]).toEqual(["+8.4%", "−3.0%", "+0.0%"]);
  });
});

describe("combining the countries", () => {
  const combined = combine([tanzania, kenya, uganda]);
  const row = (id: string) => combined.rows.find((candidate) => candidate.id === id)!;

  it("adds up counts as they are and money only through each country's own rate", () => {
    expect(combined.totals).toMatchObject({ countries: 3, connected: 2, active: 1, orders: 13, paidOrders: 8, customers: 160, delivered: 8, pending: 3, cancelled: 2 });
    // Tanzania 13,250,000 TZS = $5,000.00; Kenya 265,000.00 KES = $2,000.00.
    expect(row("tz").salesUsdCents).toBe(500_000);
    expect(row("ke").salesUsdCents).toBe(200_000);
    expect(combined.totals.salesUsdCents).toBe(700_000);
    expect(combined.totals.averageUsdCents).toBe(87_500);
    // The period before: $4,000.00 and $1,000.00.
    expect(combined.totals.previousSalesUsdCents).toBe(500_000);
    expect(combined.totals.previousOrders).toBe(7);
  });

  it("ranks by dollar sales and shares out 100%", () => {
    expect([row("tz").rank, row("ke").rank, row("ug").rank]).toEqual([1, 2, null]);
    expect(row("tz").contribution).toBeCloseTo(71.43, 1);
    expect((row("tz").contribution ?? 0) + (row("ke").contribution ?? 0)).toBeCloseTo(100, 6);
  });

  it("measures growth in the country's own currency, so it needs no rate", () => {
    expect(row("tz").growth).toBeCloseTo(25, 6);
    expect(row("ke").growth).toBeCloseTo(100, 6);
    const noRate = combine([{ ...tanzania, rate: null }]);
    expect(noRate.rows[0]).toMatchObject({ growth: 25, salesUsdCents: null, rank: null, contribution: null, salesMinor: 13_250_000 });
  });

  it("shows a country that did not answer as not connected, with the reason and no figure", () => {
    expect(row("ug")).toMatchObject({ connected: false, unavailable: "not_configured", orders: 0, salesUsdCents: null, customers: null, growth: null, delivered: null });
    expect(combined.totals.withoutRate).toEqual([]);
  });

  it("leaves a country without a rate out of the dollar totals and says which", () => {
    const partial = combine([tanzania, { ...kenya, rate: null }]);
    expect(partial.totals).toMatchObject({ salesUsdCents: 500_000, orders: 13, withoutRate: ["Kenya"] });
    expect(partial.rows.find((candidate) => candidate.id === "ke")).toMatchObject({ salesUsdCents: null, salesMinor: 26_500_000, orders: 3 });
    expect(partial.insights.find((insight) => insight.key === "rate")?.text).toContain("Kenya");
  });

  it("ignores a rate typed for another currency than the one the country reports in", () => {
    const mismatch = combine([{ ...tanzania, currency: "USD" }]);
    expect(mismatch.rows[0]).toMatchObject({ currency: "TZS", salesUsdCents: null, rate: null });
    expect(mismatch.totals.withoutRate).toEqual(["Tanzania"]);
  });

  it("does not compare with a period that only some countries answered for", () => {
    const partial = combine([tanzania, { ...kenya, data: { ...kenya.data!, previous: null } }]);
    expect(partial.totals).toMatchObject({ previousOrders: null, previousSalesUsdCents: null, previousPaidOrders: null });
    expect(partial.rows.find((candidate) => candidate.id === "ke")?.growth).toBeNull();
  });

  it("joins products by SKU across countries, with the top country and where stock is short", () => {
    expect(combined.products.map((product) => [product.sku, product.units, product.usdCents, product.topCountry, product.stock, product.stockWhere])).toEqual([
      // 9,275,000 TZS = $3,500.00 plus 265,000.00 KES = $2,000.00.
      ["LED-PL24", 40, 550_000, "Tanzania", "out", ["Tanzania"]],
      ["PLG-13", 50, 150_000, "Tanzania", "ok", []],
    ]);
    // Without a stock answer the status is not guessed.
    const blind = combine([{ ...tanzania, data: { ...tanzania.data!, stock: null } }]);
    expect(blind.products.map((product) => product.stock)).toEqual(["unknown", "unknown"]);
  });

  it("joins categories by slug and keeps each country's part", () => {
    expect(combined.categories.map((category) => [category.slug, category.units, category.usdCents])).toEqual([
      ["lighting", 40, 550_000],
      ["switches", 50, 150_000],
    ]);
    expect(combined.categories[0]?.byCountry).toEqual([
      { country: "Tanzania", usdCents: 350_000 },
      { country: "Kenya", usdCents: 200_000 },
    ]);
  });

  it("adds the days up across countries for the trend", () => {
    expect(combined.trend).toEqual([
      { day: "2026-11-01", orders: 7 },
      { day: "2026-11-02", orders: 6 },
    ]);
  });

  it("states insights that the figures support, and none it cannot", () => {
    const keys = combined.insights.map((insight) => insight.key);
    expect(keys).toEqual(["highest", "orders", "growth", "lowest", "category", "product", "restock", "cancelled"]);
    expect(combined.insights.find((insight) => insight.key === "orders")?.text).toBe("Tanzania: 10 orders placed (76.9% of all orders)");
    expect(combined.insights.find((insight) => insight.key === "highest")?.text).toBe("Tanzania: $5,000.00 (71.4% of the total)");
    expect(combined.insights.find((insight) => insight.key === "growth")?.text).toBe("Kenya: +100.0% on the period before");
    expect(combined.insights.find((insight) => insight.key === "restock")?.text).toBe("LED Panel 24W is a best seller and is out of stock in Tanzania.");
    expect(combine([uganda]).insights).toEqual([]);
    // One country alone: its share of the orders says nothing, so it is not said. Without a rate there is no dollar amount, never "$0.00".
    const alone = combine([{ ...tanzania, rate: null }]).insights;
    expect(alone.find((insight) => insight.key === "orders")?.text).toBe("Tanzania: 10 orders placed");
    expect(alone.find((insight) => insight.key === "product")?.text).toBe("13A Top Plug: 50 units");
    expect(alone.map((insight) => insight.text).join(" ")).not.toContain("$");
    expect(combine([]).totals).toMatchObject({ countries: 0, orders: 0, salesUsdCents: 0, customers: null, averageUsdCents: null });
  });

  it("sorts by any column and keeps countries without the figure last", () => {
    expect(sortRows(combined.rows, "sales", "desc").map((r) => r.id)).toEqual(["tz", "ke", "ug"]);
    expect(sortRows(combined.rows, "sales", "asc").map((r) => r.id)).toEqual(["ke", "tz", "ug"]);
    expect(sortRows(combined.rows, "growth", "desc").map((r) => r.id)).toEqual(["ke", "tz", "ug"]);
    expect(sortRows(combined.rows, "name", "desc").map((r) => r.id)).toEqual(["ug", "tz", "ke"]);
    expect(sortRows(combined.rows, "rank", "asc").map((r) => r.id)).toEqual(["tz", "ke", "ug"]);
    expect(sortRows(combined.rows, "paidOrders", "desc").map((r) => r.id)).toEqual(["tz", "ke", "ug"]);
    expect(sortRows(combined.rows, "paidOrders", "asc").map((r) => r.id)).toEqual(["ke", "tz", "ug"]);
  });

  it("puts every order status in exactly one of the chart's four groups", () => {
    const byStatus = { pending_payment: 3, confirmed: 1, processing: 2, packed: 4, dispatched: 5, in_transit: 6, delivered: 7, cancelled: 8 };
    const groups = statusGroupsOf(byStatus);
    expect(groups).toEqual({ awaiting: 3, inProgress: 18, delivered: 7, cancelled: 8 });
    // Nothing is counted twice or dropped: the groups add up to the orders the country reported.
    expect(Object.values(groups).reduce((sum, value) => sum + value, 0)).toBe(Object.values(byStatus).reduce((sum, value) => sum + value, 0));
    expect(statusGroupsOf({})).toEqual({ awaiting: 0, inProgress: 0, delivered: 0, cancelled: 0 });
    expect(row("tz").statusGroups).toEqual({ awaiting: 0, inProgress: 0, delivered: 6, cancelled: 0 });
    // A country that did not answer has no breakdown, and one whose orders report failed has none either: never zeros that look real.
    expect(row("ug").statusGroups).toBeNull();
    expect(combine([{ ...tanzania, data: { ...tanzania.data!, orders: null } }]).rows[0]?.statusGroups).toBeNull();
  });

  it("tells a country that was never set up from one whose connection failed", () => {
    expect(connectionOf(true, null)).toBe("connected");
    expect([connectionOf(false, "not_configured"), connectionOf(false, "no_iso_code")]).toEqual(["not_connected", "not_connected"]);
    expect(connectionOf(false, "disabled")).toBe("switched_off");
    for (const reason of ["unreachable", "timeout", "rejected", "server_error", "invalid_response", "signing_key_invalid", "country_reports_missing"] as const) {
      expect(connectionOf(false, reason), reason).toBe("failed");
    }
    // No reason at all is a failure too: a planned country always has one.
    expect(connectionOf(false, null)).toBe("failed");
    expect(CONNECTION_LABEL.failed).toBe("Connection failed");
  });
});

describe("the page's address", () => {
  const today = "2026-11-23";

  it("defaults to the last 30 days, all countries, dollars, by rank", () => {
    expect(readGlobalQuery({}, today)).toEqual({ period: { from: "2026-10-25", to: today }, preset: 30, problem: null, country: null, view: "usd", sort: "rank", direction: "asc" });
  });

  it("reads what it knows and drops what it does not", () => {
    const query = readGlobalQuery({ from: "2026-11-01", to: "2026-11-10", country: "tz", view: "local", sort: "growth", dir: "asc" }, today);
    expect(query).toMatchObject({ period: { from: "2026-11-01", to: "2026-11-10" }, country: "tz", view: "local", sort: "growth", direction: "asc" });
    for (const country of ["TZ", "../etc", "tz;drop", "a", "<script>", "tz/../ke"]) expect(readGlobalQuery({ country }, today).country).toBeNull();
    expect(readGlobalQuery({ sort: "salesMinor); drop table", dir: "sideways", view: "eur" }, today)).toMatchObject({ sort: "rank", direction: "asc", view: "usd" });
    expect(readGlobalQuery({ sort: "sales" }, today).direction).toBe("desc");
    // A period the reports would not show is replaced, with the reason.
    expect(readGlobalQuery({ from: "2026-11-10", to: "2026-11-01" }, today).problem).toMatch(/ends before it starts/);
    expect(readGlobalQuery({ from: "2026-11-01", to: "2026-12-01" }, today).problem).toMatch(/cannot end after today/);
  });

  it("writes addresses that read back the same", () => {
    const query = readGlobalQuery({ from: "2026-11-01", to: "2026-11-10", country: "tz", view: "local", sort: "growth", dir: "asc" }, today);
    const href = globalHref("/reports", query);
    expect(href).toBe("/reports?from=2026-11-01&to=2026-11-10&country=tz&view=local&sort=growth&dir=asc");
    expect(readGlobalQuery(Object.fromEntries(new URL(href, "https://admin.invalid").searchParams), today)).toEqual(query);
    expect(globalHref("/reports", readGlobalQuery({}, today))).toBe("/reports?from=2026-10-25&to=2026-11-23");
  });
});

describe("the CSV file", () => {
  const csv = globalReportCsv({ from: "2026-11-01", to: "2026-11-02" }, combine([tanzania, kenya, uganda]), "2026-11-23T08:00:00.000Z");

  it("carries each country's exact local amount, the dollar amount and the rate", () => {
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("1,Tanzania,active,yes,TZS,2650,10,6,13250000,5000.00,120,2208333,833.33,6,3,1,25.0,71.4");
    expect(csv).toContain("2,Kenya,planned,yes,KES,132.5,3,2,265000.00,2000.00,40,132500.00,1000.00,2,0,1,100.0,28.6");
    expect(csv).toContain(",Uganda,planned,no,UGX,,,,,,,,,,,,,");
    expect(csv).toContain(",Total,,2 of 3,USD,,13,8,,7000.00,160,,875.00,8,3,2,,");
    expect(csv).toContain("LED Panel 24W,LED-PL24,40,5500.00,Tanzania,out in Tanzania");
  });

  it("writes a name a spreadsheet would run as a formula as text", () => {
    const hostile: CountryInput = {
      ...tanzania,
      name: "=HYPERLINK(\"https://evil.example\")",
      data: { ...tanzania.data!, products: products("TZS", 0, [["x", "@SUM(A1:A9)", "+1+1", 1, 2650]], [["c", "-cmd|' /C calc'!A0", 1, 2650]]) },
    };
    const text = globalReportCsv({ from: "2026-11-01", to: "2026-11-02" }, combine([hostile]), "2026-11-23T08:00:00.000Z");
    for (const line of text.split("\r\n")) for (const cell of line.split(",")) expect(cell).not.toMatch(/^"?[=+\-@]/);
    expect(text).toContain("'=HYPERLINK");
    expect(text).toContain("'@SUM(A1:A9)");
  });
});
