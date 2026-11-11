import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { DatabaseCatalogClient } from "../src/catalog";
import type { Db } from "../src/db";
import { placeCodOrder, trackOrder } from "../src/orders";
import { createPostgresDb } from "../src/postgres-db";
import { createTestDatabase, type TestDatabase } from "../src/testing";

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
      { role: "anon" },
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
});
