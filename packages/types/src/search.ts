import type { CountryCode } from "./country";
import type { Product, ProductSort } from "./product";

/**
 * Product search contracts (SRS FR-006): the header autocomplete, the
 * /api/search route and the /search results page all use these.
 *
 * Results come from the catalogue adapter (mock sample data today, the
 * Supabase adapter later) behind the same types, so the UI does not change
 * when the live catalogue arrives.
 */

/**
 * One autocomplete hit: only the fields the dropdown renders, so the API
 * never sends more product data than the customer can already see.
 */
export interface ProductSearchHit {
  id: string;
  /** Route slug for /products/[slug]. */
  slug: string;
  sku: string;
  name: string;
  categoryName: string;
  image: string;
  /** Country price in the currency's minor units (see Product.price). */
  price: number;
  wasPrice?: number;
  currency: string;
  inStock: boolean;
}

export interface SearchResponse {
  /** The normalised query the results belong to. */
  query: string;
  results: ProductSearchHit[];
  /** Every match for the query, for "View all results". */
  total: number;
  /** True while results come from the mock catalogue, so the UI can label them. */
  simulated: boolean;
}

/** Search-page ordering: relevance (the default) or any listing sort. */
export type ProductSearchSort = "relevance" | ProductSort;

export interface ProductSearchQuery {
  /** Always the server-derived active country, never client input. */
  country: CountryCode;
  /** Raw customer text; the adapter normalises and bounds it. */
  text: string;
  sort?: ProductSearchSort;
  inStockOnly?: boolean;
  /** 1-based. */
  page?: number;
  pageSize?: number;
}

export interface ProductSearchPage {
  /** The normalised query that was searched. */
  query: string;
  items: readonly Product[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/** UI states the search shell must render meaningfully (SRS FR-006). */
export type SearchState = "idle" | "loading" | "results" | "empty" | "error";
