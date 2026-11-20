import type { OrdersReport, ProductsReport, ReportPeriod, SalesReport, StockReport } from "@tronic/api-contracts";
import { STOCK_REASON_LABEL } from "@/features/inventory/labels";
import { ORDER_STATUS_LABEL, isOrderStatus, paymentMethodLabel } from "@/features/orders/labels";
import { REPORT_TAB_LABEL, type ReportTab } from "./period";

/**
 * A report as a CSV file for a spreadsheet. Amounts are decimal numbers in
 * the country's currency (named in each header), never converted. No
 * customer details: reports carry none. Cells a spreadsheet would read as a
 * formula are written as text.
 */

type CsvCell = string | number;
interface CsvBlock {
  title: string;
  head: string[];
  rows: CsvCell[][];
}

/** 2800050 with exponent 2 is "28000.50": exact, without floating point. */
export function minorToDecimal(minor: number, exponent: number): string {
  if (exponent === 0) return String(minor);
  const digits = String(Math.abs(minor)).padStart(exponent + 1, "0");
  return `${minor < 0 ? "-" : ""}${digits.slice(0, -exponent)}.${digits.slice(-exponent)}`;
}

export function csvCell(value: CsvCell): string {
  if (typeof value === "number") return String(value);
  // A leading = + - @ (or tab/return) would run as a formula in a spreadsheet.
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(intro: string[], blocks: CsvBlock[]): string {
  const lines: string[] = intro.map((line) => csvCell(line));
  for (const block of blocks) {
    lines.push("", csvCell(block.title), block.head.map(csvCell).join(","));
    for (const row of block.rows) lines.push(row.map(csvCell).join(","));
  }
  // A byte-order mark so spreadsheet programs read the names as UTF-8.
  return `﻿${lines.join("\r\n")}\r\n`;
}

const percent = (part: number, whole: number) => (whole > 0 ? ((part / whole) * 100).toFixed(1) : "0.0");

export type AnyReport =
  | { tab: "sales"; data: SalesReport }
  | { tab: "products"; data: ProductsReport }
  | { tab: "orders"; data: OrdersReport }
  | { tab: "stock"; data: StockReport };

export function reportCsv(countryName: string, period: ReportPeriod, report: AnyReport): string {
  const { currency, currencyExponent: exp } = report.data;
  const money = (minor: number) => minorToDecimal(minor, exp);
  const intro = [
    `TRONIC ${countryName}: ${REPORT_TAB_LABEL[report.tab]} report`,
    `Period: ${period.from} to ${period.to} (the country's own days, both included)`,
    `Amounts in ${currency}. A sale is a paid order; Cash on Delivery is paid once delivered.`,
  ];

  switch (report.tab) {
    case "sales": {
      const s = report.data;
      return toCsv(intro, [
        {
          title: "Totals",
          head: ["Orders placed", "Paid orders", `Sales (${currency})`, "Cancelled", "Still open"],
          rows: [[s.totals.placed, s.totals.paidOrders, money(s.totals.paidMinor), s.totals.cancelled, s.totals.open]],
        },
        {
          title: "By day",
          head: ["Day", "Orders placed", "Paid orders", `Sales (${currency})`, "Cancelled"],
          rows: s.days.map((d) => [d.day, d.placed, d.paidOrders, money(d.paidMinor), d.cancelled]),
        },
        {
          title: "By payment method",
          head: ["Payment method", "Paid orders", `Sales (${currency})`],
          rows: s.byPayment.map((p) => [paymentMethodLabel(p.method), p.paidOrders, money(p.paidMinor)]),
        },
      ]);
    }
    case "products": {
      const p = report.data;
      return toCsv(intro, [
        {
          title: "Top products",
          head: ["Rank", "Product", "SKU", "Units sold", `Sales (${currency})`, "Share of sales %"],
          rows: p.products.map((x, i) => [i + 1, x.name, x.sku, x.units, money(x.amountMinor), percent(x.amountMinor, p.paidMinor)]),
        },
        {
          title: "Categories",
          head: ["Category", "Units sold", `Sales (${currency})`, "Share of sales %"],
          rows: p.categories.map((c) => [c.name, c.units, money(c.amountMinor), percent(c.amountMinor, p.paidMinor)]),
        },
      ]);
    }
    case "orders": {
      const o = report.data;
      return toCsv(intro, [
        {
          title: "Orders placed in the period, by status now",
          head: ["Status", "Orders", "Share %"],
          rows: Object.entries(o.byStatus).map(([status, n]) => [isOrderStatus(status) ? ORDER_STATUS_LABEL[status] : status, n ?? 0, percent(n ?? 0, o.placed)]),
        },
        {
          title: "By region",
          head: ["Region", "Orders", `Paid (${currency})`],
          rows: o.byRegion.map((r) => [r.region, r.orders, money(r.paidMinor)]),
        },
        {
          title: "Riders (deliveries given in the period)",
          head: ["Rider", "Given", "Delivered", "Failed attempts", `Cash collected (${currency})`],
          rows: o.riders.map((r) => [r.riderName, r.given, r.delivered, r.failedAttempts, money(r.cashMinor)]),
        },
      ]);
    }
    case "stock": {
      const st = report.data;
      return toCsv(intro, [
        {
          title: "Stock now",
          head: ["Products", "Out of stock", "Low", "Units in stock", `Value at today's prices (${currency})`],
          rows: [[st.products, st.out, st.low, st.units, money(st.valueMinor)]],
        },
        {
          title: "Stock changes in the period, by reason",
          head: ["Reason", "Units in", "Units out", "Changes"],
          rows: st.movements.map((m) => [STOCK_REASON_LABEL[m.reason], m.unitsIn, m.unitsOut, m.changes]),
        },
        {
          title: "Needs attention now",
          head: ["Product", "SKU", "In stock", "Low at", "On the website"],
          rows: st.attention.map((a) => [a.name, a.sku, a.available, a.lowStockAt, a.live ? "yes" : "no"]),
        },
      ]);
    }
  }
}

export function reportFileName(countryId: string, tab: ReportTab, period: ReportPeriod): string {
  return `tronic-${countryId}-${tab}-${period.from}-to-${period.to}.csv`;
}
