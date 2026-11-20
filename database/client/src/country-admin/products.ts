import {
  PRODUCT_IMAGE_MAX_BYTES,
  PRODUCT_PAGE_SIZE,
  PRODUCT_READINESS,
  PRODUCT_STATUSES,
  SAMPLE_SKU_PREFIX,
  type CatalogueOptions,
  type ProductDetailResponse,
  type ProductImageAddResult,
  type ProductImageArrangeResult,
  type ProductImageResponse,
  type ProductImageUpload,
  type ProductInput,
  type ProductList,
  type ProductSaveResult,
  type ProductStatus,
  type ProductStatusResult,
  type ProductStockResult,
} from "@tronic/api-contracts";
import type { Db, Row } from "../db";

/**
 * Products (migration 0016) for the country admin API: the catalogue as
 * administrators see it, and the changes they may make. Every function
 * runs as service_role through the caller's `withServiceAccess`.
 */

type Json = Record<string, unknown>;
type ServiceAccess = <T>(db: Db, fn: (tx: Db) => Promise<T>) => Promise<T>;

const iso = (value: unknown): string => new Date(String(value)).toISOString();
const isoOrNull = (value: unknown): string | null => (value === null || value === undefined ? null : iso(value));
const text = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
const int = (value: unknown): number => {
  const n = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : typeof value === "bigint" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isSafeInteger(n) || n < 0) throw new Error("Unexpected database value: expected a non-negative integer");
  return n;
};
const intOrNull = (value: unknown): number | null => (value === null || value === undefined ? null : int(value));
const list = (value: unknown): Json[] => (Array.isArray(value) ? (value as Json[]) : []);
const status = (value: unknown): ProductStatus => {
  const found = PRODUCT_STATUSES.find((candidate) => candidate === value);
  if (!found) throw new Error("Unexpected product status");
  return found;
};
const isSample = (sku: unknown) => String(sku).startsWith(SAMPLE_SKU_PREFIX);

