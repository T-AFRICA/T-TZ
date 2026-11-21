import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DatabaseCatalogClient, loadPublicProducts } from "../src/catalog";
import { ANON, withAccess, type Access } from "../src/db";
import { createShopper, createTestDatabase, type TestDatabase } from "../src/testing";

/**
 * The stock count the storefront shows (migration 0022, owner decision
 * 2026-11-21): the units available of a product that is on sale are public;
 * the stock table, and the count of anything not on sale, stay private.
 */
let t: TestDatabase;
let shopper: Access;

const PANEL = "sample-led-panel";
const CABLE = "sample-armoured-cable";

const idOf = async (slug: string) => (await t.db.query<{ id: string }>(`select id from products where slug = $1`, [slug]))[0]!.id;
const setStock = (slug: string, units: number) =>
  t.db.query(`update stock_levels set available = $2 where product_id = (select id from products where slug = $1) and country_code = 'TZ'`, [slug, units]);

/** What a visitor reads from the storefront view for one product. */
async function shown(slug: string, access: Access = ANON): Promise<{ available: number | null; in_stock: boolean } | undefined> {
  const rows = await withAccess(t.db, access, (tx) =>
    tx.query<{ available: number | null; in_stock: boolean }>(`select available, in_stock from storefront_products where slug = $1 and country_code = 'TZ'`, [slug]),
  );
  return rows[0];
}

/** The count function called directly, as someone with the public key could. */
async function direct(productId: string, country = "TZ", access: Access = ANON): Promise<number | null> {
  const [row] = await withAccess(t.db, access, (tx) => tx.query<{ n: number | null }>(`select storefront_available($1::uuid, $2) as n`, [productId, country]));
  return row!.n;
}

beforeAll(async () => {
  t = await createTestDatabase();
  shopper = await createShopper(t.db);
}, 60_000);

afterAll(async () => {
  await t.pg.close();
});

describe("stock count on the storefront", () => {
  it("shows a visitor and a signed-in customer the units available of a product on sale", async () => {
    await setStock(PANEL, 25);
    expect(await shown(PANEL)).toEqual({ available: 25, in_stock: true });
    expect(await shown(PANEL, shopper)).toEqual({ available: 25, in_stock: true });
    expect(await shown(CABLE)).toEqual({ available: 0, in_stock: false });

    // It follows the stock: an order or an adjustment is seen on the next read.
    await setStock(PANEL, 3);
    expect(await shown(PANEL)).toEqual({ available: 3, in_stock: true });
    await setStock(PANEL, 25);
  });

  it("reaches the storefront product, and is left out when there is no stock record", async () => {
    const products = await loadPublicProducts(t.db, "TZ");
    expect(products.find((product) => product.id === PANEL)).toMatchObject({ inStock: true, stockAvailable: 25 });
    expect(products.find((product) => product.id === CABLE)).toMatchObject({ inStock: false, stockAvailable: 0 });
    expect((await new DatabaseCatalogClient(t.db, { cacheMs: 0 }).getProduct(PANEL, "TZ"))?.stockAvailable).toBe(25);

    const panelId = await idOf(PANEL);
    await t.db.query(`create temp table stock_aside as select * from stock_levels where product_id = $1`, [panelId]);
    await t.db.query(`delete from stock_levels where product_id = $1`, [panelId]);
    try {
      const without = (await loadPublicProducts(t.db, "TZ")).find((product) => product.id === PANEL)!;
      expect(without).not.toHaveProperty("stockAvailable");
      expect((await shown(PANEL))?.available).toBeNull();
    } finally {
      await t.db.query(`insert into stock_levels select * from stock_aside`);
      await t.db.query(`drop table stock_aside`);
    }
  });

  it("keeps the stock table itself private: no reading, no writing", async () => {
    for (const access of [ANON, shopper]) {
      await expect(withAccess(t.db, access, (tx) => tx.query(`select available from stock_levels`))).rejects.toThrow(/permission denied/);
      await expect(withAccess(t.db, access, (tx) => tx.query(`update stock_levels set available = 9999`))).rejects.toThrow(/permission denied/);
    }
    // The view is read-only for them as well.
    await expect(withAccess(t.db, ANON, (tx) => tx.query(`update storefront_products set available = 9999`))).rejects.toThrow();
    expect((await shown(PANEL))?.available).toBe(25);
  });

  it("answers nothing for a product that is not on sale, even when asked directly", async () => {
    const panelId = await idOf(PANEL);
    expect(await direct(panelId)).toBe(25);
    expect(await direct(panelId, "TZ", shopper)).toBe(25);
    // A country the product is not sold in, and an id that does not exist.
    expect(await direct(panelId, "KE")).toBeNull();
    expect(await direct("00000000-0000-4000-8000-000000000000")).toBeNull();

    // Hidden product: gone from the view, and its count is not given out.
    await t.db.query(`update products set active = false where id = $1`, [panelId]);
    try {
      expect(await shown(PANEL)).toBeUndefined();
      expect(await direct(panelId)).toBeNull();
    } finally {
      await t.db.query(`update products set active = true where id = $1`, [panelId]);
    }

    // Price switched off for the country.
    await t.db.query(`update product_country_prices set active = false where product_id = $1 and country_code = 'TZ'`, [panelId]);
    try {
      expect(await direct(panelId)).toBeNull();
    } finally {
      await t.db.query(`update product_country_prices set active = true where product_id = $1 and country_code = 'TZ'`, [panelId]);
    }

    // Category switched off.
    await t.db.query(`update categories set active = false where id = (select category_id from products where id = $1)`, [panelId]);
    try {
      expect(await direct(panelId)).toBeNull();
    } finally {
      await t.db.query(`update categories set active = true where id = (select category_id from products where id = $1)`, [panelId]);
    }
    expect(await direct(panelId)).toBe(25);
  });
});
