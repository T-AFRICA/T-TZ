import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  COUNTRY_ADMIN_API_PREFIX,
  catalogueOptionsResponseSchema,
  createServiceTokenSigner,
  createServiceTokenVerifier,
  productDetailResponseSchema,
  productImageAddResponseSchema,
  productImageResponseSchema,
  productListResponseSchema,
  productSaveResponseSchema,
  type CatalogueOptions,
  type ProductInput,
  type ServiceTokenSigner,
} from "@tronic/api-contracts";
import { getPublicProductImage, loadPublicProducts } from "../src/catalog";
import { ANON, withAccess } from "../src/db";
import { handleCountryAdminRequest, type CountryAdminResponse, type CountryAdminService } from "../src/country-admin";
import { createTestDatabase, type TestDatabase } from "../src/testing";

/**
 * Products from the Central Admin (migration 0016) through the country admin
 * API, on a disposable PGlite database with the SAMPLE catalogue. Requests
 * are signed with a key pair made up for this run and go through
 * handleCountryAdminRequest, as the storefront serves them.
 */

let t: TestDatabase;
let signer: ServiceTokenSigner;
let service: CountryAdminService;
let options: CatalogueOptions;

const MANAGER = "0b6f3a52-7c1e-4f0a-9a57-3d0a5d6b9e11";

/** A tiny file that starts like a PNG (the database checks type and size, not pixels). */
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 7)]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4, 1), Buffer.from("WEBP"), Buffer.alloc(200, 3)]);

async function send(method: "GET" | "POST", path: string, permission: string, body?: unknown, actorId = MANAGER): Promise<CountryAdminResponse> {
  const fullPath = `${COUNTRY_ADMIN_API_PREFIX}${path}`;
  const text = body === undefined ? "" : JSON.stringify(body);
  const token = await signer.sign({ countryCode: "TZ", actorId, permission, method, path: fullPath, body: text });
  return handleCountryAdminRequest(service, { method, path: fullPath, authorization: `Bearer ${token}`, body: text });
}

/** Sends the same signed request twice: the second must be a replay. */
async function sendTwice(method: "POST", path: string, permission: string, body: unknown) {
  const fullPath = `${COUNTRY_ADMIN_API_PREFIX}${path}`;
  const text = JSON.stringify(body);
  const token = await signer.sign({ countryCode: "TZ", actorId: MANAGER, permission, method, path: fullPath, body: text });
  const request = { method, path: fullPath, authorization: `Bearer ${token}`, body: text };
  return [await handleCountryAdminRequest(service, request), await handleCountryAdminRequest(service, request)] as const;
}

function lighting() {
  const category = options.categories.find((c) => c.slug === "lighting")!;
  const group = category.groups.find((g) => g.subcategories.length > 0)!;
  return { category, group, subcategory: group.subcategories[0]! };
}

function input(overrides: Partial<ProductInput> = {}): ProductInput {
  const { category, group, subcategory } = lighting();
  return {
    name: "Smart LED Bulb 12W",
    sku: "TZ-BULB-12W",
    description: "Warm white, E27.",
    brandId: options.brands[0]?.id ?? null,
    categoryId: category.id,
    groupId: group.id,
    subcategoryId: subcategory.id,
    variantLabel: "Wattage",
    priceMinor: 450_000,
    wasPriceMinor: 500_000,
    specifications: [
      { label: "Power", value: "12 W" },
      { label: "Base", value: "E27" },
    ],
    variants: ["9W", "12W"],
    colors: [{ name: "Warm white", swatch: "#FFE9B0" }],
    ...overrides,
  };
}

const publicSlugs = async () => (await loadPublicProducts(t.db, "TZ")).map((p) => p.slug);
const detail = async (slug: string) => {
  const parsed = productDetailResponseSchema.parse((await send("GET", `/products/${slug}`, "products.read")).body);
  if (!parsed.ok) throw new Error(`no product ${slug}`);
  return parsed.product;
};

beforeAll(async () => {
  t = await createTestDatabase();
  const keys = await generateKeyPair("ES256", { extractable: true });
  signer = await createServiceTokenSigner({ privateKeyPem: await exportPKCS8(keys.privateKey), keyId: "k1" });
  const verifier = await createServiceTokenVerifier({ countryCode: "TZ", publicKeysPem: { k1: await exportSPKI(keys.publicKey) } });
  service = { countryCode: "TZ", verifier, db: t.db };
  options = catalogueOptionsResponseSchema.parse((await send("GET", "/catalogue/options", "products.read")).body);
}, 60_000);

afterAll(async () => {
  await t.pg.close();
});