function object(value: unknown): Json | null {
  const parsed: unknown = typeof value === "string" ? JSON.parse(value) : value;
  if (parsed === null || parsed === undefined) return null;
  if (typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Json;
  throw new Error("Unexpected database function result");
}

/** The form's product as the database function takes it (snake_case, in minor units). */
function toDatabaseInput(product: ProductInput, slug?: string): Json {
  return {
    ...(slug ? { slug } : {}),
    name: product.name,
    sku: product.sku,
    description: product.description,
    brand_id: product.brandId,
    category_id: product.categoryId,
    group_id: product.groupId,
    subcategory_id: product.subcategoryId,
    variant_label: product.variantLabel,
    price_minor: product.priceMinor,
    was_price_minor: product.wasPriceMinor,
    specifications: product.specifications,
    variants: product.variants,
    colors: product.colors,
  };
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const SAVE_CODES =["invalid_request", "not_found", "slug_taken", "sku_taken", "invalid_category", "invalid_brand"] as const;

export function productFunctions(withServiceAccess: ServiceAccess) {
  async function call(db: Db, sql: string, params: readonly unknown[]): Promise<Json | null> {
    const [row] = await withServiceAccess(db, (tx) => tx.query<Row>(sql, params));
    return object(row?.result);
  }

  function saveResult(r: Json | null): ProductSaveResult {
    if (!r) throw new Error("admin_save_product returned nothing");
    if (r.ok === true) return { ok: true, replayed: r.replayed === true, slug: String(r.slug), status: status(r.status) };
    return { ok: false, code: SAVE_CODES.find((code) => code === r.code) ?? "invalid_request" };
  }

  return {
    async options(db: Db, country: string): Promise<CatalogueOptions> {
      const r = await call(db, `select admin_catalogue_options($1::char(2)) as result`, [country]);
      if (!r) throw new Error("admin_catalogue_options returned nothing");
      return {
        ok: true,
        currency: String(r.currency).trim(),
        currencyExponent: int(r.currency_exponent),
        categories: list(r.categories).map((category) => ({
          id: String(category.id),
          slug: String(category.slug),
          name: String(category.name),
          active: category.active === true,
          groups: list(category.groups).map((group) => ({
            id: String(group.id),
            slug: String(group.slug),
            name: String(group.name),
            active: group.active === true,
            subcategories: list(group.subcategories).map((sub) => ({
              id: String(sub.id),
              slug: String(sub.slug),
              name: String(sub.name),
              active: sub.active === true,
            })),
          })),
        })),
        brands: list(r.brands).map((brand) => ({ id: String(brand.id), name: String(brand.name) })),
      };
    },

    async list(
      db: Db,
      country: string,
      query: { q?: string | undefined; category?: string | undefined; status?: ProductStatus | undefined; page: number },
    ): Promise<ProductList> {
      const r = (await call(db, `select admin_list_products($1::char(2), $2, $3, $4, $5::integer, $6::integer) as result`, [
        country,
        query.q ?? null,
        query.category ?? null,
        query.status ?? null,
        PRODUCT_PAGE_SIZE,
        (query.page - 1) * PRODUCT_PAGE_SIZE,
      ])) ?? {};
      const counts = (r.counts ?? {}) as Record<string, unknown>;
      return {
        ok: true,
        total: int(r.total),
        page: query.page,
        pageSize: PRODUCT_PAGE_SIZE,
        counts: Object.fromEntries(Object.entries(counts).map(([key, n]) => [status(key), int(n)])),
        currency: String(r.currency).trim(),
        currencyExponent: int(r.currency_exponent),
        products: list(r.products).map((p) => {
          const image = object(p.image);
          return {
            slug: String(p.slug),
            sku: String(p.sku),
            name: String(p.name),
            status: status(p.status),
            categoryName: String(p.category_name),
            brandName: text(p.brand_name),
            priceMinor: intOrNull(p.price_minor),
            wasPriceMinor: intOrNull(p.was_price_minor),
            available: intOrNull(p.available),
            image: image ? { id: String(image.id), url: String(image.url) } : null,
            sample: isSample(p.sku),
            updatedAt: iso(p.updated_at),
          };
        }),
      };
    },

    async get(db: Db, country: string, slug: string): Promise<ProductDetailResponse> {
      const p = await call(db, `select admin_get_product($1::char(2), $2) as result`, [country, slug]);
      if (!p) return { ok: false, code: "not_found" };
      return {
        ok: true,
        product: {
          slug: String(p.slug),
          sku: String(p.sku),
          name: String(p.name),
          description: text(p.description),
          brandId: text(p.brand_id),
          categoryId: String(p.category_id),
          groupId: text(p.group_id),
          subcategoryId: text(p.subcategory_id),
          variantLabel: text(p.variant_label),
          status: status(p.status),
          publishedAt: isoOrNull(p.published_at),
          createdAt: iso(p.created_at),
          updatedAt: iso(p.updated_at),
          currency: String(p.currency).trim(),
          currencyExponent: int(p.currency_exponent),
          priceMinor: intOrNull(p.price_minor),
          wasPriceMinor: intOrNull(p.was_price_minor),
          available: intOrNull(p.available),
          sample: isSample(p.sku),
          images: list(p.images).map((image) => ({
            id: String(image.id),
            url: String(image.url),
            alt: text(image.alt),
            uploaded: image.uploaded === true,
          })),
          specifications: list(p.specifications).map((spec) => ({ label: String(spec.label), value: String(spec.value) })),
          variants: (Array.isArray(p.variants) ? p.variants : []).map(String),
          colors: list(p.colors).map((color) => ({ name: String(color.name), swatch: String(color.swatch) })),
          history: list(p.history).map((change) => ({
            action: String(change.action),
            actorId: String(change.actor_id),
            createdAt: iso(change.created_at),
            detail: object(change.detail) ?? {},
          })),
        },
      };
    },

    async create(db: Db, country: string, slug: string, product: ProductInput, actorId: string, requestId: string): Promise<ProductSaveResult> {
      return saveResult(
        // ::text::jsonb: postgres.js would otherwise send the JSON text as a JSON string.
        await call(db, `select admin_save_product($1::char(2), null, $2::text::jsonb, $3::uuid, $4::uuid) as result`, [
          country,
          JSON.stringify(toDatabaseInput(product, slug)),
          actorId,
          requestId,
        ]),
      );
    },

    async update(db: Db, country: string, slug: string, product: ProductInput, actorId: string, requestId: string): Promise<ProductSaveResult> {
      return saveResult(
        await call(db, `select admin_save_product($1::char(2), $2, $3::text::jsonb, $4::uuid, $5::uuid) as result`, [
          country,
          slug,
          JSON.stringify(toDatabaseInput(product)),
          actorId,
          requestId,
        ]),
      );
    },

    async setStatus(db: Db, country: string, slug: string, publish: boolean, actorId: string, requestId: string): Promise<ProductStatusResult> {
      const r = await call(db, `select admin_set_product_status($1::char(2), $2, $3, $4::uuid, $5::uuid) as result`, [
        country,
        slug,
        publish,
        actorId,
        requestId,
      ]);
      if (!r) throw new Error("admin_set_product_status returned nothing");
      if (r.ok === true) return { ok: true, replayed: r.replayed === true, status: status(r.status) };
      if (r.code === "not_ready") {
        const missing = (Array.isArray(r.missing) ? r.missing : []).flatMap((item) => PRODUCT_READINESS.filter((known) => known === item));
        return { ok: false, code: "not_ready", missing };
      }
      return { ok: false, code: r.code === "not_found" ? "not_found" : "invalid_request" };
    },

    async setStock(db: Db, country: string, slug: string, available: number, actorId: string, requestId: string): Promise<ProductStockResult> {
      const r = await call(db, `select admin_set_product_stock($1::char(2), $2, $3::integer, $4::uuid, $5::uuid) as result`, [
        country,
        slug,
        available,
        actorId,
        requestId,
      ]);
      if (!r) throw new Error("admin_set_product_stock returned nothing");
      if (r.ok === true) return { ok: true, replayed: r.replayed === true, available: int(r.available) };
      return { ok: false, code: r.code === "not_found" ? "not_found" : "invalid_request" };
    },

    async addImage(db: Db, country: string, slug: string, image: ProductImageUpload, actorId: string, requestId: string): Promise<ProductImageAddResult> {
      const bytes = Buffer.from(image.data, "base64");
      // Valid base64 of a file of the stated type, within the limit; anything else is refused unread.
      if (
        bytes.length < 100 ||
        bytes.length > PRODUCT_IMAGE_MAX_BYTES ||
        bytes.toString("base64").replace(/=+$/, "") !== image.data.replace(/=+$/, "") ||
        imageTypeOf(bytes) !== image.contentType
      ) {
        return { ok: false, code: "invalid_request" };
      }
      const r = await call(db, `select admin_add_product_image($1::char(2), $2, $3, $4::bytea, $5, $6::uuid, $7::uuid) as result`, [
        country,
        slug,
        image.contentType,
        bytes,
        image.alt ?? null,
        actorId,
        requestId,
      ]);
      if (!r) throw new Error("admin_add_product_image returned nothing");
      if (r.ok === true) return { ok: true, replayed: r.replayed === true, imageId: String(r.image_id) };
      return { ok: false, code: r.code === "not_found" || r.code === "too_many_images" ? r.code : "invalid_request" };
    },

    async arrangeImages(db: Db, country: string, slug: string, keep: readonly string[], actorId: string, requestId: string): Promise<ProductImageArrangeResult> {
      const r = await call(db, `select admin_arrange_product_images($1::char(2), $2, $3::uuid[], $4::uuid, $5::uuid) as result`, [
        country,
        slug,
        keep,
        actorId,
        requestId,
      ]);
      if (!r) throw new Error("admin_arrange_product_images returned nothing");
      if (r.ok === true) return { ok: true, replayed: r.replayed === true };
      return { ok: false, code: r.code === "not_found" || r.code === "last_image" ? r.code : "invalid_request" };
    },

    async getImage(db: Db, country: string, slug: string, imageId: string): Promise<ProductImageResponse> {
      const r = await call(db, `select admin_get_product_image($1::char(2), $2, $3::uuid) as result`, [country, slug, imageId]);
      if (!r) return { ok: false, code: "not_found" };
      const contentType = IMAGE_TYPES.find((type) => type === r.content_type);
      const file = contentType && typeof r.data === "string" ? { contentType, data: r.data.replace(/\s+/g, "") } : null;
      return { ok: true, url: String(r.url), file };
    },
  };
}

/** The first bytes of a JPEG, PNG or WebP file, so a photo is what it says it is. */
export function imageTypeOf(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte)) return "image/png";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!) === "RIFF" &&
    String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}
