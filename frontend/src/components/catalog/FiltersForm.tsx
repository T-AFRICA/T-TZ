import type { ProductFacets } from "@tronic/types";
import { ACTIVE_COUNTRY, formatMoney } from "@tronic/country-config";
import { LISTING_PARAMS, type ListingFilters } from "@/features/catalog/catalog";

/**
 * The filter controls as a plain GET form: brand, price range and
 * availability. Submitting navigates to the same listing with the filters in
 * the query string (server-side filtering), so it works without JavaScript
 * and the URL stays shareable. The sort is kept as a hidden field so changing
 * filters does not reset it; the page is deliberately dropped.
 *
 * Visual system (design pass 2026-11-09): 12px semibold uppercase section
 * labels, 13px controls on a 36px height, red only on the checked state, a
 * charcoal Apply button so it does not compete with product CTAs, and Clear
 * as a quiet text link.
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
  const priceHint = `${formatMoney(facets.minPriceMinor, ACTIVE_COUNTRY)} – ${formatMoney(facets.maxPriceMinor, ACTIVE_COUNTRY)}`;
  const field =
    "h-9 w-full rounded-md border border-[var(--color-light-grey)] bg-white px-3 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors duration-150 hover:border-[var(--color-dark-grey)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-action-red)]";
  const legend = "text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]";
  const checkbox = "h-4 w-4 shrink-0 rounded-[4px] border-[var(--color-light-grey)] accent-[var(--color-action-red)]";
  const option = "flex cursor-pointer items-center gap-2.5 py-1 text-[13px] text-[var(--text-primary)] transition-colors hover:text-[var(--color-action-red)]";

  return (
    <form id={id} action={action} method="get" className={compact ? "space-y-5" : "space-y-6"}>
      {filters.sort !== "newest" ? <input type="hidden" name={LISTING_PARAMS.sort} value={filters.sort} /> : null}

      {facets.brands.length > 0 ? (
        <fieldset>
          <legend className={legend}>Brand</legend>
          <ul className="mt-2 space-y-0.5">
            {facets.brands.map((brand) => (
              <li key={brand}>
                <label className={option}>
                  <input
                    type="checkbox"
                    name={LISTING_PARAMS.brand}
                    value={brand}
                    defaultChecked={filters.brands.includes(brand)}
                    className={checkbox}
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
        <div className="mt-2.5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <label className="block">
            <span className="sr-only">Minimum price</span>
            <input
              type="number"
              inputMode="numeric"
              name={LISTING_PARAMS.min}
              min={0}
              step={500}
              placeholder="Min"
              defaultValue={filters.minPriceMajor ?? ""}
              className={field}
            />
          </label>
          <span aria-hidden="true" className="text-[var(--text-muted)]">
            –
          </span>
          <label className="block">
            <span className="sr-only">Maximum price</span>
            <input
              type="number"
              inputMode="numeric"
              name={LISTING_PARAMS.max}
              min={0}
              step={500}
              placeholder="Max"
              defaultValue={filters.maxPriceMajor ?? ""}
              className={field}
            />
          </label>
        </div>
        {facets.maxPriceMinor > 0 ? (
          <p className="mt-2 text-[12px] text-[var(--text-muted)]">Range here: {priceHint}</p>
        ) : null}
      </fieldset>

      <fieldset>
        <legend className={legend}>Availability</legend>
        <label className={`${option} mt-2`}>
          <input
            type="checkbox"
            name={LISTING_PARAMS.stock}
            value="1"
            defaultChecked={filters.inStockOnly}
            className={checkbox}
          />
          In stock only
        </label>
      </fieldset>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          className="inline-flex h-9 flex-1 items-center justify-center rounded-md bg-[var(--color-premium-black)] px-4 text-[13px] font-semibold text-white transition-colors duration-150 hover:bg-black"
        >
          Apply filters
        </button>
        <a
          href={action}
          className="text-[13px] font-medium text-[var(--text-secondary)] underline-offset-2 transition-colors hover:text-[var(--color-action-red)] hover:underline"
        >
          Clear
        </a>
      </div>
    </form>
  );
}
