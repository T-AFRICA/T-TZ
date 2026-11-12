import { afterEach, describe, expect, it, vi } from "vitest";
import type { CatalogClient } from "@tronic/api-client";
import { loadCollection } from "./collections";

const state = vi.hoisted(() => ({ failing: false }));

// The real (mock-mode) catalogue, or one whose reads fail.
vi.mock("@/features/data/source", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/data/source")>();
  const down = () => Promise.reject(new Error("catalogue unavailable"));
  const failingCatalog: CatalogClient = {
    listProducts: down,
    getProduct: down,
    getRelatedProducts: down,
    searchProducts: down,
  };
  return {
    ...actual,
    getCatalog: async () => (state.failing ? failingCatalog : actual.getCatalog()),
  };
});

describe("loadCollection", () => {
  afterEach(() => {
    state.failing = false;
    vi.restoreAllMocks();
  });

  it("reads one taxonomy scope from the catalogue, newest first", async () => {
    const result = await loadCollection([{ category: "switchgear-protection" }]);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.products).toHaveLength(6);
    for (const product of result.products) {
      expect(product.categorySlug).toBe("switchgear-protection");
      expect(product.countries).toContain("TZ");
      expect(product.active).toBe(true);
    }
    const sequences = result.products.map((product) => product.sequence);
    expect(sequences).toEqual([...sequences].sort((a, b) => b - a));
  });

  it("merges several scopes without duplicates, up to the limit", async () => {
    const scopes = [
      { category: "lighting", group: "indoor-lighting", subcategory: "spotlights" },
      { category: "lighting", group: "indoor-lighting", subcategory: "tracklights" },
      { category: "lighting", group: "indoor-lighting", subcategory: "spotlights" },
    ];
    const result = await loadCollection(scopes, 2);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.products).toHaveLength(2);
    expect(new Set(result.products.map((product) => product.id)).size).toBe(2);
  });

  it("returns an empty collection, not an error, when nothing matches", async () => {
    const result = await loadCollection([{ category: "lighting", group: "outdoor-lighting", subcategory: "street-lights" }]);
    expect(result).toEqual({ status: "ok", products: [] });
  });

  it("reports a failed catalogue read as an error state", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.failing = true;
    expect(await loadCollection([{ category: "switchgear-protection" }])).toEqual({ status: "error" });
  });
});
