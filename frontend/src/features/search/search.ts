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

/** Preview text and spec limits, so six hits stay a small response. */
const PREVIEW_DESCRIPTION_CHARS = 600;
const PREVIEW_EXTRA_IMAGES = 4;
const PREVIEW_SPEC_COUNT = 8;

/** Cuts at a word boundary and adds an ellipsis when the text is longer than `max`. */
export function truncateText(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:]+$/, "")}…`;
}

/**
 * Electrical specs a shopper compares first; everything else keeps its
 * catalogue order after them.
 */
const SPEC_PRIORITY = [
  /^model\b/i,
  /watt|power/i,
  /volt/i,
  /amp|current|rating/i,
  /dimension|size|length|diameter/i,
  /colou?r temp|cct|kelvin/i,
  /core|conductor/i,
  /material/i,
  /colou?r/i,
  /compatib/i,
];

function specRank(label: string): number {
  const index = SPEC_PRIORITY.findIndex((pattern) => pattern.test(label));
  return index === -1 ? SPEC_PRIORITY.length : index;
}

/** Specifications with the most useful electrical ones first (stable for ties). */
export function orderSpecifications<T extends { label: string }>(specs: readonly T[]): T[] {
  return specs
    .map((spec, index) => ({ spec, index, rank: specRank(spec.label) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ spec }) => spec);
}

/** The autocomplete shape: what the dropdown and its preview render, nothing more. */
export function toSearchHit(product: Product): ProductSearchHit {
  const description = product.description?.trim();
  const specifications = (product.specifications ?? []).filter(
    (spec) => spec.label.trim().length > 0 && spec.value.trim().length > 0,
  );
  const images = [...new Set(product.images ?? [])].filter((src) => src !== product.image).slice(0, PREVIEW_EXTRA_IMAGES);
  return {
    id: product.id,
    slug: product.slug,
    sku: product.sku,
    name: product.name,
    categoryName: product.categoryName,
    image: product.image,
    priceMinor: product.priceMinor,
    ...(product.wasPriceMinor !== undefined ? { wasPriceMinor: product.wasPriceMinor } : {}),
    currency: product.currency,
    inStock: product.inStock,
    ...(description ? { description: truncateText(description, PREVIEW_DESCRIPTION_CHARS) } : {}),
    ...(specifications.length > 0
      ? { specifications: orderSpecifications(specifications).slice(0, PREVIEW_SPEC_COUNT) }
      : {}),
    ...(images.length > 0 ? { images } : {}),
    ...(product.variants && product.variants.length > 0
      ? { variants: product.variants, ...(product.variantLabel ? { variantLabel: product.variantLabel } : {}) }
      : {}),
    ...(product.colors && product.colors.length > 0 ? { colors: product.colors } : {}),
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
