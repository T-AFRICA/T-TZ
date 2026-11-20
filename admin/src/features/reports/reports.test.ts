import { describe, expect, it } from "vitest";
import { csvCell, minorToDecimal, reportCsv, reportFileName } from "./csv";
import { DAILY_COLUMNS_MAX, salesBuckets } from "./load";
import { periodDays, readReportQuery, shiftDay, todayIn } from "./period";

const TODAY = "2026-11-20";

describe("report period", () => {
  it("defaults to the last 30 days on the sales tab", () => {
    expect(readReportQuery({}, TODAY)).toEqual({ tab: "sales", period: { from: "2026-10-22", to: TODAY }, preset: 30, problem: null });
  });

  it("keeps a valid period and tab, and knows a preset", () => {
    expect(readReportQuery({ tab: "stock", from: "2026-11-14", to: TODAY }, TODAY)).toMatchObject({ tab: "stock", period: { from: "2026-11-14", to: TODAY }, preset: 7 });
    expect(readReportQuery({ tab: "orders", from: "2026-01-01", to: "2026-01-31" }, TODAY)).toMatchObject({ preset: null, problem: null });
  });

  it("refuses a reversed, too long, future or broken period, and an unknown tab", () => {
    expect(readReportQuery({ from: TODAY, to: "2026-11-01" }, TODAY).problem).toMatch(/ends before it starts/);
    expect(readReportQuery({ from: "2025-01-01", to: TODAY }, TODAY).problem).toMatch(/366 days/);
    expect(readReportQuery({ from: "2026-11-01", to: "2026-12-01" }, TODAY).problem).toMatch(/after today/);
    expect(readReportQuery({ from: "x", to: TODAY }, TODAY).period).toEqual({ from: "2026-10-22", to: TODAY });
    expect(readReportQuery({ tab: "secrets" }, TODAY).tab).toBe("sales");
  });

  it("counts days and reads today in the country's zone", () => {
    expect(periodDays({ from: "2026-11-01", to: "2026-11-30" })).toBe(30);
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
    // 22:30 UTC is already the next day in Dar es Salaam (UTC+3).
    expect(todayIn("Africa/Dar_es_Salaam", new Date("2026-11-20T22:30:00Z"))).toBe("2026-11-21");
    expect(todayIn("Not/AZone", new Date("2026-11-20T22:30:00Z"))).toBe("2026-11-20");
  });
});

describe("sales columns", () => {
  const day = (d: string, paidMinor: number) => ({ day: d, placed: 1, paidOrders: paidMinor > 0 ? 1 : 0, paidMinor, cancelled: 0 });

  it("draws a column a day, and a column a week for long periods", () => {
    expect(salesBuckets([day("2026-11-19", 5), day("2026-11-20", 7)]).buckets.map((b) => b.paidMinor)).toEqual([5, 7]);
    const long = Array.from({ length: DAILY_COLUMNS_MAX + 8 }, (_, i) => day(shiftDay("2026-08-01", i), 100));
    const weekly = salesBuckets(long);
    expect(weekly.unit).toBe("week");
    expect(weekly.buckets).toHaveLength(10);
    expect(weekly.buckets[0]).toMatchObject({ from: "2026-08-01", to: "2026-08-07", paidMinor: 700, placed: 7 });
    expect(weekly.buckets.reduce((sum, b) => sum + b.paidMinor, 0)).toBe(7000);
  });
});

describe("report CSV", () => {
  it("writes amounts exactly in the currency's units", () => {
    expect(minorToDecimal(2_800_050, 2)).toBe("28000.50");
    expect(minorToDecimal(5, 2)).toBe("0.05");
    expect(minorToDecimal(1234, 0)).toBe("1234");
    expect(minorToDecimal(7, 3)).toBe("0.007");
  });

  it("quotes separators and keeps formulas from running", () => {
    expect(csvCell('Cable, 2.5mm "red"')).toBe('"Cable, 2.5mm ""red"""');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("-5 LED")).toBe("'-5 LED");
    expect(csvCell(42)).toBe("42");
  });

  it("writes a products report with its period and currency", () => {
    const csv = reportCsv(
      "Tanzania",
      { from: "2026-11-01", to: TODAY },
      {
        tab: "products",
        data: {
          ok: true,
          currency: "TZS",
          currencyExponent: 2,
          paidMinor: 7_450_000,
          units: 3,
          products: [{ slug: "led", name: "LED Panel, 18W", sku: "SKU-1", units: 2, amountMinor: 5_600_000 }],
          categories: [{ slug: "lighting", name: "Lighting", units: 3, amountMinor: 7_450_000 }],
        },
      },
    );
    expect(csv.startsWith("﻿TRONIC Tanzania: Products & categories report\r\n")).toBe(true);
    expect(csv).toContain("Period: 2026-11-01 to 2026-11-20");
    expect(csv).toContain('1,"LED Panel, 18W",SKU-1,2,56000.00,75.2');
    expect(csv).toContain("Lighting,3,74500.00,100.0");
    expect(reportFileName("tz", "products", { from: "2026-11-01", to: TODAY })).toBe("tronic-tz-products-2026-11-01-to-2026-11-20.csv");
  });
});