describe("who may change products", () => {
  it("customers and visitors cannot call the product functions; they only get photos of live products", async () => {
    for (const role of ["anon", "authenticated"]) {
      const callable = await t.db.query<{ name: string }>(
        `select p.proname as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and (p.proname like 'admin\\_%product%' or p.proname = 'admin_catalogue_options' or p.proname = 'catalogue_product_status')
            and has_function_privilege($1, p.oid, 'execute')`,
        [role],
      );
      expect(callable, role).toEqual([]);
      const tables = await t.db.query(
        `select c.relname from pg_class c where c.relname in ('product_image_files', 'catalogue_changes')
            and (has_table_privilege($1, c.oid, 'select') or has_table_privilege($1, c.oid, 'insert'))`,
        [role],
      );
      expect(tables, role).toEqual([]);
    }
    await expect(withAccess(t.db, ANON, (tx) => tx.query(`select admin_get_product('TZ', 'sample-led-panel')`))).rejects.toThrow(/permission denied/);
  });

  it("each change needs its own permission", async () => {
    expect(await send("POST", "/products", "products.read", { slug: "x-1", product: input() })).toMatchObject({ status: 401, body: { code: "wrong_permission" } });
    expect(await send("POST", "/products/sample-led-panel/status", "products.update", { publish: false })).toMatchObject({
      status: 401,
      body: { code: "wrong_permission" },
    });
    expect(await send("POST", "/products/sample-led-panel/stock", "products.update", { available: 3 })).toMatchObject({ status: 401 });
  });
});

describe("the catalogue for administrators", () => {
  it("gives the form's choices: categories with their groups and subcategories, brands, the currency", () => {
    expect(options).toMatchObject({ currency: "TZS", currencyExponent: 2 });
    expect(options.categories.map((c) => c.slug)).toContain("lighting");
    expect(lighting().subcategory.slug).toBeTruthy();
  });

  it("lists every product with its status, price, stock and the SAMPLE mark; filters and searches", async () => {
    const all = productListResponseSchema.parse((await send("GET", "/products", "products.read")).body);
    expect(all.total).toBeGreaterThan(30);
    expect(all.counts.live).toBe(all.total);
    const panel = productListResponseSchema.parse((await send("GET", "/products?q=panel", "products.read")).body);
    expect(panel.products.map((p) => p.slug)).toContain("sample-led-panel");
    expect(panel.products.find((p) => p.slug === "sample-led-panel")).toMatchObject({ status: "live", sample: true, priceMinor: 2_800_000, available: 25 });
    const bySku = productListResponseSchema.parse((await send("GET", "/products?q=SAMPLE-LED-PANEL", "products.read")).body);
    expect(bySku.products.map((p) => p.slug)).toEqual(["sample-led-panel"]);
    const lightingOnly = productListResponseSchema.parse((await send("GET", "/products?category=lighting", "products.read")).body);
    expect(lightingOnly.products.every((p) => p.categoryName === "Lighting")).toBe(true);
    expect(await send("GET", "/products?status=archived", "products.read")).toMatchObject({ status: 400 });
  });
});

