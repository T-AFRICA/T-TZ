import type { Metadata } from "next";
import Link from "next/link";
import { Container, EmptyState } from "@tronic/ui";
import { CATEGORY_SECTIONS } from "@tronic/country-config";
import { ProductCard } from "@/components/home/ProductCard";
import { Pagination } from "@/components/catalog/Pagination";
import { SortSelect } from "@/components/catalog/SortSelect";
import { PRODUCTS_LINK } from "@/config/site";
import { listingHref, parseAllProductsFilters, toAllProductsQuery, type SearchParams } from "@/features/catalog/catalog";
import { listingMetadata } from "@/features/catalog/metadata";
import { getCatalog } from "@/features/data/source";

const HEADING_FONT = { fontFamily: "var(--font-heading, var(--font-fallback-heading))" };
const BASE_PATH = PRODUCTS_LINK.href;
const TITLE = "All Products";

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<Metadata> {
  return listingMetadata({
    title: TITLE,
    description: `Browse every product at TRONIC Tanzania: ${CATEGORY_SECTIONS.map((section) => section.name.toLowerCase()).join(", ")}.`,
    basePath: BASE_PATH,
    searchParams: await searchParams,
  });
}

/**
 * Every product of the active country in one list (owner request
 * 2026-11-16: the phone tab bar's Products tab opens it). Server-rendered
 * from the URL (stock, sort, page), through the same catalogue adapter,
 * ProductCard grid and pagination as the category listings. The category
 * links at the top lead to those listings, where brand and price filters
 * live.
 */
export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = parseAllProductsFilters(await searchParams);
  const result = await (await getCatalog()).listProducts(toAllProductsQuery(filters));
  const countLabel = `${result.total} ${result.total === 1 ? "product" : "products"}`;
  const pill =
    "inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-[13px] font-medium transition-colors duration-150";
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
                Products
              </li>
            </ol>
          </nav>
          <h1 className="mt-4 text-[1.75rem] font-bold leading-[1.15] tracking-[-0.01em] lg:text-[2rem]" style={HEADING_FONT}>
            {TITLE}
          </h1>
          {/* One row that scrolls sideways on phones; the negative margin lets it
              run to the screen edge without widening the page. */}
          <nav aria-label="Categories" className="no-scrollbar -mx-4 mt-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <ul className="flex items-center gap-2 sm:flex-wrap">
              {CATEGORY_SECTIONS.map((section) => (
                <li key={section.slug} className="shrink-0">
                  <Link href={`/categories/${section.slug}`} className={pillIdle}>
                    {section.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </Container>
      </div>

      <Container className="py-6 lg:py-8">
        <section aria-label="All products">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-[var(--color-light-grey)]/70 pb-3">
            <p className="text-[13px] text-[var(--text-secondary)]" aria-live="polite">
              {countLabel}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href={listingHref(BASE_PATH, { ...filters, inStockOnly: !filters.inStockOnly, page: 1 })}
                aria-pressed={filters.inStockOnly}
                className={filters.inStockOnly ? pillActive : pillIdle}
              >
                In stock only
              </Link>
              <SortSelect basePath={BASE_PATH} filters={filters} />
            </div>
          </div>

          {result.items.length > 0 ? (
            <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
              {result.items.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </ul>
          ) : filters.inStockOnly ? (
            <EmptyState
              title="Nothing is in stock right now"
              description="Show every product, including those that are out of stock."
              action={
                <Link href={listingHref(BASE_PATH, { ...filters, inStockOnly: false, page: 1 })} className={pillIdle}>
                  Show all products
                </Link>
              }
            />
          ) : (
            <EmptyState
              title="Products are being prepared"
              description="Products are listed here once the catalogue content is approved."
            />
          )}

          <Pagination basePath={BASE_PATH} filters={filters} page={result.page} pageCount={result.pageCount} />
        </section>
      </Container>
    </>
  );
}
