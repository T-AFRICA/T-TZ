import { describe, expect, it } from "vitest";
import type { Product } from "@tronic/types";
import {
  ALL_SAMPLE_PRODUCTS,
  MockCatalogClient,
  normalizeSearchText,
  rankProducts,
  relevanceTier,
  withinOneEdit,
} from "@tronic/api-client";
import { createRateLimiter, clientKey } from "./rate-limit";
import { orderSpecifications, parseSearchPageParams, searchHref, toSearchHit } from "./search";

const base = ALL_SAMPLE_PRODUCTS.find((p) => p.id === "sample-led-panel") as Product;

function product(overrides: Partial<Product>): Product {
  return { ...base, ...overrides };
}

const names = (items: readonly Product[]) => items.map((p) => p.name);

describe("search relevance", () => {
  it("normalises case and whitespace and bounds the length", () => {
    expect(normalizeSearchText("  24W   LED\tPanel ")).toBe("24w led panel");
    expect(normalizeSearchText("x".repeat(500))).toHaveLength(80);
  });

  it("ranks exact SKU, then model, then exact name, prefix and partial matches", () => {
    const items = [
      product({ id: "a", name: "Panel clips for AB-100", sku: "CLIP-1", sequence: 1 }),
      product({ id: "b", name: "AB-100 bracket", sku: "BR-1", sequence: 2 }),
      product({ id: "c", name: "ab-100", sku: "X-9", sequence: 3 }),
      product({
        id: "d",
        name: "Floodlight",
        sku: "FL-1",
        sequence: 4,
        specifications: [{ label: "Model No.", value: "AB 100" }],
      }),
      product({ id: "e", name: "Socket", sku: "AB-100", sequence: 5 }),
    ];
    expect(rankProducts(items, "ab-100").map((p) => p.id)).toEqual(["e", "d", "c", "b", "a"]);
  });

  it("matches exact SKUs regardless of case and separators, and partial SKUs after them", () => {
    const items = [product({ id: "x", name: "Other", sku: "TR-LED-2400" }), product({ id: "y", name: "Bulb", sku: "TR-LED-24" })];
    expect(rankProducts(items, "tr led 24").map((p) => p.id)).toEqual(["y", "x"]);
    expect(relevanceTier(items[0] as Product, "led-2400")).toBe(4);
  });

  it("finds multi-word queries in any order and by category words", () => {
    const sample = ALL_SAMPLE_PRODUCTS;
    expect(names(rankProducts(sample, "24W LED"))[0]).toBe("24W LED Panel Light");
    expect(names(rankProducts(sample, "light panel"))).toContain("24W LED Panel Light");
    expect(rankProducts(sample, "lighting").length).toBeGreaterThan(1);
  });

  it("tolerates one typo in longer words only", () => {
    expect(withinOneEdit("panel", "pannel")).toBe(true);
    expect(withinOneEdit("panel", "paenl")).toBe(true);
    expect(withinOneEdit("panel", "pnale")).toBe(false);
    expect(names(rankProducts(ALL_SAMPLE_PRODUCTS, "pannel"))).toContain("24W LED Panel Light");
    // Three-letter words get no typo allowance ("pnl" is not "panel").
    expect(rankProducts(ALL_SAMPLE_PRODUCTS, "pnl")).toEqual([]);
  });

  it("returns nothing for empty, punctuation-only or unknown queries", () => {
    expect(rankProducts(ALL_SAMPLE_PRODUCTS, "   ")).toEqual([]);
    expect(rankProducts(ALL_SAMPLE_PRODUCTS, "%_*'\";--")).toEqual([]);
    expect(rankProducts(ALL_SAMPLE_PRODUCTS, "zzzz qqqq")).toEqual([]);
  });
});

