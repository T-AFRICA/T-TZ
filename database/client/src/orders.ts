import type { CountryCode } from "@tronic/types";
import { ANON, toSafeInteger, withAccess, type Access, type Db } from "./db";

/**
 * Orders through the database functions of migration 0004. The database
 * reprices, checks stock and writes in one transaction; this module only
 * shapes the call and the answer. `access` must come from a verified
 * session (or ANON for guest checkout), never from request input.
 */

export interface OrderLineInput {
  /** Product key (slug). */
  product: string;
  color: string | null;
  variant: string | null;
  quantity: number;
}

export interface PlaceCodOrderInput {
  idempotencyKey: string;
  /** The deployment's country, set by the server. */
  country: CountryCode;
  contact: { name: string; email: string; phone: string };
  delivery: {
    method: "home";
    region: string;
    district: string;
    ward: string;
    street: string;
    extra: string;
    notes: string;
  };
  lines: readonly OrderLineInput[];
  /** The total the customer was shown, in minor units. */
  expectedTotalMinor: number | null;
}

export type LineProblem = { product: string; issue: "unavailable" | "invalid_options" | "out_of_stock"; available?: number };

export type PlaceCodOrderResult =
  | {
      ok: true;
      replayed: boolean;
      orderNumber: string;
      subtotalMinor: number;
      totalMinor: number;
      currency: string;
      itemCount: number;
    }
  | { ok: false; code: "invalid_request" | "idempotency_conflict" }
  | { ok: false; code: "lines_unavailable"; problems: LineProblem[] }
  | { ok: false; code: "price_changed"; totalMinor: number; currency: string };

type Json = Record<string, unknown>;

export async function placeCodOrder(db: Db, access: Access, input: PlaceCodOrderInput): Promise<PlaceCodOrderResult> {
  // JSON goes in as text and is cast in SQL: postgres.js would JSON-encode a
  // string parameter that the server types as jsonb a second time.
  const [row] = await withAccess(db, access, (tx) =>
    tx.query<{ result: unknown }>(
      `select place_cod_order($1::uuid, $2::char(2), $3::text::jsonb, $4::text::jsonb, $5::text::jsonb, $6::text::bigint) as result`,
      [
        input.idempotencyKey,
        input.country,
        JSON.stringify(input.contact),
        JSON.stringify(input.delivery),
        JSON.stringify(input.lines),
        input.expectedTotalMinor === null ? null : String(input.expectedTotalMinor),
      ],
    ),
  );
  const result = parseJson(row?.result);
  if (result.ok === true) {
    return {
      ok: true,
      replayed: result.replayed === true,
      orderNumber: String(result.order_number),
      subtotalMinor: toSafeInteger(result.subtotal_minor, "subtotal_minor"),
      totalMinor: toSafeInteger(result.total_minor, "total_minor"),
      currency: String(result.currency),
      itemCount: toSafeInteger(result.item_count, "item_count"),
    };
  }
  switch (result.code) {
    case "lines_unavailable":
      return { ok: false, code: "lines_unavailable", problems: Array.isArray(result.problems) ? (result.problems as LineProblem[]) : [] };
    case "price_changed":
      return {
        ok: false,
        code: "price_changed",
        totalMinor: toSafeInteger(result.total_minor, "total_minor"),
        currency: String(result.currency),
      };
    case "idempotency_conflict":
      return { ok: false, code: "idempotency_conflict" };
    default:
      return { ok: false, code: "invalid_request" };
  }
}

export type TrackedOrder =
  | { found: false }
  | {
      found: true;
      orderNumber: string;
      status: string;
      paymentStatus: string;
      createdAt: string;
      totalMinor: number;
      currency: string;
      itemCount: number;
    };

/** Guest lookup by order number plus checkout email or phone (both must match). */
export async function trackOrder(db: Db, orderNumber: string, contact: string): Promise<TrackedOrder> {
  const [row] = await withAccess(db, ANON, (tx) =>
    tx.query<{ result: unknown }>(`select track_order($1, $2) as result`, [orderNumber, contact]),
  );
  const result = parseJson(row?.result);
  if (result.found !== true) return { found: false };
  return {
    found: true,
    orderNumber: String(result.order_number),
    status: String(result.status),
    paymentStatus: String(result.payment_status),
    createdAt: String(result.created_at),
    totalMinor: toSafeInteger(result.total_minor, "total_minor"),
    currency: String(result.currency),
    itemCount: toSafeInteger(result.item_count, "item_count"),
  };
}

export interface CustomerOrder {
  orderNumber: string;
  status: string;
  createdAt: string;
  totalMinor: number;
  currency: string;
}

/** The signed-in customer's own orders; RLS returns no one else's. */
export async function listCustomerOrders(db: Db, access: Extract<Access, { role: "authenticated" }>): Promise<CustomerOrder[]> {
  const rows = await withAccess(db, access, (tx) =>
    tx.query(`select order_number, status, created_at, total_minor, currency from orders order by created_at desc limit 50`),
  );
  return rows.map((row) => ({
    orderNumber: String(row.order_number),
    status: String(row.status),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    totalMinor: toSafeInteger(row.total_minor, "total_minor"),
    currency: String(row.currency),
  }));
}

function parseJson(value: unknown): Json {
  if (typeof value === "string") return JSON.parse(value) as Json;
  if (value && typeof value === "object") return value as Json;
  throw new Error("Unexpected database function result");
}
