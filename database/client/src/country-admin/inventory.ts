import {
  INVENTORY_PAGE_SIZE,
  PRODUCT_STATUSES,
  STOCK_LEVELS,
  STOCK_REASONS,
  type InventoryDetailResponse,
  type InventoryFilter,
  type InventoryList,
  type LowStockResult,
  type StockAdjustResult,
  type StockAdjustment,
} from "@tronic/api-contracts";
import type { Db, Row } from "../db";

/**
 * Inventory (migration 0017) for the country admin API: every product's
 * stock with its low-stock level, the history of a product's stock, and the
 * changes administrators make. Runs as service_role through the caller's
 * `withServiceAccess`.
 */

type Json = Record<string, unknown>;
type ServiceAccess = <T>(db: Db, fn: (tx: Db) => Promise<T>) => Promise<T>;

const iso = (value: unknown): string => new Date(String(value)).toISOString();
const isoOrNull = (value: unknown): string | null => (value === null || value === undefined ? null : iso(value));
const text = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
const integer = (value: unknown): number => {
  const n = typeof value === "string" && /^-?\d+$/.test(value) ? Number(value) : typeof value === "bigint" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isSafeInteger(n)) throw new Error("Unexpected database value: expected an integer");
  return n;
};
const count = (value: unknown): number => {
  const n = integer(value);
  if (n < 0) throw new Error("Unexpected database value: expected a non-negative integer");
  return n;
};
const list = (value: unknown): Json[] => (Array.isArray(value) ? (value as Json[]) : []);
const oneOf = <T extends string>(values: readonly T[], value: unknown, what: string): T => {
  const found = values.find((candidate) => candidate === value);
  if (!found) throw new Error(`Unexpected ${what}`);
  return found;
};

function object(value: unknown): Json | null {
  const parsed: unknown = typeof value === "string" ? JSON.parse(value) : value;
  if (parsed === null || parsed === undefined) return null;
  if (typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Json;
  throw new Error("Unexpected database function result");
}

function imageRef(value: unknown): { id: string; url: string } | null {
  const image = object(value);
  return image ? { id: String(image.id), url: String(image.url) } : null;
}

export function inventoryFunctions(withServiceAccess: ServiceAccess) {
  async function call(db: Db, sql: string, params: readonly unknown[]): Promise<Json | null> {
    const [row] = await withServiceAccess(db, (tx) => tx.query<Row>(sql, params));
    return object(row?.result);
  }

  return {
    async list(db: Db, country: string, query: { q?: string | undefined; filter?: InventoryFilter | undefined; page: number }): Promise<InventoryList> {
      const r = (await call(db, `select admin_list_inventory($1::char(2), $2, $3, $4::integer, $5::integer) as result`, [
        country,
        query.q ?? null,
        query.filter ?? null,
        INVENTORY_PAGE_SIZE,
        (query.page - 1) * INVENTORY_PAGE_SIZE,
      ])) ?? {};
      const counts = object(r.counts) ?? {};
      return {
        ok: true,
        total: count(r.total),
        page: query.page,
        pageSize: INVENTORY_PAGE_SIZE,
        counts: { all: count(counts.all), low: count(counts.low), out: count(counts.out) },
        items: list(r.products).map((p) => ({
          slug: String(p.slug),
          sku: String(p.sku),
          name: String(p.name),
          status: oneOf(PRODUCT_STATUSES, p.status, "product status"),
          available: count(p.available),
          lowStockAt: count(p.low_stock_at),
          level: oneOf(STOCK_LEVELS, p.level, "stock level"),
          image: imageRef(p.image),
          lastChangeAt: isoOrNull(p.last_change_at),
        })),
      };
    },

    async get(db: Db, country: string, slug: string): Promise<InventoryDetailResponse> {
      const p = await call(db, `select admin_get_inventory($1::char(2), $2) as result`, [country, slug]);
      if (!p) return { ok: false, code: "not_found" };
      return {
        ok: true,
        item: {
          slug: String(p.slug),
          sku: String(p.sku),
          name: String(p.name),
          status: oneOf(PRODUCT_STATUSES, p.status, "product status"),
          available: count(p.available),
          lowStockAt: count(p.low_stock_at),
          image: imageRef(p.image),
          movements: list(p.movements).map((m) => ({
            change: integer(m.change),
            availableAfter: count(m.available_after),
            reason: oneOf(STOCK_REASONS, m.reason, "stock reason"),
            note: text(m.note),
            actorId: text(m.actor_id),
            orderNumber: text(m.order_number),
            createdAt: iso(m.created_at),
          })),
        },
      };
    },

    async adjust(db: Db, country: string, slug: string, adjustment: StockAdjustment, actorId: string, requestId: string): Promise<StockAdjustResult> {
      const r = await call(db, `select admin_adjust_stock($1::char(2), $2, $3, $4::integer, $5, $6, $7::uuid, $8::uuid) as result`, [
        country,
        slug,
        adjustment.mode,
        adjustment.quantity,
        adjustment.reason,
        adjustment.note ?? null,
        actorId,
        requestId,
      ]);
      if (!r) throw new Error("admin_adjust_stock returned nothing");
      if (r.ok === true) return { ok: true, replayed: r.replayed === true, available: count(r.available), change: integer(r.change) };
      const code = r.code === "not_found" || r.code === "not_enough" || r.code === "no_change" ? r.code : "invalid_request";
      return { ok: false, code, ...(r.available !== undefined && r.available !== null ? { available: count(r.available) } : {}) };
    },

    async setLowStock(db: Db, country: string, slug: string, level: number): Promise<LowStockResult> {
      const r = await call(db, `select admin_set_low_stock($1::char(2), $2, $3::integer) as result`, [country, slug, level]);
      if (!r) throw new Error("admin_set_low_stock returned nothing");
      if (r.ok === true) return { ok: true, lowStockAt: count(r.low_stock_at) };
      return { ok: false, code: r.code === "not_found" ? "not_found" : "invalid_request" };
    },
  };
}