describe("catalogue search", () => {
  const client = new MockCatalogClient([
    product({ id: "tz", name: "LED Tube", sku: "T-1", countries: ["TZ"] }),
    product({ id: "ke", name: "LED Strip", sku: "K-1", countries: ["KE"] }),
    product({ id: "off", name: "LED Spot", sku: "S-1", active: false }),
    product({ id: "oos", name: "LED Batten", sku: "B-1", inStock: false }),
  ]);

  it("only returns active products of the requested country", async () => {
    const page = await client.searchProducts({ country: "TZ", text: "led" });
    expect(page.items.map((p) => p.id).sort()).toEqual(["oos", "tz"]);
  });

  it("filters to in-stock products and pages the matches", async () => {
    const inStock = await client.searchProducts({ country: "TZ", text: "led", inStockOnly: true });
    expect(inStock.items.map((p) => p.id)).toEqual(["tz"]);
    const paged = await client.searchProducts({ country: "TZ", text: "led", pageSize: 1, page: 2 });
    expect(paged).toMatchObject({ total: 2, page: 2, pageCount: 2 });
    expect(paged.items).toHaveLength(1);
  });

  it("maps a product to the slim autocomplete hit", () => {
    expect(Object.keys(toSearchHit(base)).sort()).toEqual(
      ["categoryName", "currency", "id", "image", "inStock", "name", "priceMinor", "sku", "slug", "wasPriceMinor"].sort(),
    );
  });

  it("adds only real preview extras: trimmed description and useful specs first", () => {
    const hit = toSearchHit(
      product({
        description: `${"Bright, efficient panel light. ".repeat(20)}`,
        specifications: [
          { label: "Finish", value: "Matte" },
          { label: "Voltage", value: "220-240V" },
          { label: "Empty", value: " " },
          { label: "Wattage", value: "24W" },
          { label: "Model", value: "TR-P24" },
        ],
      }),
    );
    expect(hit.description?.length).toBeLessThanOrEqual(601);
    expect(hit.description?.endsWith("…")).toBe(true);
    expect(hit.specifications?.map((spec) => spec.label)).toEqual(["Model", "Wattage", "Voltage", "Finish"]);
    expect(toSearchHit(product({ description: "  " }))).not.toHaveProperty("description");
  });

  it("carries gallery images and purchase options for the quick view", () => {
    const hit = toSearchHit(
      product({
        images: [base.image, "/a.png", "/a.png", "/b.png"],
        variants: ["3-way"],
        variantLabel: "Type",
        colors: [{ name: "White", swatch: "#fff" }],
      }),
    );
    expect(hit.images).toEqual(["/a.png", "/b.png"]);
    expect(hit).toMatchObject({ variants: ["3-way"], variantLabel: "Type", colors: [{ name: "White", swatch: "#fff" }] });
  });

  it("keeps catalogue order for specs of equal priority", () => {
    expect(orderSpecifications([{ label: "B" }, { label: "A" }, { label: "Colour" }]).map((s) => s.label)).toEqual([
      "Colour",
      "B",
      "A",
    ]);
  });
});

describe("search page URL", () => {
  it("reads and validates params from the URL", () => {
    expect(parseSearchPageParams({ q: "  LED  ", sort: "bogus", page: "-3", stock: "1" })).toEqual({
      q: "led",
      sort: "relevance",
      inStockOnly: true,
      page: 1,
    });
  });

  it("encodes the query and omits defaults", () => {
    expect(searchHref({ q: "a&b c", sort: "relevance", page: 1 })).toBe("/search?q=a%26b+c");
    expect(searchHref({ q: "led", sort: "price-asc", inStockOnly: true, page: 2 })).toBe(
      "/search?q=led&sort=price-asc&stock=1&page=2",
    );
  });
});

describe("search rate limiter", () => {
  it("allows the limit per window and resets after it", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000 });
    expect([limiter.allow("ip", 0), limiter.allow("ip", 10), limiter.allow("ip", 20)]).toEqual([true, true, false]);
    expect(limiter.allow("other", 20)).toBe(true);
    expect(limiter.allow("ip", 1000)).toBe(true);
  });

  it("keys on the first forwarded address", () => {
    expect(clientKey(new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe("203.0.113.5");
    expect(clientKey(new Headers())).toBe("unknown");
  });
});
