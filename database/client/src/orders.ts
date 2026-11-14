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

/* ───────────── Customer portal reads (signed-in customers only) ───────────── */

/** Statuses of migration 0004, in the order an order normally moves through them. */
export const ORDER_STATUSES = [
  "pending_payment",
  "confirmed",
  "processing",
  "packed",
  "dispatched",
  "in_transit",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface CustomerOrderLine {
  lineNo: number;
  productSlug: string;
  sku: string;
  name: string;
  color: string | null;
  variant: string | null;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
}

export interface CustomerOrderSummary extends CustomerOrder {
  paymentStatus: string;
  paymentMethod: string;
  deliveryMethod: string;
  /** Sum of the quantities. */
  itemCount: number;
  lines: Pick<CustomerOrderLine, "productSlug" | "sku" | "name" | "quantity">[];
}

export interface CustomerOrderDetail extends CustomerOrderSummary {
  contact: { name: string; email: string; phone: string };
  delivery: {
    region: string | null;
    district: string | null;
    ward: string | null;
    street: string | null;
    extra: string | null;
    notes: string | null;
  };
  subtotalMinor: number;
  /** null until a delivery fee is quoted for the order. */
  deliveryFeeMinor: number | null;
  detailLines: CustomerOrderLine[];
}

export interface CustomerOrderQuery {
  /** Only these statuses; empty or absent means all. */
  statuses?: readonly string[];
  /** Part of an order number, any case. */
  search?: string;
  /** Inclusive start and exclusive end of the order date (ISO timestamps). */
  from?: string;
  to?: string;
  sort?: "newest" | "oldest";
  /** 1-based. */
  page?: number;
  pageSize?: number;
}

export interface CustomerOrderPage {
  items: CustomerOrderSummary[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export const CUSTOMER_ORDER_PAGE_SIZE = 10;
const MAX_CUSTOMER_ORDER_PAGE_SIZE = 50;

type Authenticated = Extract<Access, { role: "authenticated" }>;

function iso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function nullableText(value: unknown): string | null {
  return value === null || value === undefined || value === "" ? null : String(value);
}

function parseJsonArray(value: unknown): Json[] {
  const parsed: unknown = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(parsed)) throw new Error("Unexpected database array result");
  return parsed as Json[];
}

const SUMMARY_COLUMNS = `
  o.order_number, o.status, o.payment_status, o.payment_method, o.delivery_method,
  o.created_at, o.total_minor, o.currency,
  coalesce((select jsonb_agg(jsonb_build_object('slug', l.product_slug, 'sku', l.sku, 'name', l.name, 'quantity', l.quantity)
                             order by l.line_no)
              from order_lines l where l.order_id = o.id), '[]'::jsonb) as lines`;

function rowToSummary(row: Json): CustomerOrderSummary {
  const lines = parseJsonArray(row.lines).map((line) => ({
    productSlug: String(line.slug),
    sku: String(line.sku),
    name: String(line.name),
    quantity: toSafeInteger(line.quantity, "quantity"),
  }));
  return {
    orderNumber: String(row.order_number),
    status: String(row.status),
    paymentStatus: String(row.payment_status),
    paymentMethod: String(row.payment_method),
    deliveryMethod: String(row.delivery_method),
    createdAt: iso(row.created_at),
    totalMinor: toSafeInteger(row.total_minor, "total_minor"),
    currency: String(row.currency),
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    lines,
  };
}

/**
 * One page of the signed-in customer's own orders, filtered, sorted and
 * paged in the database. Runs as the authenticated role, so Row Level
 * Security returns no one else's orders whatever the filters say.
 */
export async function listCustomerOrderPage(db: Db, access: Authenticated, query: CustomerOrderQuery = {}): Promise<CustomerOrderPage> {
  const pageSize = Math.min(Math.max(Math.trunc(query.pageSize ?? CUSTOMER_ORDER_PAGE_SIZE), 1), MAX_CUSTOMER_ORDER_PAGE_SIZE);
  const requestedPage = Math.max(Math.trunc(query.page ?? 1), 1);
  const statuses = (query.statuses ?? []).filter((status) => (ORDER_STATUSES as readonly string[]).includes(status));
  const search = query.search?.trim().toUpperCase() ?? "";
  // Passed as text and split in SQL: the same on every driver.
  const params = [statuses.join(","), search, query.from ?? "", query.to ?? ""];
  const where = `
    where ($1 = '' or o.status = any(string_to_array($1, ',')))
      and ($2 = '' or position($2 in o.order_number) > 0)
      and ($3 = '' or o.created_at >= $3::timestamptz)
      and ($4 = '' or o.created_at < $4::timestamptz)`;
  const direction = query.sort === "oldest" ? "asc" : "desc";

  return withAccess(db, access, async (tx) => {
    const [count] = await tx.query(`select count(*) as n from orders o ${where}`, params);
    const total = toSafeInteger(count?.n ?? 0, "count");
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, pageCount);
    const rows = await tx.query(
      `select ${SUMMARY_COLUMNS} from orders o ${where}
        order by o.created_at ${direction}, o.order_number ${direction}
        limit ${pageSize} offset ${(page - 1) * pageSize}`,
      params,
    );
    return { items: rows.map(rowToSummary), total, page, pageSize, pageCount };
  });
}

/** How many orders the signed-in customer has in each status. */
export async function countCustomerOrdersByStatus(db: Db, access: Authenticated): Promise<Record<string, number>> {
  const rows = await withAccess(db, access, (tx) => tx.query(`select status, count(*) as n from orders group by status`));
  const counts: Record<string, number> = {};
  for (const row of rows) counts[String(row.status)] = toSafeInteger(row.n, "count");
  return counts;
}

/**
 * One of the signed-in customer's own orders with its lines, or null. An
 * order of another customer and an unknown number both give null, so the
 * answer never confirms that an order number exists.
 */
export async function getCustomerOrder(db: Db, access: Authenticated, orderNumber: string): Promise<CustomerOrderDetail | null> {
  const number = orderNumber.trim().toUpperCase();
  if (number.length < 4 || number.length > 40) return null;
  return withAccess(db, access, async (tx) => {
    const [row] = await tx.query(
      `select o.id, ${SUMMARY_COLUMNS},
              o.contact_name, o.contact_email, o.contact_phone,
              o.delivery_region, o.delivery_district, o.delivery_ward, o.delivery_street, o.delivery_extra, o.delivery_notes,
              o.subtotal_minor, o.delivery_fee_minor
         from orders o where o.order_number = $1`,
      [number],
    );
    if (!row) return null;
    const lines = await tx.query(
      `select line_no, product_slug, sku, name, color, variant, quantity, unit_price_minor, line_total_minor
         from order_lines where order_id = $1 order by line_no`,
      [row.id],
    );
    return {
      ...rowToSummary(row),
      contact: { name: String(row.contact_name), email: String(row.contact_email), phone: String(row.contact_phone) },
      delivery: {
        region: nullableText(row.delivery_region),
        district: nullableText(row.delivery_district),
        ward: nullableText(row.delivery_ward),
        street: nullableText(row.delivery_street),
        extra: nullableText(row.delivery_extra),
        notes: nullableText(row.delivery_notes),
      },
      subtotalMinor: toSafeInteger(row.subtotal_minor, "subtotal_minor"),
      deliveryFeeMinor:
        row.delivery_fee_minor === null || row.delivery_fee_minor === undefined
          ? null
          : toSafeInteger(row.delivery_fee_minor, "delivery_fee_minor"),
      detailLines: lines.map((line) => ({
        lineNo: toSafeInteger(line.line_no, "line_no"),
        productSlug: String(line.product_slug),
        sku: String(line.sku),
        name: String(line.name),
        color: nullableText(line.color),
        variant: nullableText(line.variant),
        quantity: toSafeInteger(line.quantity, "quantity"),
        unitPriceMinor: toSafeInteger(line.unit_price_minor, "unit_price_minor"),
        lineTotalMinor: toSafeInteger(line.line_total_minor, "line_total_minor"),
      })),
    };
  });
}
