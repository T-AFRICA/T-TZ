import { randomUUID } from "node:crypto";
import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  COUNTRY_ADMIN_API_PREFIX,
  LOW_STOCK_THRESHOLD,
  countrySummarySchema,
  createServiceTokenSigner,
  createServiceTokenVerifier,
  inventoryDetailResponseSchema,
  inventoryListResponseSchema,
  type ServiceTokenSigner,
} from "@tronic/api-contracts";
import { loadPublicProducts } from "../src/catalog";
import { ANON, withAccess } from "../src/db";
import { handleCountryAdminRequest, type CountryAdminResponse, type CountryAdminService } from "../src/country-admin";
import { placeCodOrder } from "../src/orders";
import { createShopper, createTestDatabase, type TestDatabase } from "../src/testing";

/**
 * Inventory (migration 0017) through the country admin API, on a disposable
 * PGlite database with the SAMPLE catalogue (25 units of each in-stock
 * product): stock changes with reasons, per-product low-stock levels, and a
 * history that also shows what orders did.
 */

let t: TestDatabase;
let signer: ServiceTokenSigner;
let service: CountryAdminService;

const KEEPER = "0b6f3a52-7c1e-4f0a-9a57-3d0a5d6b9e11";

async function send(method: "GET" | "POST", path: string, permission: string, body?: unknown): Promise<CountryAdminResponse> {
  const fullPath = `${COUNTRY_ADMIN_API_PREFIX}${path}`;
  const text = body === undefined ? "" : JSON.stringify(body);
  const token = await signer.sign({ countryCode: "TZ", actorId: KEEPER, permission, method, path: fullPath, body: text });
  return handleCountryAdminRequest(service, { method, path: fullPath, authorization: `Bearer ${token}`, body: text });
}

const adjust = async (slug: string, body: unknown) => (await send("POST", `/inventory/${slug}/adjust`, "inventory.adjust", body)).body;
const item = async (slug: string) => {
  const parsed = inventoryDetailResponseSchema.parse((await send("GET", `/inventory/${slug}`, "inventory.read")).body);
  if (!parsed.ok) throw new Error(`no stock for ${slug}`);
  return parsed.item;
};
const inStock = async (slug: string) => (await loadPublicProducts(t.db, "TZ")).find((p) => p.slug === slug)?.inStock;

beforeAll(async () => {
  t = await createTestDatabase();
  const keys = await generateKeyPair("ES256", { extractable: true });
  signer = await createServiceTokenSigner({ privateKeyPem: await exportPKCS8(keys.privateKey), keyId: "k1" });
  const verifier = await createServiceTokenVerifier({ countryCode: "TZ", publicKeysPem: { k1: await exportSPKI(keys.publicKey) } });
  service = { countryCode: "TZ", verifier, db: t.db };
}, 60_000);

afterAll(async () => {
  await t.pg.close();
});

describe("who may see and change stock", () => {
  it("customers and visitors cannot; reading and changing need their own permissions", async () => {
    for (const role of ["anon", "authenticated"]) {
      const callable = await t.db.query(
        `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname in ('admin_list_inventory', 'admin_get_inventory', 'admin_adjust_stock', 'admin_set_low_stock')
            and has_function_privilege($1, p.oid, 'execute')`,
        [role],
      );
      expect(callable, role).toEqual([]);
      const table = await t.db.query(`select 1 from pg_class c where c.relname = 'stock_movements' and has_table_privilege($1, c.oid, 'select')`, [role]);
      expect(table, role).toEqual([]);
    }
    await expect(withAccess(t.db, ANON, (tx) => tx.query(`select * from stock_movements`))).rejects.toThrow(/permission denied/);
    expect(await send("POST", "/inventory/sample-led-panel/adjust", "inventory.read", { mode: "add", quantity: 1, reason: "received" })).toMatchObject({
      status: 401,
      body: { code: "wrong_permission" },
    });
    expect(await send("GET", "/inventory", "products.read")).toMatchObject({ status: 401 });
  });
});

