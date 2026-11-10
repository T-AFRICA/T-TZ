import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, Container, EmptyState } from "@tronic/ui";
import { ACTIVE_COUNTRY, CATEGORY_SECTIONS } from "@tronic/country-config";
import { PRODUCT_SEARCH_SORTS } from "@tronic/api-client";
import { ProductCard } from "@/components/home/ProductCard";
import { Pagination } from "@/components/catalog/Pagination";
import { catalogClient, DEFAULT_LISTING_PAGE_SIZE, type SearchParams } from "@/features/catalog/catalog";
import { parseSearchPageParams, searchHref, SEARCH_SORT_LABELS } from "@/features/search/search";

const MICRO = "text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]";
const HEADING_FONT = { fontFamily: "var(--font-heading, var(--font-fallback-heading))" };

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<Metadata> {
  const { q } = parseSearchPageParams(await searchParams);
  return {
    title: q ? `Search: ${q}` : "Search",
    // Result pages are endless permutations of user text: keep them out of the index.
    robots: { index: false, follow: true },
  };
}

/**
 * Full search results (/search?q=…), opened by Enter or "View all results"
 * in the header search. Server-rendered from the URL (query, sort, in-stock,
 * page), so refresh, back and shared links all work. Searches the active
 * country only, through the same catalogue adapter and ranking as the
 * autocomplete, and reuses the listing's ProductCard grid and pagination.
 */
export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = parseSearchPageParams(await searchParams);
  const { q } = params;
  const result = q
    ? await catalogClient.searchProducts({
        country: ACTIVE_COUNTRY.code,
        text: q,
        sort: params.sort,
        inStockOnly: params.inStockOnly,
        page: params.page,
        pageSize: DEFAULT_LISTING_PAGE_SIZE,
      })
    : null;
  const countLabel = result ? `${result.total} ${result.total === 1 ? "product" : "products"}` : "";
  const pill =
    "inline-flex h-8 items-center rounded-full border px-3.5 text-[13px] font-medium transition-colors duration-150";
  const pillIdle = `${pill} border-[var(--color-light-grey)] bg-white text-[var(--text-primary)] hover:border-[var(--color-premium-black)]`;
  const pillActive = `${pill} border-[var(--color-premium-black)] bg-[var(--color-premium-black)] text-white`;

  return (
    <>
      <div className="border-b border-[var(--color-light-grey)]/70 bg-white">
        <Container className="py-5 lg:py-7">
          <nav aria-label="Breadcrumb" className="text-xs text-[var(--text-muted)]">
            <ol className="flex flex-wrap items-center gap-x-1.5">
              <li>
                <Link href="/" className="transition-colors hover:text-[var(--color-action-red)]">
                  Home
                </Link>
              </li>
              <li aria-hidden="true" className="text-[var(--color-light-grey)]">/</li>
              <li aria-current="page" className="font-medium text-[var(--text-secondary)]">
                Search
              </li>
            </ol>
          </nav>
          <p className={`${MICRO} mt-4`}>Search results</p>
          <h1
            className="mt-1 break-words text-[1.75rem] font-bold leading-[1.15] tracking-[-0.01em] lg:text-[2rem]"
            style={HEADING_FONT}
          >
            {q ? `“${q}”` : "Search products"}
          </h1>
        </Container>
      </div>

      <Container className="py-6 lg:py-8">
        {!q ? (
          <EmptyState
            title="What are you looking for?"
            description="Type a product name, SKU or model number in the search bar above."
          />
        ) : result && result.total === 0 && !params.inStockOnly ? (
          <>
            <EmptyState
              title={`No products match “${q}”`}
              description="Check the spelling, try fewer words, or search by SKU. You can also browse a category."
            />
            <nav aria-label="Categories" className="mt-8">
              <h2 className={MICRO}>Browse categories</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {CATEGORY_SECTIONS.map((section) => (
                  <li key={section.slug}>
                    <Link href={`/categories/${section.slug}`} className={`${pillIdle} gap-1.5`}>
                      {section.name}
                      <ArrowRightIcon size={12} />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </>
        ) : result ? (
          <section aria-label="Search results">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-[var(--color-light-grey)]/70 pb-3">
              <p className="text-[13px] text-[var(--text-secondary)]" aria-live="polite">
                {countLabel}
              </p>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Link
                  href={searchHref({ ...params, inStockOnly: !params.inStockOnly, page: 1 })}
                  aria-pressed={params.inStockOnly}
                  className={params.inStockOnly ? pillActive : pillIdle}
                >
                  In stock only
                </Link>
                <span aria-hidden="true" className="mx-1 h-5 w-px bg-[var(--color-light-grey)] max-sm:hidden" />
                <nav aria-label="Sort results" className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                  <ul className="flex items-center gap-2">
                    {PRODUCT_SEARCH_SORTS.map((sort) => (
                      <li key={sort} className="shrink-0">
                        <Link
                          href={searchHref({ ...params, sort, page: 1 })}
                          aria-current={sort === params.sort ? "true" : undefined}
                          className={sort === params.sort ? pillActive : pillIdle}
                        >
                          {SEARCH_SORT_LABELS[sort]}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              </div>
            </div>

            {result.items.length > 0 ? (
              <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
                {result.items.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </ul>
            ) : (
              <EmptyState
                title="Nothing in stock for this search"
                description="Show every match, including products that are out of stock."
                action={
                  <Link href={searchHref({ ...params, inStockOnly: false, page: 1 })} className={pillIdle}>
                    Show all matches
                  </Link>
                }
              />
            )}

            <Pagination
              page={result.page}
              pageCount={result.pageCount}
              hrefFor={(page) => searchHref({ ...params, page })}
            />
          </section>
        ) : null}
      </Container>
    </>
  );
}
