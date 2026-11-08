import type { ProductFacets } from "@tronic/types";
import { ACTIVE_COUNTRY, formatMoney } from "@tronic/country-config";
import { LISTING_PARAMS, type ListingFilters } from "@/features/catalog/catalog";

/**
 * The filter controls as a plain GET form: brand, price range and
 * availability. Submitting navigates to the same listing with the filters in
 * the query string (server-side filtering), so it works without JavaScript
 * and the URL stays shareable. The sort is kept as a hidden field so changing
 * filters does not reset it; the page is deliberately dropped.
 */
export function FiltersForm({
  action,
  facets,
  filters,
  id,
  compact = false,
}: {
  action: string;
  facets: ProductFacets;
  filters: ListingFilters;
  id: string;
  compact?: boolean;
}) {
  const priceHint = `${formatMoney(facets.priceMin, ACTIVE_COUNTRY)} – ${formatMoney(facets.priceMax, ACTIVE_COUNTRY)}`;
  const field = "w-full rounded-lg border border-[var(--color-light-grey)] bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-action-red)]";
  const legend = "text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--text-secondary)]";

  return (
    <form id={id} action={action} method="get" className={compact ? "space-y-5" : "space-y-6"}>
      {filters.sort !== "newest" ? <input type="hidden" name={LISTING_PARAMS.sort} value={filters.sort} /> : null}

      {facets.brands.length > 0 ? (
        <fieldset>
          <legend className={legend}>Brand</legend>
          <ul className="mt-2.5 space-y-2">
            {facets.brands.map((brand) => (
              <li key={brand}>
                <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    name={LISTING_PARAMS.brand}
                    value={brand}
                    defaultChecked={filters.brands.includes(brand)}
                    className="h-4 w-4 accent-[var(--color-action-red)]"
                  />
                  {brand}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ) : null}

      <fieldset>
        <legend className={legend}>Price ({ACTIVE_COUNTRY.currency})</legend>
        {facets.priceMax > 0 ? (
          <p className="mt-1 text-xs text-[var(--text-muted)]">Range in this section: {priceHint}</p>
        ) : null}
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <label className="block">
            <span className="sr-only">Minimum price</span>
            <input
              type="number"
              inputMode="numeric"
              name={LISTING_PARAMS.min}
              min={0}
              step={500}
              placeholder="Min"
              defaultValue={filters.minPrice ?? ""}
              className={field}
            />
          </label>
          <label className="block">
            <span className="sr-only">Maximum price</span>
            <input
              type="number"
              inputMode="numeric"
              name={LISTING_PARAMS.max}
              min={0}
              step={500}
              placeholder="Max"
              defaultValue={filters.maxPrice ?? ""}
              className={field}
            />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend className={legend}>Availability</legend>
        <label className="mt-2.5 flex cursor-pointer items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            name={LISTING_PARAMS.stock}
            value="1"
            defaultChecked={filters.inStockOnly}
            className="h-4 w-4 accent-[var(--color-action-red)]"
          />
          In stock only
        </label>
      </fieldset>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="inline-flex h-10 flex-1 items-center justify-center rounded-full bg-[var(--color-action-red)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-action-red-dark)]"
        >
          Apply filters
        </button>
        <a
          href={action}
          className="inline-flex h-10 items-center justify-center rounded-full border border-[var(--color-light-grey)] px-4 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--color-action-red)] hover:text-[var(--color-action-red)]"
        >
          Clear
        </a>
      </div>
    </form>
  );
}
