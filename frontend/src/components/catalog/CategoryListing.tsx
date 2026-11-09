import Link from "next/link";
import type { CategoryGroup, CategorySection, CategorySubcategory } from "@tronic/types";
import { ArrowRightIcon, Container, EmptyState } from "@tronic/ui";
import { ACTIVE_COUNTRY, CATEGORY_SECTIONS, formatMoney } from "@tronic/country-config";
import { ProductCard } from "@/components/home/ProductCard";
import {
  activeFilterCount,
  catalogClient,
  listingBasePath,
  listingHref,
  parseListingFilters,
  toProductQuery,
  type ListingFilters,
  type SearchParams,
} from "@/features/catalog/catalog";
import { CategoryTree } from "./CategoryTree";
import { FilterSheet } from "./FilterSheet";
import { FiltersForm } from "./FiltersForm";
import { Pagination } from "./Pagination";
import { SortSelect } from "./SortSelect";

export { listingBasePath };

/** Typography scale shared by the listing composition (design pass 2026-11-09). */
const MICRO = "text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]";
const SECTION_TITLE = "text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--text-primary)]";
const HEADING_FONT = { fontFamily: "var(--font-heading, var(--font-fallback-heading))" };

/** Active filters as removable chips: each href is the same listing without that filter. */
function activeFilterChips(basePath: string, filters: ListingFilters): { label: string; href: string }[] {
  const chips: { label: string; href: string }[] = [];
  for (const brand of filters.brands) {
    chips.push({
      label: brand,
      href: listingHref(basePath, { ...filters, brands: filters.brands.filter((b) => b !== brand), page: 1 }),
    });
  }
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    const min = filters.minPrice !== undefined ? formatMoney(filters.minPrice, ACTIVE_COUNTRY) : null;
    const max = filters.maxPrice !== undefined ? formatMoney(filters.maxPrice, ACTIVE_COUNTRY) : null;
    chips.push({
      label: min && max ? `${min} – ${max}` : min ? `From ${min}` : `Up to ${max}`,
      href: listingHref(basePath, { ...filters, minPrice: undefined, maxPrice: undefined, page: 1 }),
    });
  }
  if (filters.inStockOnly) {
    chips.push({ label: "In stock", href: listingHref(basePath, { ...filters, inStockOnly: false, page: 1 }) });
  }
  return chips;
}

/**
 * Shared listing for a department (/categories/[slug]), a group inside it
 * (/categories/[slug]/[group]) and a subcategory inside the group
 * (/categories/[slug]/[group]/[subcategory]). The URL carries the filter
 * state; the page is a server component that parses it, asks the catalogue
 * adapter for one page of products (already filtered, sorted and paged for
 * the active country) and renders the existing ProductCard grid.
 *
 * Composition: a compact white header (breadcrumb, parent label, 28–32px
 * title, one-line description), then a sidebar (desktop) or bottom sheet
 * (phones) holding the category tree and the filter form, and the product
 * area with a hairline toolbar (count, removable filter chips, sort), the
 * grid, pagination and, when a node has one or two products, the sibling
 * ranges so a short page still reads as intentional.
 */
