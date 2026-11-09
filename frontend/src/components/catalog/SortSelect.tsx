"use client";

import { useRouter } from "next/navigation";
import type { ProductSort } from "@tronic/types";
import { PRODUCT_SORTS } from "@tronic/api-client";
import { listingHref, SORT_LABELS, type ListingFilters } from "@/features/catalog/catalog";

/**
 * Sort control: a native <select> that navigates to the same listing with the
 * chosen sort in the URL (server-side sorting). Changing the sort resets to
 * page 1 and keeps the other filters.
 */
export function SortSelect({ basePath, filters }: { basePath: string; filters: ListingFilters }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-[var(--text-secondary)] max-sm:sr-only">Sort</span>
      <select
        value={filters.sort}
        onChange={(event) => {
          const sort = event.target.value as ProductSort;
          router.push(listingHref(basePath, { ...filters, sort, page: 1 }));
        }}
        className="h-10 rounded-full border border-[var(--color-light-grey)] bg-white pl-3 pr-8 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-action-red)]"
      >
        {PRODUCT_SORTS.map((sort) => (
          <option key={sort} value={sort}>
            {SORT_LABELS[sort]}
          </option>
        ))}
      </select>
    </label>
  );
}
