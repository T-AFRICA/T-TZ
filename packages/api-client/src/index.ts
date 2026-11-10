export type { SearchClient, SearchClientMode } from "./search";
export { createSearchClient, SearchRequestError } from "./search";
export type { CatalogClient, CatalogClientMode } from "./catalog";
export {
  createCatalogClient,
  MockCatalogClient,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  PRODUCT_SORTS,
  PRODUCT_SEARCH_SORTS,
} from "./catalog";
export { normalizeSearchText, rankProducts, relevanceTier, withinOneEdit, SEARCH_MAX_QUERY_LENGTH } from "./product-search";
export { ALL_SAMPLE_PRODUCTS, SPECIAL_FOR_YOU, LIGHTING_PICKS, FANS_COOLING_PICKS } from "./mock/catalog-data";
