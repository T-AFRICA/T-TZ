import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildSampleCatalogueSql } from "../scripts/catalogue-sql";
import { ANON } from "../src/db";
import { placeCodOrder } from "../src/orders";
import { createTestDatabase, migrationsDir, type TestDatabase } from "../src/testing";

/**
 * The SAMPLE catalogue script for a new Supabase project
 * (scripts/catalogue-sql.ts): generated from a seeded database, then run
 * against a second database that has only the migrations, as an owner
 * would in the SQL editor. The second database must end up with the same
 * storefront catalogue, accept an order, and refuse a second run.
 *
 * The script is also written to database/out/sample-catalogue.sql (not
 * committed), which is the file to paste into the SQL editor.
 */
const OUT_FILE = join(dirname(migrationsDir()), "out", "sample-catalogue.sql");

let source: TestDatabase;
let target: TestDatabase;
let script = "";

const storefront = (t: TestDatabase) => t.db.query(`select * from storefront_products order by country_code, slug`);
const count = async (t: TestDatabase, table: string) => (await t.db.query<{ n: number }>(`select count(*)::int as n from ${table}`))[0]!.n;

beforeAll(async () => {
  source = await createTestDatabase();
  target = await createTestDatabase({ seed: false });
  script = await buildSampleCatalogueSql(source.db);
  mkdirSync(dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, script, "utf8");
}, 120_000);

afterAll(async () => {
  await source.pg.close();
  await target.pg.close();
});

describe("sample catalogue script", () => {
  it("says what it is and never touches customer or order tables", () => {
    expect(script).toMatch(/^-- SAMPLE catalogue/);
    expect(script).toContain("placeholder prices");
    expect(script.trimEnd().endsWith("commit;")).toBe(true);
    expect(script).not.toMatch(/\b(orders|order_lines|customer_profiles|auth\.users)\b\s*\(/);
    expect(script).not.toMatch(/\b(drop|truncate|delete|update)\b/i);
  });

  it("loads the same catalogue into a database that has only the migrations", async () => {
    expect(await count(target, "products")).toBe(0);
    await target.pg.exec(script);

    for (const table of ["categories", "brands", "products", "product_images", "product_specifications", "product_country_prices", "stock_levels"]) {
      expect(await count(target, table), table).toBe(await count(source, table));
    }
    expect(await count(target, "products")).toBeGreaterThan(30);
    expect(await storefront(target)).toEqual(await storefront(source));
    // Only Tanzania is switched on, as in the deployment roster.
    expect(await target.db.query(`select code from countries where active order by code`)).toEqual([{ code: "TZ" }]);
  });

  it("gives a storefront that can take a Cash on Delivery order", async () => {
    const result = await placeCodOrder(target.db, ANON, {
      idempotencyKey: randomUUID(),
      country: "TZ",
      contact: { name: "Asha Mrema", email: "asha@example.test", phone: "+255712345678" },
      delivery: { method: "home", region: "Dar es Salaam", district: "Kinondoni", ward: "Mikocheni", street: "Plot 12", extra: "", notes: "" },
      lines: [{ product: "sample-led-panel", color: null, variant: null, quantity: 1 }],
      expectedTotalMinor: null,
    });
    expect(result.ok).toBe(true);
  });

  it("refuses a second run and changes nothing", async () => {
    const before = await count(target, "products");
    await expect(target.pg.exec(script)).rejects.toThrow(/already has products, categories or brands/);
    await target.pg.exec("rollback");
    expect(await count(target, "products")).toBe(before);
  });

  it("refuses to run before the orders migration", async () => {
    const bare = await createTestDatabase({ seed: false });
    await bare.pg.exec(`drop table order_lines, orders, customer_profiles, stock_levels cascade`);
    await expect(bare.pg.exec(script)).rejects.toThrow(/0004_orders\.sql first/);
    await bare.pg.exec("rollback");
    expect(await count(bare, "products")).toBe(0);
    await bare.pg.close();
  }, 60_000);
});