describe("a new product, from draft to live and back", () => {
  it("starts as a hidden draft, needs a photo before it goes live, then shows on the storefront", async () => {
    const created = productSaveResponseSchema.parse((await send("POST", "/products", "products.create", { slug: "smart-led-bulb-12w", product: input() })).body);
    expect(created).toEqual({ ok: true, replayed: false, slug: "smart-led-bulb-12w", status: "draft" });
    expect(await publicSlugs()).not.toContain("smart-led-bulb-12w");

    const draft = await detail("smart-led-bulb-12w");
    expect(draft).toMatchObject({
      sku: "TZ-BULB-12W",
      status: "draft",
      priceMinor: 450_000,
      wasPriceMinor: 500_000,
      available: 0,
      sample: false,
      variants: ["9W", "12W"],
      colors: [{ name: "Warm white", swatch: "#ffe9b0" }],
      specifications: [
        { label: "Power", value: "12 W" },
        { label: "Base", value: "E27" },
      ],
    });
    expect(draft.history.map((h) => h.action)).toEqual(["product.create"]);

    // No photo yet: refused, and it says what is missing.
    expect((await send("POST", "/products/smart-led-bulb-12w/status", "products.publish", { publish: true })).body).toEqual({
      ok: false,
      code: "not_ready",
      missing: ["image"],
    });

    const added = productImageAddResponseSchema.parse(
      (await send("POST", "/products/smart-led-bulb-12w/images", "products.update", { contentType: "image/png", data: PNG.toString("base64"), alt: "Bulb" })).body,
    );
    if (!added.ok) throw new Error("photo refused");
    // A draft's photo is not public yet.
    expect(await getPublicProductImage(t.db, added.imageId)).toBeNull();
    const asAdmin = productImageResponseSchema.parse((await send("GET", `/products/smart-led-bulb-12w/images/${added.imageId}`, "products.read")).body);
    expect(asAdmin).toEqual({ ok: true, url: `/media/products/${added.imageId}`, file: { contentType: "image/png", data: PNG.toString("base64") } });

    expect((await send("POST", "/products/smart-led-bulb-12w/status", "products.publish", { publish: true })).body).toMatchObject({ ok: true, status: "live" });
    expect(await publicSlugs()).toContain("smart-led-bulb-12w");
    const live = (await loadPublicProducts(t.db, "TZ")).find((p) => p.slug === "smart-led-bulb-12w")!;
    expect(live).toMatchObject({ image: `/media/products/${added.imageId}`, priceMinor: 450_000, wasPriceMinor: 500_000, inStock: false });
    const served = await getPublicProductImage(t.db, added.imageId);
    expect(served?.contentType).toBe("image/png");
    expect(Buffer.from(served!.bytes).equals(PNG)).toBe(true);
  });

  it("edits apply once per request, and the storefront sees the new price and stock", async () => {
    const [first, again] = await sendTwice("POST", "/products/smart-led-bulb-12w", "products.update", {
      product: input({ priceMinor: 420_000, wasPriceMinor: null, specifications: [{ label: "Power", value: "12 W" }], variants: [] }),
    });
    expect(first.body).toEqual({ ok: true, replayed: false, slug: "smart-led-bulb-12w", status: "live" });
    expect(again.body).toEqual({ ok: true, replayed: true, slug: "smart-led-bulb-12w", status: "live" });
    const [stock, stockAgain] = await sendTwice("POST", "/products/smart-led-bulb-12w/stock", "inventory.adjust", { available: 7 });
    expect(stock.body).toEqual({ ok: true, replayed: false, available: 7 });
    expect(stockAgain.body).toEqual({ ok: true, replayed: true, available: 7 });

    const live = (await loadPublicProducts(t.db, "TZ")).find((p) => p.slug === "smart-led-bulb-12w")!;
    expect(live.priceMinor).toBe(420_000);
    expect(live.wasPriceMinor).toBeUndefined();
    expect(live.inStock).toBe(true);
    expect(live.specifications).toEqual([{ label: "Power", value: "12 W" }]);
    const product = await detail("smart-led-bulb-12w");
    expect(product.history.map((h) => h.action)).toEqual(["product.stock", "product.update", "product.publish", "product.image_add", "product.create"]);
    expect(product.history.every((h) => h.actorId === MANAGER)).toBe(true);
  });

  it("photos are ordered and removed, but a live product keeps at least one", async () => {
    const second = productImageAddResponseSchema.parse(
      (await send("POST", "/products/smart-led-bulb-12w/images", "products.update", { contentType: "image/webp", data: WEBP.toString("base64") })).body,
    );
    if (!second.ok) throw new Error("photo refused");
    const before = await detail("smart-led-bulb-12w");
    const [firstId, secondId] = before.images.map((image) => image.id);
    expect(secondId).toBe(second.imageId);

    expect((await send("POST", "/products/smart-led-bulb-12w/images/arrange", "products.update", { keep: [secondId, firstId] })).body).toMatchObject({ ok: true });
    expect((await detail("smart-led-bulb-12w")).images.map((image) => image.id)).toEqual([secondId, firstId]);
    expect((await send("POST", "/products/smart-led-bulb-12w/images/arrange", "products.update", { keep: [] })).body).toEqual({ ok: false, code: "last_image" });
    expect((await send("POST", "/products/smart-led-bulb-12w/images/arrange", "products.update", { keep: [secondId] })).body).toMatchObject({ ok: true });
    expect((await detail("smart-led-bulb-12w")).images.map((image) => image.id)).toEqual([secondId]);
    // The removed photo is gone everywhere.
    expect(await getPublicProductImage(t.db, firstId!)).toBeNull();
    // Another product's photo cannot be kept here.
    const panel = await detail("sample-led-panel");
    expect((await send("POST", "/products/smart-led-bulb-12w/images/arrange", "products.update", { keep: [secondId, panel.images[0]!.id] })).body).toEqual({
      ok: false,
      code: "invalid_request",
    });
  });

  it("hiding takes it off the storefront and its photos with it; publishing brings both back", async () => {
    const photo = (await detail("smart-led-bulb-12w")).images[0]!.id;
    expect((await send("POST", "/products/smart-led-bulb-12w/status", "products.publish", { publish: false })).body).toMatchObject({ ok: true, status: "hidden" });
    expect(await publicSlugs()).not.toContain("smart-led-bulb-12w");
    expect(await getPublicProductImage(t.db, photo)).toBeNull();
    expect((await send("POST", "/products/smart-led-bulb-12w/status", "products.publish", { publish: true })).body).toMatchObject({ ok: true, status: "live" });
    expect(await getPublicProductImage(t.db, photo)).not.toBeNull();
    // A sample product that was live is "hidden" once taken off, not "draft".
    expect((await send("POST", "/products/sample-top-plug/status", "products.publish", { publish: false })).body).toMatchObject({ ok: true, status: "hidden" });
    await send("POST", "/products/sample-top-plug/status", "products.publish", { publish: true });
  });
});

