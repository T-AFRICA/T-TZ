import type { Product, ProductSearchHit, ProductSearchSort } from "@tronic/types";
import { PRODUCT_SEARCH_SORTS, SEARCH_MAX_QUERY_LENGTH, normalizeSearchText } from "@tronic/api-client";
import { SORT_LABELS, type SearchParams } from "@/features/catalog/catalog";

/** Results shown in the header autocomplete. */
export const AUTOCOMPLETE_LIMIT = 6;
/** Hard cap the API accepts for `limit`. */
export const AUTOCOMPLETE_MAX_LIMIT = 8;
/** Raw `q` longer than this is refused outright (normal input is cut to SEARCH_MAX_QUERY_LENGTH). */
export const RAW_QUERY_LIMIT = 200;

export const SEARCH_PATH = "/search";

export const SEARCH_SORT_LABELS: Record<ProductSearchSort, string> = {
  relevance: "Best match",
  ...SORT_LABELS,
};

/** The slim autocomplete shape: what the dropdown renders, nothing more. */
export function toSearchHit(product: Product): ProductSearchHit {
  return {
    id: product.id,
    slug: product.slug,
    sku: product.sku,
    name: product.name,
    categoryName: product.categoryName,
    image: product.image,
    price: product.price,
    ...(product.wasPrice !== undefined ? { wasPrice: product.wasPrice } : {}),
    currency: product.currency,
    inStock: product.inStock,
  };
}

export interface SearchPageParams {
  q: string;
  sort: ProductSearchSort;
  inStockOnly: boolean;
  page: number;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Reads and validates /search params from the untrusted URL. */
export function parseSearchPageParams(searchParams: SearchParams): SearchPageParams {
  const sortRaw = first(searchParams.sort);
  const pageRaw = Number(first(searchParams.page));
  return {
    q: normalizeSearchText((first(searchParams.q) ?? "").slice(0, RAW_QUERY_LIMIT)),
    sort: PRODUCT_SEARCH_SORTS.find((s) => s === sortRaw) ?? "relevance",
    inStockOnly: first(searchParams.stock) === "1",
    page: Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1,
  };
}

/** /search URL for the given state, omitting defaults; values are URL-encoded. */
export function searchHref(params: Partial<SearchPageParams> & { q: string }): string {
  const query = new URLSearchParams({ q: params.q.slice(0, SEARCH_MAX_QUERY_LENGTH) });
  if (params.sort && params.sort !== "relevance") query.set("sort", params.sort);
  if (params.inStockOnly) query.set("stock", "1");
  if (params.page && params.page > 1) query.set("page", String(params.page));
  return `${SEARCH_PATH}?${query.toString()}`;
}