describe("changing stock", () => {
  it("adds and removes units with a reason, sets a counted total, and records each change once", async () => {
    const before = (await item("sample-led-panel")).available;
    expect(before).toBe(25);
    expect(await adjust("sample-led-panel", { mode: "add", quantity: 20, reason: "received", note: "Supplier delivery 14" })).toEqual({
      ok: true,
      replayed: false,
      available: 45,
      change: 20,
    });
    expect(await adjust("sample-led-panel", { mode: "remove", quantity: 2, reason: "damaged" })).toMatchObject({ ok: true, available: 43, change: -2 });
    expect(await adjust("sample-led-panel", { mode: "set", quantity: 40, reason: "correction", note: "Shelf count" })).toMatchObject({ ok: true, available: 40, change: -3 });

    // The same signed request twice changes the stock once.
    const path = `${COUNTRY_ADMIN_API_PREFIX}/inventory/sample-led-panel/adjust`;
    const text = JSON.stringify({ mode: "add", quantity: 5, reason: "returned" });
    const token = await signer.sign({ countryCode: "TZ", actorId: KEEPER, permission: "inventory.adjust", method: "POST", path, body: text });
    const request = { method: "POST", path, authorization: `Bearer ${token}`, body: text };
    expect((await handleCountryAdminRequest(service, request)).body).toMatchObject({ ok: true, replayed: false, available: 45 });
    expect((await handleCountryAdminRequest(service, request)).body).toMatchObject({ ok: true, replayed: true, available: 45 });

    const panel = await item("sample-led-panel");
    expect(panel.available).toBe(45);
    expect(panel.movements.map((m) => [m.change, m.reason, m.availableAfter])).toEqual([
      [5, "returned", 45],
      [-3, "correction", 40],
      [-2, "damaged", 43],
      [20, "received", 45],
    ]);
    expect(panel.movements[3]).toMatchObject({ note: "Supplier delivery 14", actorId: KEEPER, orderNumber: null });
  });

  it("never goes below zero, refuses a change that changes nothing, and wants a fitting reason", async () => {
    expect(await adjust("sample-top-plug", { mode: "remove", quantity: 26, reason: "lost" })).toEqual({ ok: false, code: "not_enough", available: 25 });
    expect(await adjust("sample-top-plug", { mode: "set", quantity: 25, reason: "correction" })).toEqual({ ok: false, code: "no_change", available: 25 });
    expect(await adjust("sample-top-plug", { mode: "add", quantity: 1, reason: "damaged" })).toEqual({ ok: false, code: "invalid_request" });
    expect(await adjust("sample-top-plug", { mode: "remove", quantity: 1, reason: "other" })).toEqual({ ok: false, code: "invalid_request" });
    expect(await adjust("sample-top-plug", { mode: "add", quantity: 0, reason: "received" })).toEqual({ ok: false, code: "invalid_request" });
    expect(await adjust("no-such-product", { mode: "add", quantity: 1, reason: "received" })).toEqual({ ok: false, code: "not_found" });
    expect((await item("sample-top-plug")).movements).toEqual([]);
  });

  it("the storefront follows: no units means out of stock, units back means in stock", async () => {
    expect(await inStock("sample-extension")).toBe(true);
    expect(await adjust("sample-extension", { mode: "set", quantity: 0, reason: "correction" })).toMatchObject({ ok: true, available: 0 });
    expect(await inStock("sample-extension")).toBe(false);
    expect(await adjust("sample-extension", { mode: "add", quantity: 3, reason: "received" })).toMatchObject({ ok: true, available: 3 });
    expect(await inStock("sample-extension")).toBe(true);
  });
});

