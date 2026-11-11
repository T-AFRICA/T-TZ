import type { CategoryGroup, CategorySection, CategorySubcategory, ProductQuery, ProductSort } from "@tronic/types";
import { DEFAULT_PAGE_SIZE, PRODUCT_SORTS } from "@tronic/api-client";
import { ACTIVE_COUNTRY, toMinorUnits } from "@tronic/country-config";

/**
 * Catalogue feature: the one place the storefront talks to the catalogue
 * adapter and turns listing URLs into queries. Routes call these from server
 * components; the country is always the deployment's active country.
 */
/** Products per listing or search results page. */
export const DEFAULT_LISTING_PAGE_SIZE = DEFAULT_PAGE_SIZE;

/** Query-string keys of a listing URL; the URL is the filter state, so the
 *  browser's back button restores filters and pagination for free. */
export const LISTING_PARAMS = {
  brand: "brand",
  min: "min",
  max: "max",
  stock: "stock",
  sort: "sort",
  page: "page",
} as const;

export const SORT_LABELS: Record<ProductSort, string> = {
  newest: "Newest",
  "price-asc": "Price: Low to High",
  "price-desc": "Price: High to Low",
  "name-asc": "Name: A to Z",
};

export type SearchParams = Record<string, string | string[] | undefined>;

export interface ListingFilters {
  brands: readonly string[];
  /**
   * Price range typed by the customer, in whole currency units (shillings)
   * as shown in the filter and the URL. Converted to minor units only in
   * toProductQuery, never compared with stored prices directly.
   */
  minPriceMajor?: number;
  maxPriceMajor?: number;
  inStockOnly: boolean;
  sort: ProductSort;
  page: number;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function all(value: string | string[] | undefined): string[] {
  if (value === undefined) {
    return [];
  }
  return (Array.isArray(value) ? value : [value]).flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean);
}

function positiveInt(value: string | undefined): number | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
}

/** Largest price filter accepted, in whole units; keeps minor units a safe integer. */
const MAX_PRICE_FILTER = 1_000_000_000;

function priceBound(value: string | undefined): number | undefined {
  const n = positiveInt(value);
  return n === undefined ? undefined : Math.min(n, MAX_PRICE_FILTER);
}

/** Reads and validates listing filters from untrusted search params. */
export function parseListingFilters(searchParams: SearchParams): ListingFilters {
  const sortRaw = first(searchParams[LISTING_PARAMS.sort]);
  const sort = PRODUCT_SORTS.find((s) => s === sortRaw) ?? "newest";
  const minPrice = priceBound(first(searchParams[LISTING_PARAMS.min]));
  const maxPrice = priceBound(first(searchParams[LISTING_PARAMS.max]));
  return {
    brands: all(searchParams[LISTING_PARAMS.brand]).slice(0, 20),
    minPriceMajor: minPrice,
    maxPriceMajor: maxPrice !== undefined && minPrice !== undefined && maxPrice < minPrice ? undefined : maxPrice,
    inStockOnly: first(searchParams[LISTING_PARAMS.stock]) === "1",
    sort,
    page: Math.max(positiveInt(first(searchParams[LISTING_PARAMS.page])) ?? 1, 1),
  };
}

/**
 * Query for a section listing. A department scopes by category, group and
 * subcategory; a use-case section (Shop by Use) scopes by the products' use
 * cases instead, across every department, so nothing is duplicated into a
 * second category.
 */
export function toProductQuery(
  filters: ListingFilters,
  section: CategorySection,
  group?: CategoryGroup,
  subcategory?: CategorySubcategory,
): ProductQuery {
  const scope =
    section.kind === "use-case"
      ? { useCases: group ? [group.slug] : section.groups.map((g) => g.slug) }
      : { category: section.slug, group: group?.slug, subcategory: subcategory?.slug };
  return {
    country: ACTIVE_COUNTRY.code,
    ...scope,
    brands: filters.brands,
    minPriceMinor: filters.minPriceMajor === undefined ? undefined : toMinorUnits(filters.minPriceMajor, ACTIVE_COUNTRY.currency),
    maxPriceMinor: filters.maxPriceMajor === undefined ? undefined : toMinorUnits(filters.maxPriceMajor, ACTIVE_COUNTRY.currency),
    inStockOnly: filters.inStockOnly,
    sort: filters.sort,
    page: filters.page,
    pageSize: DEFAULT_PAGE_SIZE,
  };
}

/** Path of a listing: department, group inside it, or subcategory inside the group. */
export function listingBasePath(
  section: CategorySection,
  group?: CategoryGroup,
  subcategory?: CategorySubcategory,
): string {
  const parts = [section.slug, group?.slug, group ? subcategory?.slug : undefined].filter(Boolean);
  return `/categories/${parts.join("/")}`;
}

/** Builds a listing href from filters, omitting defaults so URLs stay clean. */
export function listingHref(basePath: string, filters: Partial<ListingFilters>): string {
  const params = new URLSearchParams();
  for (const brand of filters.brands ?? []) {
    params.append(LISTING_PARAMS.brand, brand);
  }
  if (filters.minPriceMajor !== undefined) {
    params.set(LISTING_PARAMS.min, String(filters.minPriceMajor));
  }
  if (filters.maxPriceMajor !== undefined) {
    params.set(LISTING_PARAMS.max, String(filters.maxPriceMajor));
  }
  if (filters.inStockOnly) {
    params.set(LISTING_PARAMS.stock, "1");
  }
  if (filters.sort && filters.sort !== "newest") {
    params.set(LISTING_PARAMS.sort, filters.sort);
  }
  if (filters.page && filters.page > 1) {
    params.set(LISTING_PARAMS.page, String(filters.page));
  }
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function activeFilterCount(filters: ListingFilters): number {
  return (
    filters.brands.length +
    (filters.minPriceMajor !== undefined || filters.maxPriceMajor !== undefined ? 1 : 0) +
    (filters.inStockOnly ? 1 : 0)
  );
}
