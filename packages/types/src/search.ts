/**
 * Search contract for the header search shell (SRS FR-006).
 *
 * Week 1-8 runs against a clearly labeled mock adapter; the live adapter
 * replaces it behind the same types during integration (W09+).
 */
export interface SearchResultItem {
  /** Stable identifier of the product or category hit. */
  id: string;
  /** Display title. */
  title: string;
  /** Route the result links to. */
  href: string;
  /** Section the hit belongs to, e.g. "Lighting". */
  section: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResultItem[];
  /** True while results come from the mock adapter, so UI can label them. */
  simulated: boolean;
}

/** UI states the search shell must render meaningfully (SRS FR-006). */
export type SearchState = "idle" | "loading" | "results" | "empty" | "error";
