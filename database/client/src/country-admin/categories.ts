import {
  PRODUCT_IMAGE_MAX_BYTES,
  type BrandSaveResult,
  type CategoryBannerFile,
  type CategoryBannerResult,
  type CategoryBannerUpload,
  type CategoryTree,
  type TaxonomySave,
  type TaxonomySaveResult,
} from "@tronic/api-contracts";
import type { Db, Row } from "../db";
import { imageTypeOf } from "./products";

/**
 * Categories and brands (migration 0018) for the country admin API: the
 * whole tree with product counts, and the changes administrators make.
 * Runs as service_role through the caller's `withServiceAccess`.
 */

type Json = Record<string, unknown>;
type ServiceAccess = <T>(db: Db, fn: (tx: Db) => Promise<T>) => Promise<T>;

const iso = (value: unknown): string => new Date(String(value)).toISOString();
const text = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
const int = (value: unknown): number => {
  const n = typeof value === "string" && /^-?\d+$/.test(value) ? Number(value) : typeof value === "bigint" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isSafeInteger(n)) throw new Error("Unexpected database value: expected an integer");
  return n;
};
const list = (value: unknown): Json[] => (Array.isArray(value) ? (value as Json[]) : []);

function object(value: unknown): Json | null {
  const parsed: unknown = typeof value === "string" ? JSON.parse(value) : value;
  if (parsed === null || parsed === undefined) return null;
  if (typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Json;
  throw new Error("Unexpected database function result");
}

const node = (n: Json) => ({
  id: String(n.id),
  slug: String(n.slug),
  name: String(n.name),
  sortOrder: int(n.sort_order),
  active: n.active === true,
  products: int(n.products),
  live: int(n.live),
});

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function categoryFunctions(withServiceAccess: ServiceAccess) {
  async function call(db: Db, sql: string, params: readonly unknown[]): Promise<Json | null> {
    const [row] = await withServiceAccess(db, (tx) => tx.query<Row>(sql, params));
    return object(row?.result);
  }

  return {
    async tree(db: Db, country: string): Promise<CategoryTree> {
      const r = (await call(db, `select admin_category_tree($1::char(2)) as result`, [country])) ?? {};
      return {
        ok: true,
        categories: list(r.categories).map((c) => {
          const banner = object(c.banner);
          return {
            ...node(c),
            description: text(c.description),
            banner: banner ? { sha256: String(banner.sha256), updatedAt: iso(banner.updated_at) } : null,
            groups: list(c.groups).map((g) => ({ ...node(g), subcategories: list(g.subcategories).map(node) })),
          };
        }),
        brands: list(r.brands).map((b) => ({ id: String(b.id), slug: String(b.slug), name: String(b.name), products: int(b.products) })),
      };
    },

    async save(db: Db, country: string, change: TaxonomySave, actorId: string, requestId: string): Promise<TaxonomySaveResult> {
      const input = {
        ...(change.slug ? { slug: change.slug } : {}),
        name: change.name,
        description: change.description,
        sort_order: change.sortOrder,
        active: change.active,
      };
      // ::text::jsonb: postgres.js would otherwise send the JSON text as a JSON string.
      const r = await call(db, `select admin_save_taxonomy($1::char(2), $2, $3::uuid, $4::uuid, $5::text::jsonb, $6::uuid, $7::uuid) as result`, [
        country,
        change.level,
        change.id ?? null,
        change.parentId ?? null,
        JSON.stringify(input),
        actorId,
        requestId,
      ]);
      if (!r) throw new Error("admin_save_taxonomy returned nothing");
      if (r.ok === true) return { ok: true, replayed: r.replayed === true, id: String(r.id), slug: String(r.slug) };
      return { ok: false, code: r.code === "not_found" || r.code === "slug_taken" ? r.code : "invalid_request" };
    },

    async saveBrand(db: Db, country: string, brand: { id?: string | undefined; name: string }, actorId: string, requestId: string): Promise<BrandSaveResult> {
      const r = await call(db, `select admin_save_brand($1::char(2), $2::uuid, $3, $4::uuid, $5::uuid) as result`, [
        country,
        brand.id ?? null,
        brand.name,
        actorId,
        requestId,
      ]);
      if (!r) throw new Error("admin_save_brand returned nothing");
      if (r.ok === true) return { ok: true, replayed: r.replayed === true, id: String(r.id) };
      return { ok: false, code: r.code === "not_found" || r.code === "name_taken" ? r.code : "invalid_request" };
    },

    async setBanner(db: Db, country: string, categoryId: string, banner: CategoryBannerUpload, actorId: string, requestId: string): Promise<CategoryBannerResult> {
      let type: string | null = null;
      let bytes: Buffer | null = null;
      if (!("remove" in banner)) {
        bytes = Buffer.from(banner.data, "base64");
        if (
          bytes.length < 100 ||
          bytes.length > PRODUCT_IMAGE_MAX_BYTES ||
          bytes.toString("base64").replace(/=+$/, "") !== banner.data.replace(/=+$/, "") ||
          imageTypeOf(bytes) !== banner.contentType
        ) {
          return { ok: false, code: "invalid_request" };
        }
        type = banner.contentType;
      }
      const r = await call(db, `select admin_set_category_banner($1::char(2), $2::uuid, $3, $4::bytea, $5::uuid, $6::uuid) as result`, [
        country,
        categoryId,
        type,
        bytes,
        actorId,
        requestId,
      ]);
      if (!r) throw new Error("admin_set_category_banner returned nothing");
      if (r.ok === true) return { ok: true, replayed: r.replayed === true };
      return { ok: false, code: r.code === "not_found" ? "not_found" : "invalid_request" };
    },

    async getBanner(db: Db, country: string, categoryId: string): Promise<CategoryBannerFile> {
      const r = await call(db, `select admin_get_category_banner($1::char(2), $2::uuid) as result`, [country, categoryId]);
      const contentType = IMAGE_TYPES.find((type) => type === r?.content_type);
      if (!r || !contentType || typeof r.data !== "string") return { ok: false, code: "not_found" };
      return { ok: true, file: { contentType, data: r.data.replace(/\s+/g, "") } };
    },
  };
}