describe("what orders do to the stock", () => {
  it("an order takes its units and a cancellation gives them back, each with its order number", async () => {
    const shopper = await createShopper(t.db);
    const placed = await placeCodOrder(t.db, shopper, {
      idempotencyKey: randomUUID(),
      country: "TZ",
      contact: { name: "Asha Mrema", email: "asha@example.test", phone: "+255712345678" },
      delivery: { method: "home", region: "Dar es Salaam", district: "Kinondoni", ward: "Mikocheni", street: "Plot 12", extra: "", notes: "" },
      lines: [{ product: "sample-top-plug", color: null, variant: null, quantity: 3 }],
      expectedTotalMinor: null,
    });
    if (!placed.ok) throw new Error("order failed");
    let plug = await item("sample-top-plug");
    expect(plug.available).toBe(22);
    expect(plug.movements[0]).toMatchObject({ change: -3, reason: "order", availableAfter: 22, orderNumber: placed.orderNumber, actorId: null });

    expect((await send("POST", `/orders/${placed.orderNumber}/status`, "orders.update", { status: "cancelled" })).body).toMatchObject({ ok: true });
    plug = await item("sample-top-plug");
    expect(plug.available).toBe(25);
    expect(plug.movements[0]).toMatchObject({ change: 3, reason: "order_cancelled", availableAfter: 25, orderNumber: placed.orderNumber });
    expect(plug.movements).toHaveLength(2);
  });
});

describe("low stock", () => {
  it("each product has its own level; the list and the dashboard count with it", async () => {
    const all = inventoryListResponseSchema.parse((await send("GET", "/inventory", "inventory.read")).body);
    expect(all.counts.all).toBeGreaterThan(30);
    // sample-extension has 3 left: low at the default level of 5.
    const low = inventoryListResponseSchema.parse((await send("GET", "/inventory?filter=low", "inventory.read")).body);
    expect(low.items.map((i) => i.slug)).toContain("sample-extension");
    expect(low.items.every((i) => i.level === "low" && i.available >= 1 && i.available <= i.lowStockAt)).toBe(true);
    const out = inventoryListResponseSchema.parse((await send("GET", "/inventory?filter=out", "inventory.read")).body);
    expect(out.items.every((i) => i.available === 0 && i.level === "out")).toBe(true);
    expect(out.items.map((i) => i.slug)).toContain("sample-armoured-cable");
    // Out first, then low, then the rest.
    expect(all.items[0]!.level).toBe("out");

    const summary = async () => countrySummarySchema.parse((await send("GET", "/summary", "reports.read")).body);
    const lowBefore = (await summary()).productsLowStock;
    // A cable sells by the metre: low below 50.
    expect((await send("POST", "/inventory/sample-led-panel/low-stock", "inventory.adjust", { level: 50 })).body).toEqual({ ok: true, lowStockAt: 50 });
    expect((await item("sample-led-panel")).lowStockAt).toBe(50);
    expect((await summary()).productsLowStock).toBe(lowBefore + 1);
    expect((await summary()).lowStockThreshold).toBe(LOW_STOCK_THRESHOLD);
    // Level 0: never "low".
    await send("POST", "/inventory/sample-extension/low-stock", "inventory.adjust", { level: 0 });
    const lowAfter = inventoryListResponseSchema.parse((await send("GET", "/inventory?filter=low&q=extension", "inventory.read")).body);
    expect(lowAfter.items.map((i) => i.slug)).not.toContain("sample-extension");
    expect((await send("POST", "/inventory/sample-extension/low-stock", "inventory.adjust", { level: -1 })).body).toEqual({ ok: false, code: "invalid_request" });
    expect((await send("GET", "/inventory?filter=empty", "inventory.read")).status).toBe(400);
  });

  it("setting the stock from the product page (0016) lands in the history as a correction", async () => {
    expect((await send("POST", "/products/sample-led-panel/stock", "inventory.adjust", { available: 12 })).body).toMatchObject({ ok: true, available: 12 });
    expect((await item("sample-led-panel")).movements[0]).toMatchObject({ change: -33, reason: "correction", availableAfter: 12, actorId: KEEPER });
  });
});
