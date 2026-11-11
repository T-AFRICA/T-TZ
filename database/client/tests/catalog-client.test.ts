import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MockCatalogClient } from "@tronic/api-client";
import { ACTIVE_COUNTRY, formatMoney } from "@tronic/country-config";
import { DatabaseCatalogClient, rowToProduct } from "../src/catalog";
import { createTestDatabase, type TestDatabase } from "../src/testing";

/**
 * The live catalogue adapter returns the same storefront Products as the
 * mock for the same data, so swapping the source changes no UI, and money
 * crosses the database edge without rescaling.
 */
let t: TestDatabase;
let live: DatabaseCatalogClient;
const mock = new MockCatalogClient();

beforeAll(async () => {
  t = await createTestDatabase();
  live = new DatabaseCatalogClient(t.db);
}, 60_000);

afterAll(async () => {
  await t.pg.close();
});

describe("database catalogue client", () => {
  it("returns the same product as the mock, prices in minor units", async () => {
    const fromDb = await live.getProduct("sample-extension", "TZ");
    const fromMock = await mock.getProduct("sample-extension", "TZ");
    expect(fromDb).toMatchObject({
      id: "sample-extension",
      priceMinor: fromMock!.priceMinor,
      wasPriceMinor: fromMock!.wasPriceMinor,
      variants: fromMock!.variants,
      colors: fromMock!.colors,
      inStock: true,
      currency: "TZS",
    });
    expect(fromDb!.priceMinor).toBe(2_200_000);
    expect(formatMoney(fromDb!.priceMinor, ACTIVE_COUNTRY)).toBe("TZS 22,000");
  });

  it("lists, filters and sorts like the mock", async () => {
    const query = { country: "TZ" as const, category: "lighting", sort: "price-asc" as const, minPriceMinor: 1_000_000, pageSize: 48 };
    const a = await live.listProducts(query);
    const b = await mock.listProducts(query);
    expect(a.items.map((p) => [p.slug, p.priceMinor])).toEqual(b.items.map((p) => [p.slug, p.priceMinor]));
    expect(a.facets).toEqual(b.facets);
    expect(a.total).toBe(b.total);
  });

  it("searches within the country like the mock", async () => {
    const a = await live.searchProducts({ country: "TZ", text: "led" });
    const b = await mock.searchProducts({ country: "TZ", text: "led" });
    expect(a.items.map((p) => p.slug)).toEqual(b.items.map((p) => p.slug));
  });

  it("returns nothing for a country with no public catalogue", async () => {
    expect(await live.getProduct("sample-led-panel", "KE")).toBeNull();
    expect((await live.listProducts({ country: "UG" })).total).toBe(0);
  });
});

describe("money at the database edge", () => {
  const row = (price: unknown, was: unknown = null) => ({
    id: "00000000-0000-4000-8000-000000000000",
    slug: "x",
    sku: "X",
    name: "X",
    description: null,
    brand: null,
    category_slug: "lighting",
    category_name: "Lighting",
    group_slug: null,
    subcategory_slug: null,
    variant_label: null,
    sequence: 1,
    use_cases: null,
    country_code: "TZ",
    currency: "TZS",
    price_minor: price,
    was_price_minor: was,
    in_stock: true,
    image: "/x.png",
  });
  const none = { images: [], variants: [], colors: [], specifications: [] };

  it("keeps int8 values from any driver as minor units (no 100× slip)", () => {
    for (const value of [2_800_000, "2800000", 2_800_000n]) {
      const product = rowToProduct(row(value), none);
      expect(product.priceMinor).toBe(2_800_000);
      expect(formatMoney(product.priceMinor, ACTIVE_COUNTRY)).toBe("TZS 28,000");
    }
  });

  it("refuses fractional, negative or non-numeric stored amounts", () => {
    for (const value of [28000.5, -1, "28,000", "abc", null]) {
      expect(() => rowToProduct(row(value), none)).toThrow();
    }
  });
});
