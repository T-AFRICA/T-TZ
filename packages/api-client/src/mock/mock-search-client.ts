import type { SearchResponse, SearchResultItem } from "@tronic/types";
import { CATEGORY_SECTIONS } from "@tronic/country-config";
import type { SearchClient } from "../search";

/**
 * Mock search over synthetic sample products derived from the approved
 * category taxonomy. Every record is clearly synthetic (SAMPLE prefix, no
 * real SKUs, prices or stock — SRS content rule: never invent production
 * SKUs). Responses are flagged `simulated: true` so the UI labels them.
 */
const SAMPLE_ITEMS: SearchResultItem[] = CATEGORY_SECTIONS.flatMap((section) =>
  section.groups.map((group) => ({
    id: `sample-${section.slug}-${group.slug}`,
    title: `SAMPLE — ${group.name}`,
    href: `/categories/${section.slug}`,
    section: section.name,
  })),
);

const SIMULATED_LATENCY_MS = 250;

export class MockSearchClient implements SearchClient {
  async search(query: string, options?: { signal?: AbortSignal }): Promise<SearchResponse> {
    await delay(SIMULATED_LATENCY_MS, options?.signal);
    const needle = query.trim().toLowerCase();
    const results =
      needle.length === 0
        ? []
        : SAMPLE_ITEMS.filter(
            (item) =>
              item.title.toLowerCase().includes(needle) ||
              item.section.toLowerCase().includes(needle),
          ).slice(0, 8);
    return { query, results, simulated: true };
  }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(abortError());
      },
      { once: true },
    );
  });
}

function abortError(): Error {
  return new DOMException("The operation was aborted.", "AbortError");
}
