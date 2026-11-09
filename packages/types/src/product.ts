import type { CountryCode } from "./country";

/**
 * Catalogue contracts (SSD §4). The storefront renders these and only these;
 * the mock client ships synthetic sample records, the live client (Phase 4,
 * Supabase) maps database rows to the same shape so no UI code changes.
 */
export interface ProductColor {
  name: string;
  /** CSS colour for the swatch circle. */
  swatch: string;
}

export interface ProductSpecification {
  label: string;
  value: string;
}

export interface Product {
  /** Stable identifier; also the route slug for /products/[slug]. */
  id: string;
  slug: string;
  sku: string;
  name: string;
  brand?: string;
  /** Marketing copy; absent until the live catalogue supplies it. */
  description?: string;
  categorySlug: string;
  categoryName: string;
  /** Second-level group (subcategory) slug within the category, when assigned. */
  groupSlug?: string;
  /** Use-case slugs (groups of the "use-case" section, e.g. for-homeowners). */
  useCases?: readonly string[];
  image: string;
  /** Additional gallery images, if any. */
  images?: readonly string[];
  /**
   * Price in the listing country's currency, in that currency's minor units
   * (TZS, KES and UGX have none in practice, so these are whole units).
   */
  price: number;
  currency: string;
  /** Pre-discount price; when present the UI shows a saving. */
  wasPrice?: number;
  inStock: boolean;
  /** Countries whose storefront may show this product. */
  countries: readonly CountryCode[];
  /** Inactive products are hidden everywhere, including direct links. */
  active: boolean;
  /** Catalogue order used by the "newest" sort (higher = added later). */
  sequence: number;
  variants?: readonly string[];
  /** What the variant axis is (e.g. "Color Temperature", "Type"). */
  variantLabel?: string;
  colors?: readonly ProductColor[];
  /** Verified specifications only; absent until supplied. */
  specifications?: readonly ProductSpecification[];
}

export type ProductSort = "newest" | "price-asc" | "price-desc" | "name-asc";

export interface ProductQuery {
  /** Always the server-derived active country, never client input. */
  country: CountryCode;
  category?: string;
  group?: string;
  /** Any of these use cases; set instead of category/group for Shop by Use. */
  useCases?: readonly string[];
  brands?: readonly string[];
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  sort?: ProductSort;
  /** 1-based. */
  page?: number;
  pageSize?: number;
}

export interface ProductFacets {
  /** Brands present in the unfiltered category/group scope, sorted. */
  brands: readonly string[];
  /** Price bounds of the unfiltered scope; both 0 when the scope is empty. */
  priceMin: number;
  priceMax: number;
}

export interface ProductPage {
  items: readonly Product[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  facets: ProductFacets;
}
