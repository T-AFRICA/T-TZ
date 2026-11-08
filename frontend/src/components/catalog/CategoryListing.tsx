import Link from "next/link";
import type { CategoryGroup, CategorySection } from "@tronic/types";
import { ArrowRightIcon, Container, EmptyState } from "@tronic/ui";
import { CATEGORY_SECTIONS } from "@tronic/country-config";
import { CategoryArt } from "@/components/home/CategoryArt";
import { ProductCard } from "@/components/home/ProductCard";
import {
  activeFilterCount,
  catalogClient,
  parseListingFilters,
  toProductQuery,
  type SearchParams,
} from "@/features/catalog/catalog";
import { FilterSheet } from "./FilterSheet";
import { FiltersForm } from "./FiltersForm";
import { Pagination } from "./Pagination";
import { SortSelect } from "./SortSelect";

export function listingBasePath(section: CategorySection, group?: CategoryGroup): string {
  return group ? `/categories/${section.slug}/${group.slug}` : `/categories/${section.slug}`;
}

/**
 * Shared listing for a department (/categories/[slug]) and a group inside it
 * (/categories/[slug]/[group]). The URL carries the filter state; the page is
 * a server component that parses it, asks the catalogue adapter for one page
 * of products (already filtered, sorted and paged for the active country) and
 * renders the existing ProductCard grid. Desktop keeps a sidebar form; phones
 * open the same form in a bottom sheet.
 */
