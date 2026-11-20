import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { DatabaseCatalogClient, getPublicProductImage } from "../src/catalog";
import { withServiceAccess } from "../src/country-admin";
import { inventoryFunctions } from "../src/country-admin/inventory";
import { productFunctions } from "../src/country-admin/products";
import type { Db } from "../src/db";
import { placeCodOrder, trackOrder } from "../src/orders";
import { createPostgresDb } from "../src/postgres-db";
import { createShopper, createTestDatabase, type TestDatabase } from "../src/testing";

/**
 * The app reaches Postgres through postgres.js (DATABASE_URL), not PGlite's
 * in-process API. These tests run the same calls through postgres.js over
 * the Postgres wire protocol (PGlite served on a local socket), so driver
 * details (parameter types, int8 as text, transactions) are covered too.
 */
let t: TestDatabase;
let server: PGLiteSocketServer;
let db: Db;
const PORT = 54399;

beforeAll(async () => {
  t = await createTestDatabase();
  server = new PGLiteSocketServer({ db: t.pg, port: PORT, host: "127.0.0.1" });
  await server.start();
  db = createPostgresDb(`postgres://postgres:postgres@127.0.0.1:${PORT}/postgres`, { max: 1 });
}, 60_000);

afterAll(async () => {
  await server.stop();
  await t.pg.close();
});

describe("postgres.js driver", () => {
  it("reads the public catalogue with prices in minor units", async () => {
    const product = await new DatabaseCatalogClient(db, { cacheMs: 0 }).getProduct("sample-led-panel", "TZ");
    expect(product).toMatchObject({ priceMinor: 2_800_000, currency: "TZS", inStock: true });
  });

  it("places and tracks a Cash on Delivery order", async () => {
    const result = await placeCodOrder(
      db,
      await createShopper(t.db),
      {
        idempotencyKey: randomUUID(),
        country: "TZ",
        contact: { name: "Asha Mrema", email: "driver@example.test", phone: "+255712345678" },
        delivery: { method: "home", region: "Dar es Salaam", district: "Kinondoni", ward: "Mikocheni", street: "Plot 12, Mwai Kibaki Road", extra: "", notes: "" },
        lines: [{ product: "sample-led-panel", color: null, variant: null, quantity: 1 }],
        expectedTotalMinor: 2_800_000,
      },
    );
    expect(result).toMatchObject({ ok: true, totalMinor: 2_800_000 });
    if (!result.ok) return;
    expect(await trackOrder(db, result.orderNumber, "driver@example.test")).toMatchObject({ found: true, totalMinor: 2_800_000 });
  });

  it("saves a product with its lists, adds and arranges photos, and serves a live product's photo (jsonb, bytea, uuid[])", async () => {
    const products = productFunctions(withServiceAccess);
    const actor = randomUUID();
    const [place] = await t.db.query<{ category: string; group: string }>(
      `select g.category_id as category, g.id as "group" from category_groups g join categories c on c.id = g.category_id where c.slug = 'lighting' limit 1`,
    );
    const product = {
      name: "Driver Bulb",
      sku: "DRIVER-BULB",
      description: null,
      brandId: null,
      categoryId: place!.category,
      groupId: place!.group,
      subcategoryId: null,
      variantLabel: null,
      priceMinor: 990_000,
      wasPriceMinor: null,
      specifications: [{ label: "Power", value: "9 W" }],
      variants: ["9W"],
      colors: [],
    };
    expect(await products.create(db, "TZ", "driver-bulb", product, actor, randomUUID())).toMatchObject({ ok: true, slug: "driver-bulb", status: "draft" });
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(300, 9)]);
    const first = await products.addImage(db, "TZ", "driver-bulb", { contentType: "image/png", data: png.toString("base64") }, actor, randomUUID());
    const second = await products.addImage(db, "TZ", "driver-bulb", { contentType: "image/png", data: png.toString("base64") }, actor, randomUUID());
    if (!first.ok || !second.ok) throw new Error("photo refused");
    expect(await products.arrangeImages(db, "TZ", "driver-bulb", [second.imageId, first.imageId], actor, randomUUID())).toMatchObject({ ok: true });
    expect(await products.update(db, "TZ", "driver-bulb", { ...product, priceMinor: 950_000 }, actor, randomUUID())).toMatchObject({ ok: true });
    expect(await products.setStatus(db, "TZ", "driver-bulb", true, actor, randomUUID())).toMatchObject({ ok: true, status: "live" });
    const detail = await products.get(db, "TZ", "driver-bulb");
    expect(detail).toMatchObject({ ok: true, product: { priceMinor: 950_000, variants: ["9W"], specifications: [{ label: "Power", value: "9 W" }] } });
    if (detail.ok) expect(detail.product.images.map((image) => image.id)).toEqual([second.imageId, first.imageId]);
    const served = await getPublicProductImage(db, second.imageId);
    expect(Buffer.from(served!.bytes).equals(png)).toBe(true);

    // Inventory (0017) through the same driver: a change with its reason, the level, the history.
    const inventory = inventoryFunctions(withServiceAccess);
    expect(await inventory.adjust(db, "TZ", "driver-bulb", { mode: "add", quantity: 7, reason: "received", note: "Driver" }, actor, randomUUID())).toMatchObject({
      ok: true,
      available: 7,
      change: 7,
    });
    expect(await inventory.setLowStock(db, "TZ", "driver-bulb", 8)).toEqual({ ok: true, lowStockAt: 8 });
    const stock = await inventory.get(db, "TZ", "driver-bulb");
    expect(stock).toMatchObject({ ok: true, item: { available: 7, lowStockAt: 8, movements: [{ change: 7, reason: "received", note: "Driver", actorId: actor }] } });
    const low = await inventory.list(db, "TZ", { filter: "low", q: "driver", page: 1 });
    expect(low.items.map((entry) => entry.slug)).toEqual(["driver-bulb"]);
  });
});
