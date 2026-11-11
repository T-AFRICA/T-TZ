import { describe, expect, it } from "vitest";
import type { Product } from "@tronic/types";
import { ALL_SAMPLE_PRODUCTS, DEFAULT_PAGE_SIZE, MockCatalogClient } from "@tronic/api-client";
import { CATEGORY_SECTIONS, getCategorySection } from "@tronic/country-config";
import { activeFilterCount, listingHref, parseListingFilters, toProductQuery } from "./catalog";
import { listingMetadata } from "./metadata";

/** Synthetic fixture: 30 lighting products across two groups and brands, plus
 *  one Kenya-only and one inactive product that must never surface for TZ. */
function fixture(): Product[] {
  const items: Product[] = Array.from({ length: 30 }, (_, i) => ({
    id: `p-${i + 1}`,
    slug: `p-${i + 1}`,
    sku: `P-${i + 1}`,
    name: `Product ${String(i + 1).padStart(2, "0")}`,
    brand: i % 3 === 0 ? "Alpha" : "Beta",
    categorySlug: "lighting",
    categoryName: "Lighting",
    groupSlug: i % 2 === 0 ? "indoor-lighting" : "outdoor-lighting",
    subcategorySlug: i % 2 === 0 ? (i % 4 === 0 ? "panel-lights" : "spotlights") : "floodlights",
    image: "/products/x.png",
    priceMinor: (i + 1) * 1_000,
    currency: "TZS",
    inStock: i % 5 !== 0,
    countries: ["TZ"],
    active: true,
    sequence: i + 1,
  }));
  items.push(
    { ...items[0]!, id: "ke-only", slug: "ke-only", sku: "KE", countries: ["KE"], sequence: 100, priceMinor: 50 },
    { ...items[0]!, id: "retired", slug: "retired", sku: "RET", active: false, sequence: 101, priceMinor: 60 },
  );
  return items;
}

const client = new MockCatalogClient(fixture());

