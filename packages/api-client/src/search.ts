import type { SearchResponse } from "@tronic/types";

/**
 * Typed adapter boundary (SSD §4) for the header autocomplete. The browser
 * never loads the catalogue: it asks the storefront's own GET /api/search
 * route, which searches on the server for the active country and returns at
 * most a handful of slim hits.
 */
export interface SearchClient {
  search(query: string, options?: { signal?: AbortSignal; limit?: number }): Promise<SearchResponse>;
}

export type SearchClientMode = "http";

/** Thrown for any non-OK response; the UI shows a generic message, never the body. */
export class SearchRequestError extends Error {
  constructor(readonly status: number) {
    super(`Search request failed with status ${status}`);
    this.name = "SearchRequestError";
  }
}

class HttpSearchClient implements SearchClient {
  constructor(private readonly endpoint: string) {}

  async search(query: string, options?: { signal?: AbortSignal; limit?: number }): Promise<SearchResponse> {
    const params = new URLSearchParams({ q: query });
    if (options?.limit !== undefined) {
      params.set("limit", String(options.limit));
    }
    const response = await fetch(`${this.endpoint}?${params.toString()}`, {
      signal: options?.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new SearchRequestError(response.status);
    }
    return (await response.json()) as SearchResponse;
  }
}

/**
 * Factory for the storefront's search adapter. Only "http" exists; anything
 * else is a programming error, not a silent fallback (SSD §4 rule).
 */
export function createSearchClient(mode: SearchClientMode = "http", endpoint = "/api/search"): SearchClient {
  if (mode !== "http") {
    throw new Error(`Unknown search client mode: ${String(mode)}`);
  }
  return new HttpSearchClient(endpoint);
}
