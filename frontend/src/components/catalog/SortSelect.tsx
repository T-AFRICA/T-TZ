"use client";

import { useRouter } from "next/navigation";
import type { ProductSort } from "@tronic/types";
import { PRODUCT_SORTS } from "@tronic/api-client";
import { ChevronDownIcon } from "@tronic/ui";
import { listingHref, SORT_LABELS, type ListingFilters } from "@/features/catalog/catalog";

/**
 * Sort control: a native <select> that navigates to the same listing with the
 * chosen sort in the URL (server-side sorting). Changing the sort resets to
 * page 1 and keeps the other filters. Styled to the toolbar's 36px control
 * height with its own chevron; the native menu stays for accessibility.
 */
export function SortSelect({ basePath, filters }: { basePath: string; filters: ListingFilters }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2">
      <span className="text-[12px] text-[var(--text-muted)] max-sm:sr-only">Sort by</span>
      <span className="relative">
        <select
          value={filters.sort}
          onChange={(event) => {
            const sort = event.target.value as ProductSort;
            router.push(listingHref(basePath, { ...filters, sort, page: 1 }));
          }}
          className="h-9 appearance-none rounded-md border border-[var(--color-light-grey)] bg-white pl-3 pr-8 text-[13px] font-medium text-[var(--text-primary)] transition-colors duration-150 hover:border-[var(--color-premium-black)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-action-red)]"
        >
          {PRODUCT_SORTS.map((sort) => (
            <option key={sort} value={sort}>
              {SORT_LABELS[sort]}
            </option>
          ))}
        </select>
        <span aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
          <ChevronDownIcon size={14} />
        </span>
      </span>
    </label>
  );
}