describe("what the country refuses", () => {
  it("taken slugs and SKUs, a group of another category, an earlier price below the price, bad lists", async () => {
    const save = async (slug: string, product: ProductInput) => (await send("POST", "/products", "products.create", { slug, product })).body;
    expect(await save("smart-led-bulb-12w", input({ sku: "TZ-OTHER-1" }))).toEqual({ ok: false, code: "slug_taken" });
    expect(await save("another-bulb", input())).toEqual({ ok: false, code: "sku_taken" });
    const other = options.categories.find((c) => c.slug !== "lighting" && c.groups.length > 0)!;
    expect(await save("another-bulb", input({ sku: "TZ-OTHER-2", groupId: other.groups[0]!.id, subcategoryId: null }))).toEqual({ ok: false, code: "invalid_category" });
    expect(await save("another-bulb", input({ sku: "TZ-OTHER-3", brandId: "00000000-0000-4000-8000-000000000000" }))).toEqual({ ok: false, code: "invalid_brand" });
    // Rejected by the shared rules before the database: a "was" price under the price, a repeated variant, a bad slug.
    expect(await save("another-bulb", input({ sku: "TZ-OTHER-4", wasPriceMinor: 100 }))).toEqual({ ok: false, code: "invalid_request" });
    expect(await save("another-bulb", input({ sku: "TZ-OTHER-5", variants: ["9W", "9w"] }))).toEqual({ ok: false, code: "invalid_request" });
    expect(await save("Another Bulb", input({ sku: "TZ-OTHER-6" }))).toEqual({ ok: false, code: "invalid_request" });
    // The database checks again what the API would not let through.
    const direct = await t.db.query<{ result: unknown }>(`select admin_save_product('TZ', null, $1::jsonb, $2::uuid, gen_random_uuid()) as result`, [
      JSON.stringify({ slug: "direct", name: "Direct", sku: "TZ-DIRECT", category_id: lighting().category.id, price_minor: 100, was_price_minor: 50 }),
      MANAGER,
    ]);
    expect(direct[0]!.result).toEqual({ ok: false, code: "invalid_request" });
    const [{ n }] = (await t.db.query<{ n: number }>(`select count(*)::int as n from products where slug in ('another-bulb', 'direct')`)) as [{ n: number }];
    expect(n).toBe(0);
  });

  it("photos that are not what they say, too large, or one too many", async () => {
    const add = async (contentType: string, data: string) => (await send("POST", "/products/sample-led-panel/images", "products.update", { contentType, data })).body;
    expect(await add("image/jpeg", PNG.toString("base64"))).toEqual({ ok: false, code: "invalid_request" });
    expect(await add("image/png", Buffer.alloc(50, 1).toString("base64"))).toEqual({ ok: false, code: "invalid_request" });
    expect(await add("image/png", Buffer.concat([PNG, Buffer.alloc(1_048_576)]).toString("base64"))).toEqual({ ok: false, code: "invalid_request" });
    for (let i = (await detail("sample-led-panel")).images.length; i < 12; i++) {
      expect(await add("image/png", PNG.toString("base64"))).toMatchObject({ ok: true });
    }
    expect(await add("image/png", PNG.toString("base64"))).toEqual({ ok: false, code: "too_many_images" });
  });

  it("an unknown product is not found, whatever is asked", async () => {
    expect((await send("GET", "/products/no-such-thing", "products.read")).body).toEqual({ ok: false, code: "not_found" });
    expect((await send("POST", "/products/no-such-thing", "products.update", { product: input({ sku: "TZ-NONE" }) })).body).toEqual({ ok: false, code: "not_found" });
    expect((await send("POST", "/products/no-such-thing/status", "products.publish", { publish: true })).body).toEqual({ ok: false, code: "not_found" });
    expect((await send("GET", "/products/Not%20A%20Slug", "products.read")).body).toEqual({ ok: false, code: "not_found" });
  });
});
