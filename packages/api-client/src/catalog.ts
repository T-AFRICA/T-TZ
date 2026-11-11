import type {
  CountryCode,
  Product,
  ProductPage,
  ProductQuery,
  ProductSearchPage,
  ProductSearchQuery,
  ProductSearchSort,
  ProductSort,
} from "@tronic/types";
import { ALL_SAMPLE_PRODUCTS } from "./mock/catalog-data";
import { normalizeSearchText, rankProducts } from "./product-search";

/**
 * Typed catalogue boundary (SSD §4): the storefront only ever talks to this
 * interface. The mock implementation filters, sorts and pages the sample set
 * in memory with exactly the semantics the live client must reproduce in SQL
 * (Phase 4, Supabase), so swapping the client changes no UI code.
 *
 * Country isolation is enforced here: every call carries the server-derived
 * country, and a product outside that country's list is never returned, not
 * even by id.
 */
export interface CatalogClient {
  listProducts(query: ProductQuery): Promise<ProductPage>;
  getProduct(slug: string, country: CountryCode): Promise<Product | null>;
  /** Same-category products (excluding the product itself), catalogue order. */
  getRelatedProducts(product: Product, country: CountryCode, limit?: number): Promise<readonly Product[]>;
  /**
   * Text search within one country: name, SKU, model number and category
   * words, ranked as in product-search.ts. An empty query matches nothing.
   */
  searchProducts(query: ProductSearchQuery): Promise<ProductSearchPage>;
}

export type CatalogClientMode = "mock";

export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 48;
export const PRODUCT_SORTS: readonly ProductSort[] = ["newest", "price-asc", "price-desc", "name-asc"];
export const PRODUCT_SEARCH_SORTS: readonly ProductSearchSort[] = ["relevance", ...PRODUCT_SORTS];

function paginate<T>(items: readonly T[], requestedPage: number | undefined, requestedSize: number | undefined) {
  const pageSize = Math.min(Math.max(requestedSize ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(Math.max(requestedPage ?? 1, 1), pageCount);
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total: items.length, page, pageSize, pageCount };
}

function visibleIn(country: CountryCode) {
  return (product: Product) => product.active && product.countries.includes(country);
}

function sortProducts(items: Product[], sort: ProductSort): Product[] {
  const sorted = [...items];
  switch (sort) {
    case "price-asc":
      return sorted.sort((a, b) => a.priceMinor - b.priceMinor || a.sequence - b.sequence);
    case "price-desc":
      return sorted.sort((a, b) => b.priceMinor - a.priceMinor || a.sequence - b.sequence);
    case "name-asc":
      return sorted.sort((a, b) => a.name.localeCompare(b.name, "en") || a.sequence - b.sequence);
    case "newest":
    default:
      return sorted.sort((a, b) => b.sequence - a.sequence);
  }
}

export class MockCatalogClient implements CatalogClient {
  constructor(private readonly products: readonly Product[] = ALL_SAMPLE_PRODUCTS) {}

  async listProducts(query: ProductQuery): Promise<ProductPage> {
    const scope = this.products
      .filter(visibleIn(query.country))
      .filter((product) => !query.category || product.categorySlug === query.category)
      .filter((product) => !query.group || product.groupSlug === query.group)
      .filter((product) => !query.subcategory || product.subcategorySlug === query.subcategory)
      .filter((product) => !query.useCases || (product.useCases ?? []).some((u) => query.useCases?.includes(u)));

    const brands = [...new Set(scope.map((product) => product.brand).filter((b): b is string => !!b))].sort();
    const prices = scope.map((product) => product.priceMinor);
    const facets = {
      brands,
      minPriceMinor: prices.length ? Math.min(...prices) : 0,
      maxPriceMinor: prices.length ? Math.max(...prices) : 0,
    };

    const wanted = new Set(query.brands ?? []);
    const filtered = scope
      .filter((product) => wanted.size === 0 || (product.brand !== undefined && wanted.has(product.brand)))
      .filter((product) => query.minPriceMinor === undefined || product.priceMinor >= query.minPriceMinor)
      .filter((product) => query.maxPriceMinor === undefined || product.priceMinor <= query.maxPriceMinor)
      .filter((product) => !query.inStockOnly || product.inStock);

    const sorted = sortProducts(filtered, query.sort ?? "newest");
    return { ...paginate(sorted, query.page, query.pageSize), facets };
  }

  async searchProducts(query: ProductSearchQuery): Promise<ProductSearchPage> {
    const text = normalizeSearchText(query.text);
    const ranked = rankProducts(this.products.filter(visibleIn(query.country)), text).filter(
      (product) => !query.inStockOnly || product.inStock,
    );
    const sort = query.sort ?? "relevance";
    const ordered = sort === "relevance" ? ranked : sortProducts(ranked, sort);
    return { query: text, ...paginate(ordered, query.page, query.pageSize) };
  }

  async getProduct(slug: string, country: CountryCode): Promise<Product | null> {
    return this.products.find((product) => product.slug === slug && visibleIn(country)(product)) ?? null;
  }

  async getRelatedProducts(product: Product, country: CountryCode, limit = 6): Promise<readonly Product[]> {
    return this.products
      .filter(visibleIn(country))
      .filter((other) => other.categorySlug === product.categorySlug && other.id !== product.id)
      .slice(0, limit);
  }
}

/**
 * Factory for the storefront's catalogue adapter. Only "mock" exists today;
 * requesting anything else is a programming error, not a silent fallback, so
 * sample data can never masquerade as live records (SSD §4 rule).
 */
export function createCatalogClient(mode: CatalogClientMode = "mock"): CatalogClient {
  if (mode !== "mock") {
    throw new Error(`Unknown catalog client mode: ${String(mode)}`);
  }
  return new MockCatalogClient();
}
