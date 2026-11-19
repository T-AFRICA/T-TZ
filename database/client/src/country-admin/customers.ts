import { CUSTOMER_PAGE_SIZE, type CustomerDetailResponse, type CustomerList } from "@tronic/api-contracts";
import type { Db, Row } from "../db";

/**
 * The customer directory (migration 0011) for the country admin API: read
 * only, website accounts with their orders in this country.
 */

type Json = Record<string, unknown>;
type ServiceAccess = <T>(db: Db, fn: (tx: Db) => Promise<T>) => Promise<T>;

const iso = (value: unknown): string => new Date(String(value)).toISOString();
const isoOrNull = (value: unknown): string | null => (value === null || value === undefined ? null : iso(value));
const text = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
const int = (value: unknown): number => {
  const n = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof n !== "number" || !Number.isSafeInteger(n) || n < 0) throw new Error("Unexpected database value: expected a non-negative integer");
  return n;
};
const list = (value: unknown): Json[] => (Array.isArray(value) ? (value as Json[]) : []);

function object(value: unknown): Json | null {
  const parsed: unknown = typeof value === "string" ? JSON.parse(value) : value;
  if (parsed === null || parsed === undefined) return null;
  if (typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Json;
  throw new Error("Unexpected database function result");
}

export function customerFunctions(withServiceAccess: ServiceAccess) {
  async function call(db: Db, sql: string, params: readonly unknown[]): Promise<Json | null> {
    const [row] = await withServiceAccess(db, (tx) => tx.query<Row>(sql, params));
    return object(row?.result);
  }

  return {
    async list(db: Db, country: string, query: { q?: string | undefined; page: number }): Promise<CustomerList> {
      const r = (await call(db, `select admin_list_customers($1::char(2), $2, $3, $4) as result`, [
        country,
        query.q ?? null,
        CUSTOMER_PAGE_SIZE,
        (query.page - 1) * CUSTOMER_PAGE_SIZE,
      ])) ?? {};
      return {
        ok: true,
        total: int(r.total),
        page: query.page,
        pageSize: CUSTOMER_PAGE_SIZE,
        currency: String(r.currency),
        currencyExponent: int(r.currency_exponent),
        customers: list(r.customers).map((c) => ({
          id: String(c.id),
          email: text(c.email),
          name: text(c.name),
          phone: text(c.phone),
          createdAt: iso(c.created_at),
          orders: int(c.orders),
          paidMinor: int(c.paid_minor),
          lastOrderAt: isoOrNull(c.last_order_at),
        })),
      };
    },

    async get(db: Db, country: string, customerId: string): Promise<CustomerDetailResponse> {
      const c = await call(db, `select admin_get_customer($1::char(2), $2::uuid) as result`, [country, customerId]);
      if (!c) return { ok: false, code: "not_found" };
      return {
        ok: true,
        customer: {
          id: String(c.id),
          email: text(c.email),
          emailConfirmed: c.email_confirmed === true,
          name: text(c.name),
          phone: text(c.phone),
          createdAt: iso(c.created_at),
          currency: String(c.currency),
          currencyExponent: int(c.currency_exponent),
          orders: list(c.orders).map((o) => ({
            orderNumber: String(o.order_number),
            status: String(o.status),
            paymentStatus: String(o.payment_status),
            paymentMethod: String(o.payment_method),
            totalMinor: int(o.total_minor),
            itemCount: int(o.item_count),
            createdAt: iso(o.created_at),
          })),
        },
      };
    },
  };
}
