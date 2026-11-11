import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ANON, withAccess, type Db } from "../src/db";
import { createAuthUser, createTestDatabase, type TestDatabase } from "../src/testing";

/**
 * Catalogue permissions (migration 0003) on a disposable PGlite database
 * that starts from Supabase's permissive defaults (ALL to anon and
 * authenticated on every public table). Queries run as the API roles, the
 * way Supabase runs requests, so Row Level Security and grants apply.
 */

let t: TestDatabase;
let userId: string;

const asAnon = <T>(fn: (tx: Db) => Promise<T>) => withAccess(t.db, ANON, fn);
const asUser = <T>(fn: (tx: Db) => Promise<T>) => withAccess(t.db, { role: "authenticated", userId }, fn);

/** Runs `fn` and returns the Postgres error message, or null when it succeeded. */
async function failure(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

async function productId(slug: string): Promise<string> {
  const [row] = await t.db.query<{ id: string }>(`select id from products where slug = $1`, [slug]);
  return row!.id;
}

beforeAll(async () => {
  t = await createTestDatabase();
  userId = await createAuthUser(t.db, "customer@example.test");

  // Fixtures beyond the sample catalogue (owner role, as an admin would):
  const [lighting] = await t.db.query<{ id: string }>(`select id from categories where slug = 'lighting'`);
  const insertProduct = async (slug: string, active = true) => {
    const [row] = await t.db.query<{ id: string }>(
      `insert into products (slug, sku, name, category_id, active) values ($1, upper($1), $1, $2, $3) returning id`,
      [slug, lighting!.id, active],
    );
    return row!.id;
  };
  // An unpublished (inactive) product with a Tanzania price.
  const draft = await insertProduct("draft-product", false);
  await t.db.query(`insert into product_country_prices values ($1, 'TZ', 'TZS', 1000000, null, true, true, now())`, [draft]);
  // A product priced only in Kenya, and one only in Uganda (inactive country).
  await t.db.query(`update countries set active = true where code = 'KE'`);
  const kenyan = await insertProduct("kenya-only");
  await t.db.query(`insert into product_country_prices values ($1, 'KE', 'KES', 150000, null, true, true, now())`, [kenyan]);
  const ugandan = await insertProduct("uganda-only");
  await t.db.query(`insert into product_country_prices values ($1, 'UG', 'UGX', 50000, null, true, true, now())`, [ugandan]);
  // A product with an inactive Tanzania price row (withdrawn from sale).
  const withdrawn = await insertProduct("withdrawn-product");
  await t.db.query(`insert into product_country_prices values ($1, 'TZ', 'TZS', 1000000, null, true, false, now())`, [withdrawn]);
}, 60_000);

afterAll(async () => {
  await t.pg.close();
});

describe("anonymous reads", () => {
  it("see the published Tanzania catalogue through the storefront view", async () => {
    const rows = await asAnon((tx) =>
      tx.query<{ slug: string; price_minor: unknown }>(`select slug, price_minor from storefront_products where country_code = 'TZ'`),
    );
    const slugs = rows.map((r) => r.slug);
    expect(slugs).toContain("sample-led-panel");
    expect(slugs).not.toContain("draft-product");
    expect(slugs).not.toContain("withdrawn-product");
    expect(slugs).not.toContain("kenya-only");
    // Stored money comes back as stored: TZS 28,000 is 2,800,000 minor units.
    expect(Number(rows.find((r) => r.slug === "sample-led-panel")!.price_minor)).toBe(2_800_000);
  });

  it("cannot see unpublished products, withdrawn prices or inactive countries in the base tables either", async () => {
    const products = await asAnon((tx) => tx.query<{ slug: string }>(`select slug from products`));
    const slugs = products.map((r) => r.slug);
    expect(slugs).not.toContain("draft-product");
    expect(slugs).not.toContain("withdrawn-product");
    expect(slugs).not.toContain("uganda-only");
    expect(slugs).toContain("kenya-only");

    const countries = await asAnon((tx) => tx.query<{ code: string }>(`select code from countries order by code`));
    expect(countries.map((r) => r.code)).toEqual(["KE", "TZ"]);

    const prices = await asAnon((tx) => tx.query<{ country_code: string }>(`select distinct country_code from product_country_prices`));
    expect(prices.map((r) => r.country_code).sort()).toEqual(["KE", "TZ"]);
  });

  it("hide a product when its category is deactivated", async () => {
    await t.db.query(`update categories set active = false where slug = 'cables-wiring'`);
    try {
      const rows = await asAnon((tx) => tx.query<{ category_slug: string }>(`select category_slug from storefront_products`));
      expect(rows.some((r) => r.category_slug === "cables-wiring")).toBe(false);
    } finally {
      await t.db.query(`update categories set active = true where slug = 'cables-wiring'`);
    }
  });

  it("cannot read stock counts, orders or customer profiles", async () => {
    for (const table of ["stock_levels", "orders", "order_lines", "customer_profiles"]) {
      expect(await failure(() => asAnon((tx) => tx.query(`select * from ${table}`)))).toMatch(/permission denied/);
    }
  });
});

describe("writes", () => {
  it("are refused for anon and authenticated on every catalogue table", async () => {
    const id = await productId("sample-led-panel");
    const attempts: [string, string, unknown[]][] = [
      ["insert", `insert into categories (slug, name) values ('x', 'X')`, []],
      ["update", `update products set name = 'Hacked' where id = $1`, [id]],
      ["delete", `delete from product_images where product_id = $1`, [id]],
      ["price", `update product_country_prices set price_minor = 1 where product_id = $1`, [id]],
      ["country", `update countries set active = true where code = 'UG'`, []],
      ["stock", `update stock_levels set available = 999 where product_id = $1`, [id]],
      ["order", `insert into orders (order_number) values ('X')`, []],
    ];
    for (const run of [asAnon, asUser]) {
      for (const [label, sql, params] of attempts) {
        const message = await failure(() => run((tx) => tx.query(sql, params)));
        expect(message, `${label} must fail`).toMatch(/permission denied/);
      }
    }
    const [row] = await t.db.query<{ name: string; price_minor: unknown }>(
      `select p.name, pcp.price_minor from products p join product_country_prices pcp on pcp.product_id = p.id where p.id = $1`,
      [id],
    );
    expect(row!.name).toBe("24W LED Panel Light");
    expect(Number(row!.price_minor)).toBe(2_800_000);
  });

  it("stay closed for tables created after the migrations (default privileges revoked)", async () => {
    await t.db.query(`create table later_table (id int)`);
    expect(await failure(() => asAnon((tx) => tx.query(`select * from later_table`)))).toMatch(/permission denied/);
    await t.db.query(`drop table later_table`);
  });

  it("cannot call internal trigger functions", async () => {
    expect(await failure(() => asAnon((tx) => tx.query(`select stock_levels_sync_in_stock()`)))).toMatch(
      /permission denied|trigger functions can only be called as triggers/,
    );
  });
});

describe("country isolation", () => {
  it("search_products returns only the requested country's products and prices", async () => {
    const tz = await asAnon((tx) =>
      tx.query<{ slug: string; currency: string }>(`select slug, currency from search_products('led', 'TZ', 48)`),
    );
    expect(tz.map((r) => r.slug)).toContain("sample-led-panel");
    expect(tz.every((r) => r.currency === "TZS")).toBe(true);
    expect(tz.map((r) => r.slug)).not.toContain("kenya-only");

    const ke = await asAnon((tx) => tx.query<{ slug: string; currency: string }>(`select slug, currency from search_products('kenya', 'KE', 48)`));
    expect(ke.map((r) => r.slug)).toEqual(["kenya-only"]);
    expect(ke[0]!.currency).toBe("KES");

    const ug = await asAnon((tx) => tx.query(`select * from search_products('uganda', 'UG', 48)`));
    expect(ug).toEqual([]);
  });

  it("the storefront view never mixes a country with another country's price", async () => {
    const rows = await asAnon((tx) =>
      tx.query<{ country_code: string; currency: string }>(`select distinct country_code, currency from storefront_products`),
    );
    expect(rows.sort((a, b) => a.country_code.localeCompare(b.country_code))).toEqual([
      { country_code: "KE", currency: "KES" },
      { country_code: "TZ", currency: "TZS" },
    ]);
  });

  it("a price must be in its country's currency (no TZS row priced in KES)", async () => {
    const id = await productId("sample-led-panel");
    const message = await failure(() =>
      t.db.query(`insert into product_country_prices values ($1, 'KE', 'TZS', 2800000, null, true, true, now())`, [id]),
    );
    expect(message).toMatch(/does not match the currency of country KE/);
  });

  it("records each currency's ISO 4217 exponent (the storage unit)", async () => {
    const rows = await asAnon((tx) => tx.query<{ code: string; exponent: number }>(`select code, exponent from currencies order by code`));
    expect(rows).toEqual([
      { code: "KES", exponent: 2 },
      { code: "TZS", exponent: 2 },
      { code: "UGX", exponent: 0 },
    ]);
  });
});
