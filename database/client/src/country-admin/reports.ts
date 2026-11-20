import {
  ORDER_STATUSES,
  REPORT_TOP_PRODUCTS,
  STOCK_REASONS,
  type OrdersReport,
  type ProductsReport,
  type ReportPeriod,
  type SalesReport,
  type StockReport,
} from "@tronic/api-contracts";
import type { Db, Row } from "../db";

/**
 * Reports (migration 0019) for the country admin API: read only, a period
 * of the country's own days. Runs as service_role through the caller's
 * `withServiceAccess`. A period the database does not accept answers null;
 * the handler checks the period before it asks.
 */

type Json = Record<string, unknown>;
type ServiceAccess = <T>(db: Db, fn: (tx: Db) => Promise<T>) => Promise<T>;

const int = (value: unknown): number => {
  const n = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : typeof value === "bigint" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isSafeInteger(n) || n < 0) throw new Error("Unexpected database value: expected a non-negative integer");
  return n;
};
const list = (value: unknown): Json[] => (Array.isArray(value) ? (value as Json[]) : []);
const oneOf = <T extends string>(values: readonly T[], value: unknown): T => {
  const found = values.find((candidate) => candidate === value);
  if (!found) throw new Error("Unexpected report value");
  return found;
};

function object(value: unknown): Json | null {
  const parsed: unknown = typeof value === "string" ? JSON.parse(value) : value;
  if (parsed === null || parsed === undefined) return null;
  if (typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Json;
  throw new Error("Unexpected database function result");
}

const money = (r: Json) => ({ currency: String(r.currency).trim(), currencyExponent: int(r.currency_exponent) });

export function reportFunctions(withServiceAccess: ServiceAccess) {
  async function call(db: Db, sql: string, params: readonly unknown[]): Promise<Json> {
    const [row] = await withServiceAccess(db, (tx) => tx.query<Row>(sql, params));
    const result = object(row?.result);
    if (!result) throw new Error("report: the period was refused");
    return result;
  }

  return {
    async sales(db: Db, country: string, period: ReportPeriod): Promise<SalesReport> {
      const r = await call(db, `select admin_report_sales($1::char(2), $2::date, $3::date) as result`, [country, period.from, period.to]);
      const totals = object(r.totals) ?? {};
      return {
        ok: true,
        ...money(r),
        days: list(r.days).map((d) => ({
          day: String(d.day).slice(0, 10),
          placed: int(d.placed),
          paidOrders: int(d.paid_orders),
          paidMinor: int(d.paid_minor),
          cancelled: int(d.cancelled),
        })),
        totals: {
          placed: int(totals.placed),
          paidOrders: int(totals.paid_orders),
          paidMinor: int(totals.paid_minor),
          cancelled: int(totals.cancelled),
          open: int(totals.open),
        },
        byPayment: list(r.by_payment).map((p) => ({ method: String(p.method), paidOrders: int(p.paid_orders), paidMinor: int(p.paid_minor) })),
      };
    },

    async products(db: Db, country: string, period: ReportPeriod): Promise<ProductsReport> {
      const r = await call(db, `select admin_report_products($1::char(2), $2::date, $3::date, $4::integer) as result`, [
        country,
        period.from,
        period.to,
        REPORT_TOP_PRODUCTS,
      ]);
      return {
        ok: true,
        ...money(r),
        paidMinor: int(r.paid_minor),
        units: int(r.units),
        products: list(r.products).map((p) => ({ slug: String(p.slug), name: String(p.name), sku: String(p.sku), units: int(p.units), amountMinor: int(p.amount_minor) })),
        categories: list(r.categories).map((c) => ({ slug: String(c.slug), name: String(c.name), units: int(c.units), amountMinor: int(c.amount_minor) })),
      };
    },

    async orders(db: Db, country: string, period: ReportPeriod): Promise<OrdersReport> {
      const r = await call(db, `select admin_report_orders($1::char(2), $2::date, $3::date) as result`, [country, period.from, period.to]);
      const byStatus = object(r.by_status) ?? {};
      return {
        ok: true,
        ...money(r),
        placed: int(r.placed),
        byStatus: Object.fromEntries(Object.entries(byStatus).map(([status, n]) => [oneOf(ORDER_STATUSES, status), int(n)])),
        byRegion: list(r.by_region).map((x) => ({ region: String(x.region), orders: int(x.orders), paidMinor: int(x.paid_minor) })),
        riders: list(r.riders).map((x) => ({
          riderId: String(x.rider_id),
          riderName: String(x.rider_name),
          given: int(x.given),
          delivered: int(x.delivered),
          failedAttempts: int(x.failed_attempts),
          cashMinor: int(x.cash_minor),
        })),
      };
    },

    async stock(db: Db, country: string, period: ReportPeriod): Promise<StockReport> {
      const r = await call(db, `select admin_report_stock($1::char(2), $2::date, $3::date) as result`, [country, period.from, period.to]);
      return {
        ok: true,
        ...money(r),
        products: int(r.products),
        out: int(r.out),
        low: int(r.low),
        units: int(r.units),
        valueMinor: int(r.value_minor),
        movements: list(r.movements).map((m) => ({ reason: oneOf(STOCK_REASONS, m.reason), unitsIn: int(m.units_in), unitsOut: int(m.units_out), changes: int(m.changes) })),
        attention: list(r.attention).map((a) => ({
          slug: String(a.slug),
          name: String(a.name),
          sku: String(a.sku),
          available: int(a.available),
          lowStockAt: int(a.low_stock_at),
          live: a.live === true,
        })),
      };
    },
  };
}