describe("MockCatalogClient", () => {
  it("never returns products outside the requested country or inactive ones", async () => {
    const page = await client.listProducts({ country: "TZ", pageSize: 48 });
    const ids = page.items.map((p) => p.id);
    expect(page.total).toBe(30);
    expect(ids).not.toContain("ke-only");
    expect(ids).not.toContain("retired");
    expect(await client.getProduct("ke-only", "TZ")).toBeNull();
    expect(await client.getProduct("retired", "TZ")).toBeNull();
    expect((await client.getProduct("ke-only", "KE"))?.id).toBe("ke-only");
    expect(page.facets.minPriceMinor).toBe(1_000);
  });

  it("scopes to category and group", async () => {
    const indoor = await client.listProducts({ country: "TZ", category: "lighting", group: "indoor-lighting" });
    expect(indoor.total).toBe(15);
    expect(indoor.items.every((p) => p.groupSlug === "indoor-lighting")).toBe(true);
    const none = await client.listProducts({ country: "TZ", category: "tools" });
    expect(none.total).toBe(0);
    expect(none.pageCount).toBe(1);
    expect(none.facets).toEqual({ brands: [], minPriceMinor: 0, maxPriceMinor: 0 });
  });

  it("scopes to a subcategory inside the group", async () => {
    const page = await client.listProducts({ country: "TZ", category: "lighting", group: "indoor-lighting", subcategory: "panel-lights", pageSize: 48 });
    expect(page.total).toBe(8);
    expect(page.items.every((p) => p.subcategorySlug === "panel-lights")).toBe(true);
    const none = await client.listProducts({ country: "TZ", category: "lighting", group: "outdoor-lighting", subcategory: "panel-lights" });
    expect(none.total).toBe(0);
  });

  it("filters by brand, price range and stock while facets describe the whole scope", async () => {
    const page = await client.listProducts({
      country: "TZ",
      category: "lighting",
      brands: ["Alpha"],
      minPriceMinor: 5_000,
      maxPriceMinor: 20_000,
      inStockOnly: true,
    });
    expect(page.items.every((p) => p.brand === "Alpha" && p.priceMinor >= 5_000 && p.priceMinor <= 20_000 && p.inStock)).toBe(
      true,
    );
    expect(page.total).toBe(page.items.length);
    expect(page.facets.brands).toEqual(["Alpha", "Beta"]);
    expect(page.facets.maxPriceMinor).toBe(30_000);
  });

  it("sorts by price, name and newest", async () => {
    const asc = await client.listProducts({ country: "TZ", sort: "price-asc", pageSize: 48 });
    expect(asc.items.map((p) => p.priceMinor)).toEqual([...asc.items.map((p) => p.priceMinor)].sort((a, b) => a - b));
    const desc = await client.listProducts({ country: "TZ", sort: "price-desc" });
    expect(desc.items[0]?.priceMinor).toBe(30_000);
    const byName = await client.listProducts({ country: "TZ", sort: "name-asc" });
    expect(byName.items[0]?.name).toBe("Product 01");
    const newest = await client.listProducts({ country: "TZ" });
    expect(newest.items[0]?.sequence).toBe(30);
  });

  it("pages results and clamps out-of-range pages", async () => {
    const first = await client.listProducts({ country: "TZ" });
    expect(first.pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(first.pageCount).toBe(3);
    expect(first.items).toHaveLength(12);
    const last = await client.listProducts({ country: "TZ", page: 3 });
    expect(last.items).toHaveLength(6);
    const clamped = await client.listProducts({ country: "TZ", page: 99 });
    expect(clamped.page).toBe(3);
    const capped = await client.listProducts({ country: "TZ", pageSize: 1_000 });
    expect(capped.pageSize).toBe(48);
  });

  it("returns related products from the same category only", async () => {
    const [product] = (await client.listProducts({ country: "TZ", pageSize: 1 })).items;
    const related = await client.getRelatedProducts(product!, "TZ", 4);
    expect(related).toHaveLength(4);
    expect(related.every((p) => p.categorySlug === "lighting" && p.id !== product!.id)).toBe(true);
  });
});

describe("sample catalogue data", () => {
  it("places every sample product in a real Tanzania category and group", () => {
    for (const product of ALL_SAMPLE_PRODUCTS) {
      const section = CATEGORY_SECTIONS.find((s) => s.slug === product.categorySlug);
      expect(section, product.id).toBeDefined();
      expect(section?.groups.map((g) => g.slug), product.id).toContain(product.groupSlug);
      expect(product.countries).toContain("TZ");
      if (product.subcategorySlug) {
        const group = section?.groups.find((g) => g.slug === product.groupSlug);
        expect(group?.subcategories?.map((s) => s.slug), product.id).toContain(product.subcategorySlug);
      }
    }
  });

  it("gives every subcategory a unique, URL-safe slug within its group (Website Content Structure)", () => {
    const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    let count = 0;
    for (const section of CATEGORY_SECTIONS) {
      for (const group of section.groups) {
        const slugs = (group.subcategories ?? []).map((s) => s.slug);
        expect(new Set(slugs).size, `${section.slug}/${group.slug}`).toBe(slugs.length);
        for (const sub of group.subcategories ?? []) {
          expect(sub.slug, `${group.slug}/${sub.name}`).toMatch(slugPattern);
          expect(sub.name.trim().length).toBeGreaterThan(0);
          count += 1;
        }
      }
    }
    expect(count).toBeGreaterThan(100);
    expect(getCategorySection("lighting")?.groups[0]?.subcategories?.map((s) => s.slug)).toContain("panel-lights");
    expect(getCategorySection("tools")?.groups.every((g) => !g.subcategories)).toBe(true);
    expect(getCategorySection("shop-by-use")?.groups.every((g) => !g.subcategories)).toBe(true);
  });

  it("has unique ids and slugs", () => {
    const ids = ALL_SAMPLE_PRODUCTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const slugs = ALL_SAMPLE_PRODUCTS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("parseListingFilters", () => {
  it("falls back to safe defaults for missing or hostile input", () => {
    expect(parseListingFilters({})).toEqual({
      brands: [],
      minPrice: undefined,
      maxPrice: undefined,
      inStockOnly: false,
      sort: "newest",
      page: 1,
    });
    const hostile = parseListingFilters({
      sort: "DROP TABLE",
      page: "-4",
      min: "abc",
      max: "1e309",
      stock: "yes",
    });
    expect(hostile.sort).toBe("newest");
    expect(hostile.page).toBe(1);
    expect(hostile.minPriceMajor).toBeUndefined();
    expect(hostile.maxPriceMajor).toBeUndefined();
    expect(hostile.inStockOnly).toBe(false);
  });

  it("reads repeated and comma-separated brands and drops an inverted price range", () => {
    const filters = parseListingFilters({
      brand: ["Alpha", "Beta,Gamma"],
      min: "20000",
      max: "5000",
      sort: "price-desc",
      page: "2",
      stock: "1",
    });
    expect(filters.brands).toEqual(["Alpha", "Beta", "Gamma"]);
    expect(filters.minPriceMajor).toBe(20_000);
    expect(filters.maxPriceMajor).toBeUndefined();
    expect(filters.sort).toBe("price-desc");
    expect(filters.page).toBe(2);
    expect(filters.inStockOnly).toBe(true);
    expect(activeFilterCount(filters)).toBe(5);
  });

  it("builds a query for the active country and a clean round-trip href", () => {
    const filters = parseListingFilters({ brand: "Alpha", sort: "name-asc", page: "3" });
    const lighting = getCategorySection("lighting")!;
    const query = toProductQuery(filters, lighting, lighting.groups[0]);
    expect(query.subcategory).toBeUndefined();
    const sub = toProductQuery(filters, lighting, lighting.groups[0], lighting.groups[0]!.subcategories![1]);
    expect(sub).toMatchObject({ category: "lighting", group: "indoor-lighting", subcategory: "panel-lights" });
    expect(query.country).toBe("TZ");
    expect(query.category).toBe("lighting");
    expect(query.group).toBe("indoor-lighting");
    expect(query.pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(listingHref("/categories/lighting", filters)).toBe("/categories/lighting?brand=Alpha&sort=name-asc&page=3");
    expect(listingHref("/categories/lighting", parseListingFilters({}))).toBe("/categories/lighting");
  });

  it("reads the price filter in shillings and queries in minor units (TZS ×100)", async () => {
    const filters = parseListingFilters({ min: "20000", max: "30000" });
    expect(filters).toMatchObject({ minPriceMajor: 20_000, maxPriceMajor: 30_000 });
    const lighting = getCategorySection("lighting")!;
    const query = toProductQuery(filters, lighting);
    expect(query).toMatchObject({ minPriceMinor: 2_000_000, maxPriceMinor: 3_000_000 });
    // The TZS 28,000 panel is inside a TZS 20,000–30,000 filter, the
    // TZS 18,500 plug is not. A 100× slip would exclude or include both.
    const page = await new MockCatalogClient().listProducts({ ...query, category: undefined, pageSize: 48 });
    const slugs = page.items.map((p) => p.slug);
    expect(slugs).toContain("sample-led-panel");
    expect(slugs).not.toContain("sample-top-plug");
    expect(listingHref("/categories/lighting", filters)).toBe("/categories/lighting?min=20000&max=30000");
  });

  it("caps absurd price filters instead of overflowing", () => {
    const filters = parseListingFilters({ max: "999999999999999" });
    const query = toProductQuery(filters, getCategorySection("lighting")!);
    expect(Number.isSafeInteger(query.maxPriceMinor)).toBe(true);
  });
});

describe("listingMetadata", () => {
  it("canonicalises filtered views to the unfiltered page and marks them noindex", () => {
    const meta = listingMetadata({
      title: "Lighting",
      description: "d",
      basePath: "/categories/lighting",
      searchParams: { brand: "Alpha", page: "2" },
    });
    expect(meta.alternates?.canonical).toBe("/categories/lighting?page=2");
    expect(meta.title).toBe("Lighting – Page 2");
    expect(meta.robots).toEqual({ index: false, follow: true });
    const plain = listingMetadata({ title: "Lighting", description: "d", basePath: "/categories/lighting", searchParams: {} });
    expect(plain.robots).toBeUndefined();
    expect(plain.alternates?.canonical).toBe("/categories/lighting");
  });
});

describe("section listings (the eight homepage cards)", () => {
  const live = new MockCatalogClient(ALL_SAMPLE_PRODUCTS);
  const empty = parseListingFilters({});

  it("resolves every section to a listing without error", async () => {
    for (const section of CATEGORY_SECTIONS) {
      const page = await live.listProducts(toProductQuery(empty, section));
      expect(page.page, section.slug).toBe(1);
      expect(page.total, section.slug).toBeGreaterThanOrEqual(0);
    }
  });

  it("keeps department products inside their own category", async () => {
    for (const section of CATEGORY_SECTIONS.filter((s) => s.kind !== "use-case")) {
      const page = await live.listProducts({ ...toProductQuery(empty, section), pageSize: 48 });
      expect(page.items.every((p) => p.categorySlug === section.slug), section.slug).toBe(true);
      const expected = ALL_SAMPLE_PRODUCTS.filter((p) => p.categorySlug === section.slug).length;
      expect(page.total, section.slug).toBe(expected);
    }
  });

  it("lists Shop by Use by use case across departments without duplicating products", async () => {
    const shopByUse = getCategorySection("shop-by-use")!;
    expect(shopByUse.kind).toBe("use-case");
    const all = await live.listProducts({ ...toProductQuery(empty, shopByUse), pageSize: 48 });
    expect(all.total).toBeGreaterThan(0);
    expect(new Set(all.items.map((p) => p.id)).size).toBe(all.items.length);
    expect(new Set(all.items.map((p) => p.categorySlug)).size).toBeGreaterThan(1);
    expect(all.items.every((p) => p.useCases && p.useCases.length > 0)).toBe(true);

    const commercial = await live.listProducts({ ...toProductQuery(empty, shopByUse, shopByUse.groups[2]), pageSize: 48 });
    expect(commercial.items.every((p) => p.useCases?.includes("for-commercial"))).toBe(true);
    expect(commercial.total).toBeLessThan(all.total);
    expect(toProductQuery(empty, shopByUse).category).toBeUndefined();
  });

  it("only uses use cases that exist in the taxonomy", () => {
    const valid = getCategorySection("shop-by-use")!.groups.map((g) => g.slug);
    for (const product of ALL_SAMPLE_PRODUCTS) {
      for (const useCase of product.useCases ?? []) {
        expect(valid, product.id).toContain(useCase);
      }
    }
  });
});
