import type { SearchResponse } from "@tronic/types";
import { MockSearchClient } from "./mock/mock-search-client";

/**
 * Typed adapter boundary (SSD §4): the storefront only ever talks to this
 * interface. Week 1-8 ships the mock implementation; the live implementation
 * (backed by GET /api/v1/catalog/products) replaces it during integration
 * (W09+) without touching UI code.
 */
export interface SearchClient {
  search(query: string, options?: { signal?: AbortSignal }): Promise<SearchResponse>;
}

export type SearchClientMode = "mock";

/**
 * Factory for the storefront's search adapter. Only "mock" exists today —
 * requesting anything else is a programming error, not a silent fallback,
 * so mock data can never masquerade as live results (SSD §4 rule).
 */
export function createSearchClient(mode: SearchClientMode = "mock"): SearchClient {
  if (mode !== "mock") {
    throw new Error(`Unknown search client mode: ${String(mode)}`);
  }
  return new MockSearchClient();
}
