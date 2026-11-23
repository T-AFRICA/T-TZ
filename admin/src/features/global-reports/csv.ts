import type { ReportPeriod } from "@tronic/api-contracts";
import { csvCell, minorToDecimal } from "@/features/reports/csv";
import type { Combined } from "./combine";

/**
 * The combined report as a CSV file for a spreadsheet: the country table,
 * the best-selling products and the categories. Each country's own amount
 * is exact, in its currency; the dollar column is that amount at the rate
 * named beside it, rounded to the cent, and empty without a rate. No
 * customer details: the reports carry none. Cells a spreadsheet would read
 * as a formula are written as text (csvCell).
 */

type Cell = string | number;
const cents = (value: number | null) => (value === null ? "" : minorToDecimal(value, 2));
const one = (value: number | null) => (value === null ? "" : value.toFixed(1));

export function globalReportCsv(period: ReportPeriod, report: Combined, readAt: string): string {
  const lines: string[] = [
    csvCell("TRONIC: Global Combined Reports"),
    csvCell(`Period: ${period.from} to ${period.to} (each country's own days, both included)`),
    csvCell("A sale is a paid order. US dollar amounts use the rate typed by the Master Super Admin and are rounded to the cent; they are for reading, not accounting."),
    csvCell(`Read from the countries at ${readAt}`),
  ];
  const block = (title: string, head: string[], rows: Cell[][]) => {
    lines.push("", csvCell(title), head.map(csvCell).join(","));
    for (const row of rows) lines.push(row.map(csvCell).join(","));
  };

  block(
    "Countries",
    ["Rank", "Country", "Status", "Connected", "Currency", "Units per USD", "Orders", "Paid orders", "Paid sales (local)", "Paid sales (USD)", "Customers", "Avg. order (local)", "Avg. order (USD)", "Delivered", "In progress", "Cancelled", "Growth %", "Contribution %"],
    report.rows.map((row) => [
      row.rank ?? "",
      row.name,
      row.status,
      row.connected ? "yes" : "no",
      row.currency ?? "",
      row.rate ? String(row.rate.unitsPerUsd) : "",
      row.connected ? row.orders : "",
      row.connected ? row.paidOrders : "",
      row.connected ? minorToDecimal(row.salesMinor, row.exponent) : "",
      cents(row.salesUsdCents),
      row.customers ?? "",
      row.averageMinor === null ? "" : minorToDecimal(row.averageMinor, row.exponent),
      cents(row.averageUsdCents),
      row.delivered ?? "",
      row.connected ? row.pending : "",
      row.connected ? row.cancelled : "",
      one(row.growth),
      one(row.contribution),
    ]),
  );
  const { totals } = report;
  lines.push(
    ["", "Total", "", `${totals.connected} of ${totals.countries}`, "USD", "", totals.orders, totals.paidOrders, "", cents(totals.salesUsdCents), totals.customers ?? "", "", cents(totals.averageUsdCents), totals.delivered, totals.pending, totals.cancelled, "", ""]
      .map(csvCell)
      .join(","),
  );

  block(
    "Best-selling products (all countries, by SKU)",
    ["Product", "SKU", "Units sold", "Revenue (USD)", "Top country", "Stock"],
    report.products.map((product) => [product.name, product.sku, product.units, cents(product.usdCents), product.topCountry, product.stockWhere.length > 0 ? `${product.stock} in ${product.stockWhere.join(" / ")}` : product.stock]),
  );
  block(
    "Categories (all countries)",
    ["Category", "Units sold", "Paid sales (USD)"],
    report.categories.map((category) => [category.name, category.units, cents(category.usdCents)]),
  );
  // A byte-order mark so spreadsheet programs read the names as UTF-8.
  return `﻿${lines.join("\r\n")}\r\n`;
}

export function globalReportFileName(period: ReportPeriod, country: string | null): string {
  return `tronic-global${country ? `-${country}` : ""}-${period.from}-to-${period.to}.csv`;
}