export async function CategoryListing({
  section,
  group,
  subcategory,
  searchParams,
}: {
  section: CategorySection;
  group?: CategoryGroup;
  subcategory?: CategorySubcategory;
  searchParams: SearchParams;
}) {
  const basePath = listingBasePath(section, group, subcategory);
  const filters = parseListingFilters(searchParams);
  const result = await catalogClient.listProducts(toProductQuery(filters, section, group, subcategory));
  const filterCount = activeFilterCount(filters);
  const chips = activeFilterChips(basePath, filters);
  const title = subcategory ? subcategory.name : group ? group.name : section.name;
  const parentPath = subcategory && group ? listingBasePath(section, group) : listingBasePath(section);
  const parentName = subcategory && group ? group.name : section.name;
  const otherSections = CATEGORY_SECTIONS.filter((other) => other.slug !== section.slug);
  const countLabel = `${result.total} ${result.total === 1 ? "product" : "products"}`;
  const treeKey = `${section.slug}/${group?.slug ?? ""}`;

  /* Sibling ranges shown under a short grid (1–2 products) or an empty one:
     the other subcategories of the group, or the other groups of the section. */
  const siblings: { name: string; href: string }[] =
    subcategory && group
      ? (group.subcategories ?? []).filter((s) => s.slug !== subcategory.slug).map((s) => ({ name: s.name, href: listingBasePath(section, group, s) }))
      : group
        ? section.groups.filter((g) => g.slug !== group.slug).map((g) => ({ name: g.name, href: listingBasePath(section, g) }))
        : [];
  const showSiblings = siblings.length > 0 && result.total <= 2 && filterCount === 0;

  const filtersPanel = (compact: boolean) => (
    <>
      <CategoryTree key={treeKey} section={section} activeGroup={group?.slug} activeSubcategory={subcategory?.slug} filters={filters} />
      <h2 className={`${SECTION_TITLE} ${compact ? "mt-6" : "mt-7"} border-t border-[var(--color-light-grey)]/70 pt-5`}>Filters</h2>
      <div className="mt-3">
        <FiltersForm
          id={compact ? "listing-filters-mobile" : "listing-filters"}
          action={basePath}
          facets={result.facets}
          filters={filters}
          compact={compact}
        />
      </div>
    </>
  );

  const secondaryButton =
    "inline-flex h-9 items-center gap-2 rounded-md border border-[var(--color-light-grey)] bg-white px-4 text-[13px] font-medium text-[var(--text-primary)] transition-colors duration-150 hover:border-[var(--color-premium-black)]";

  return (
    <>
      {/* Compact header: white, hairline below; no decorative art. */}
      <div className="border-b border-[var(--color-light-grey)]/70 bg-white">
        <Container className="py-5 lg:py-7">
          <nav aria-label="Breadcrumb" className="text-xs text-[var(--text-muted)]">
            <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <li>
                <Link href="/" className="transition-colors hover:text-[var(--color-action-red)]">
                  Home
                </Link>
              </li>
              <li aria-hidden="true" className="text-[var(--color-light-grey)]">/</li>
              {group ? (
                <>
                  <li>
                    <Link href={listingBasePath(section)} className="transition-colors hover:text-[var(--color-action-red)]">
                      {section.name}
                    </Link>
                  </li>
                  <li aria-hidden="true" className="text-[var(--color-light-grey)]">/</li>
                </>
              ) : null}
              {subcategory && group ? (
                <>
                  <li>
                    <Link href={listingBasePath(section, group)} className="transition-colors hover:text-[var(--color-action-red)]">
                      {group.name}
                    </Link>
                  </li>
                  <li aria-hidden="true" className="text-[var(--color-light-grey)]">/</li>
                </>
              ) : null}
              <li aria-current="page" className="font-medium text-[var(--text-secondary)]">
                {title}
              </li>
            </ol>
          </nav>
          <div className="mt-4">
            {group ? <p className={MICRO}>{subcategory ? group.name : section.name}</p> : null}
            <h1
              className="mt-1 text-[1.75rem] font-bold leading-[1.15] tracking-[-0.01em] lg:text-[2rem]"
              style={HEADING_FONT}
            >
              {title}
            </h1>
            {!group && section.description ? (
              <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)]">{section.description}</p>
            ) : null}
          </div>
        </Container>
      </div>

      <Container className="py-6 lg:py-8">
        <div className="lg:grid lg:grid-cols-[17rem_1fr] lg:gap-8 xl:gap-10">
          {/* Sidebar: category tree, then filters. Its sticky top is the sticky
              header (--header-height at lg; the category navbar has scrolled
              away by then) plus 12px.
              It sticks (and scrolls inside itself) only on viewports tall
              enough to show most of it. */}
          <aside
            aria-label="Categories and filters"
            className="no-scrollbar hidden lg:block lg:self-start lg:pr-2 [@media(min-height:860px)]:lg:sticky [@media(min-height:860px)]:lg:top-[calc(var(--header-height)_+_0.75rem)] [@media(min-height:860px)]:lg:max-h-[calc(100vh_-_var(--header-height)_-_1.75rem)] [@media(min-height:860px)]:lg:overflow-y-auto"
          >
            {filtersPanel(false)}
          </aside>

          <section aria-label={`${title} products`} className="min-w-0">
            {/* Toolbar: count and active filters left, sheet button and sort right. */}
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-[var(--color-light-grey)]/70 pb-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p className="text-[13px] text-[var(--text-secondary)]" aria-live="polite">
                  {countLabel}
                </p>
                {chips.length > 0 ? (
                  <ul className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
                    {chips.map((chip) => (
                      <li key={chip.label}>
                        <Link
                          href={chip.href}
                          aria-label={`Remove filter: ${chip.label}`}
                          className="inline-flex h-7 items-center gap-1 rounded-full border border-[var(--color-light-grey)] bg-white pl-2.5 pr-1.5 text-[12px] font-medium text-[var(--text-primary)] transition-colors duration-150 hover:border-[var(--color-action-red)] hover:text-[var(--color-action-red)]"
                        >
                          {chip.label}
                          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M3 3l6 6M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </Link>
                      </li>
                    ))}
                    <li>
                      <Link href={basePath} className="text-[12px] font-medium text-[var(--text-secondary)] underline-offset-2 hover:text-[var(--color-action-red)] hover:underline">
                        Clear all
                      </Link>
                    </li>
                  </ul>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <FilterSheet activeCount={filterCount}>{filtersPanel(true)}</FilterSheet>
                <SortSelect basePath={basePath} filters={filters} />
              </div>
            </div>

            {result.items.length > 0 ? (
              <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 xl:grid-cols-4 2xl:grid-cols-5">
                {result.items.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </ul>
            ) : filterCount > 0 ? (
              <EmptyState
                title="No products match these filters"
                description="Try widening the price range or clearing a filter."
                action={
                  <Link href={basePath} className={secondaryButton}>
                    Clear filters
                  </Link>
                }
              />
            ) : (
              <EmptyState
                title={`${title} products are being prepared`}
                description="This range is listed once the catalogue content is approved."
                action={
                  group ? (
                    <Link href={parentPath} className={secondaryButton}>
                      All {parentName}
                      <ArrowRightIcon size={14} />
                    </Link>
                  ) : undefined
                }
              />
            )}

            {showSiblings ? (
              <nav aria-label={`More in ${parentName}`} className="mt-8 border-t border-[var(--color-light-grey)]/70 pt-5">
                <h2 className={MICRO}>More in {parentName}</h2>
                <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                  {siblings.map((sibling) => (
                    <li key={sibling.href}>
                      <Link
                        href={sibling.href}
                        className="inline-flex items-center gap-1 text-[13px] text-[var(--text-secondary)] transition-colors hover:text-[var(--color-action-red)]"
                      >
                        {sibling.name}
                        <ArrowRightIcon size={12} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}

            <Pagination basePath={basePath} filters={filters} page={result.page} pageCount={result.pageCount} />
          </section>
        </div>

        <nav aria-label="Other categories" className="mt-12 border-t border-[var(--color-light-grey)]/70 pt-6">
          <h2 className={MICRO}>Explore other categories</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {otherSections.map((other) => (
              <li key={other.slug}>
                <Link
                  href={`/categories/${other.slug}`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--color-light-grey)] bg-white px-3.5 text-[13px] font-medium transition-colors duration-150 hover:border-[var(--color-premium-black)]"
                >
                  {other.name}
                  <ArrowRightIcon size={12} />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
    </>
  );
}

/** Skeleton shown by loading.tsx while a listing page renders on the server. */
export function CategoryListingSkeleton() {
  const block = "block animate-pulse rounded-md bg-[var(--color-light-grey)]/70";
  return (
    <Container className="py-6 lg:py-8" aria-busy="true">
      <span className="sr-only" role="status">
        Loading products…
      </span>
      <span aria-hidden="true" className={`${block} h-3 w-32`} />
      <span aria-hidden="true" className={`${block} mt-4 h-8 w-56`} />
      <div aria-hidden="true" className="mt-8 flex items-center justify-between">
        <span className={`${block} h-3 w-20`} />
        <span className={`${block} h-9 w-36`} />
      </div>
      <ul aria-hidden="true" className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:ml-[19rem] xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i} className="rounded-xl border border-transparent p-2 md:border-[var(--color-light-grey)]">
            <span className={`${block} aspect-[4/3] w-full rounded-lg`} />
            <span className={`${block} mt-3 h-3 w-1/2`} />
            <span className={`${block} mt-2 h-4 w-5/6`} />
            <span className={`${block} mt-3 h-4 w-1/3`} />
            <span className={`${block} mt-3 h-8 w-full rounded-full`} />
          </li>
        ))}
      </ul>
    </Container>
  );
}