export async function CategoryListing({
  section,
  group,
  searchParams,
}: {
  section: CategorySection;
  group?: CategoryGroup;
  searchParams: SearchParams;
}) {
  const basePath = listingBasePath(section, group);
  const filters = parseListingFilters(searchParams);
  const result = await catalogClient.listProducts(
    toProductQuery(filters, section, group),
  );
  const filterCount = activeFilterCount(filters);
  const title = group ? group.name : section.name;
  const otherSections = CATEGORY_SECTIONS.filter((other) => other.slug !== section.slug);
  const countLabel = `${result.total} ${result.total === 1 ? "product" : "products"}`;
  const headingFont = { fontFamily: "var(--font-heading, var(--font-fallback-heading))" };

  const chip = (active: boolean) =>
    `inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "border-[var(--color-action-red)] bg-[var(--color-action-red)] text-white"
        : "border-[var(--color-light-grey)] bg-white hover:border-[var(--color-action-red)] hover:text-[var(--color-action-red)]"
    }`;

  return (
    <>
      <div className="border-b border-[var(--color-light-grey)] bg-[var(--surface-alt)] max-md:border-b-0 max-md:bg-transparent">
        <Container className="relative py-6 lg:py-10">
          <nav aria-label="Breadcrumb" className="text-xs text-[var(--text-muted)]">
            <ol className="flex flex-wrap items-center gap-1.5">
              <li>
                <Link href="/" className="hover:text-[var(--color-action-red)]">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              {group ? (
                <>
                  <li>
                    <Link href={listingBasePath(section)} className="hover:text-[var(--color-action-red)]">
                      {section.name}
                    </Link>
                  </li>
                  <li aria-hidden="true">/</li>
                </>
              ) : null}
              <li aria-current="page" className="font-medium text-[var(--text-secondary)]">
                {title}
              </li>
            </ol>
          </nav>
          <p className="mt-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-[var(--color-action-red)]">
            <span aria-hidden="true" className="h-px w-8 bg-[var(--color-action-red)]" />
            {group ? section.name : section.kind === "use-case" ? "Use case" : "Department"}
          </p>
          <h1 className="mt-2 text-[length:var(--text-h1)] font-bold leading-tight tracking-[-0.01em]">{title}</h1>
          {!group && section.description ? (
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)]">{section.description}</p>
          ) : null}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 text-[var(--color-light-grey)] md:block lg:right-8"
          >
            <CategoryArt slug={section.slug} size={120} />
          </span>
        </Container>
      </div>

      <Container className="py-6 lg:py-10">
        {/* Group chips: one row, scrolls sideways on phones */}
        <nav aria-label={`${section.name} groups`}>
          <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
            <li className="shrink-0">
              <Link href={listingBasePath(section)} className={chip(!group)} aria-current={!group ? "page" : undefined}>
                All {section.name}
              </Link>
            </li>
            {section.groups.map((g) => (
              <li key={g.slug} className="shrink-0">
                <Link
                  href={listingBasePath(section, g)}
                  className={chip(group?.slug === g.slug)}
                  aria-current={group?.slug === g.slug ? "page" : undefined}
                >
                  {g.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-6 lg:grid lg:grid-cols-[15rem_1fr] lg:gap-10">
          <aside aria-label="Filters" className="hidden lg:block">
            <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-[var(--text-secondary)]" style={headingFont}>
              Filters
            </h2>
            <div className="mt-4">
              <FiltersForm id="listing-filters" action={basePath} facets={result.facets} filters={filters} />
            </div>
          </aside>

          <section aria-label={`${title} products`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="min-w-0 text-sm text-[var(--text-secondary)]" aria-live="polite">
                {countLabel}
                {filterCount > 0 ? (
                  <>
                    {" · "}
                    <Link href={basePath} className="font-medium text-[var(--color-action-red)] hover:underline">
                      Clear filters
                    </Link>
                  </>
                ) : null}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <FilterSheet activeCount={filterCount}>
                  <FiltersForm id="listing-filters-mobile" action={basePath} facets={result.facets} filters={filters} compact />
                </FilterSheet>
                <SortSelect basePath={basePath} filters={filters} />
              </div>
            </div>

            {result.items.length > 0 ? (
              <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 xl:grid-cols-4">
                {result.items.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </ul>
            ) : filterCount > 0 ? (
              <EmptyState
                title="No products match these filters"
                description="Try widening the price range or clearing a filter."
                action={
                  <Link
                    href={basePath}
                    className="inline-flex items-center gap-2 rounded-full bg-[var(--color-action-red)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-action-red-dark)]"
                  >
                    Clear filters
                  </Link>
                }
              />
            ) : (
              <EmptyState
                title={`${title} products are being prepared`}
                description="This range is listed once the catalogue content is approved. Browse another group meanwhile."
                action={
                  group ? (
                    <Link
                      href={listingBasePath(section)}
                      className="inline-flex items-center gap-2 rounded-full bg-[var(--color-action-red)] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-action-red-dark)]"
                    >
                      All {section.name}
                      <ArrowRightIcon size={14} />
                    </Link>
                  ) : undefined
                }
              />
            )}

            <Pagination basePath={basePath} filters={filters} page={result.page} pageCount={result.pageCount} />
          </section>
        </div>

        <nav aria-label="Other departments" className="mt-12">
          <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-[var(--text-secondary)]" style={headingFont}>
            Explore other departments
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2.5">
            {otherSections.map((other) => (
              <li key={other.slug}>
                <Link
                  href={`/categories/${other.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-light-grey)] bg-white px-4 py-2 text-sm font-medium transition-colors hover:border-[var(--color-action-red)] hover:text-[var(--color-action-red)] max-md:border-transparent max-md:shadow-sm"
                >
                  {other.name}
                  <ArrowRightIcon size={14} />
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
    <Container className="py-6 lg:py-10" aria-busy="true">
      <span className="sr-only" role="status">
        Loading products…
      </span>
      <span aria-hidden="true" className={`${block} h-3 w-32`} />
      <span aria-hidden="true" className={`${block} mt-4 h-9 w-56`} />
      <div aria-hidden="true" className="mt-6 flex gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <span key={i} className={`${block} h-9 w-28 rounded-full`} />
        ))}
      </div>
      <ul aria-hidden="true" className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:ml-[19rem] xl:grid-cols-4">
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
