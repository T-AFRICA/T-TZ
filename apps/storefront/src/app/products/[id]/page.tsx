import Link from "next/link";
import { notFound } from "next/navigation";
import { AccordionSection, Container, EmptyState } from "@tronic/ui";
import { getCategorySection } from "@tronic/country-config";
import { ProductGallery } from "@/components/product/ProductGallery";
import { PurchasePanel } from "@/components/product/PurchasePanel";
import { RecentlyViewed } from "@/components/product/RecentlyViewed";
import { ProductSection } from "@/components/home/ProductSection";
import {
  allSampleProducts,
  getSampleProduct,
  relatedSampleProducts,
} from "@/components/home/sampleProducts";
import { POLICY_LINKS, CHECK_WARRANTY_LINK } from "@/config/site";

export function generateStaticParams() {
  return allSampleProducts().map((product) => ({ id: product.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = getSampleProduct(id);
  return {
    title: product ? product.name : "Product",
    description: product
      ? `${product.name} — ${product.categoryName} at TRONIC Tanzania (sample catalogue entry).`
      : undefined,
  };
}

function policyHref(label: string): string {
  return POLICY_LINKS.find((link) => link.label === label)?.href ?? "/help";
}

/**
 * Product details page on the SAMPLE catalogue (SRS: no invented ratings,
 * reviews, specs or inventory — every such section states honestly that
 * the data arrives with the live catalog / Module 02). Two-column desktop
 * (gallery left, buy box right), reference-style mobile with a sticky
 * purchase bar. No Product JSON-LD while prices are synthetic: structured
 * data must never present sample figures as real offers.
 */
export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = getSampleProduct(id);
  if (!product) {
    notFound();
  }

  const related = relatedSampleProducts(product);
  const section = getCategorySection(product.categorySlug);

  return (
    <Container className="pt-3 pb-24 sm:pt-4 md:py-10 md:pb-16">
      <div className="grid gap-5 md:grid-cols-2 md:gap-10 lg:gap-16">
        <ProductGallery product={product} />

        <div>
          {/* Breadcrumb lives in the info column (approved reference) */}
          <nav aria-label="Breadcrumb" className="text-xs text-[var(--text-muted)]">
            <ol className="flex flex-wrap items-center gap-1.5">
              <li>
                <Link href="/" className="hover:text-[var(--color-action-red)]">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link
                  href={`/categories/${product.categorySlug}`}
                  className="hover:text-[var(--color-action-red)]"
                >
                  {product.categoryName}
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="truncate font-medium text-[var(--text-secondary)]">
                {product.name}
              </li>
            </ol>
          </nav>

          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
            TRONIC · {product.categoryName}
          </p>
          <h1
            className="mt-1.5 text-2xl font-bold leading-tight md:text-[length:var(--text-h2)] md:tracking-[-0.01em]"
            style={{ fontFamily: "var(--font-heading, var(--font-fallback-heading))" }}
          >
            {product.name}
          </h1>
          {/* Short description — generic by design: the real marketing copy
              is written with the live catalogue, never invented here. On
              phones the price moves directly under the title, so this line
              lives in the Product overview accordion instead. */}
          <p className="mt-3 hidden max-w-md text-sm leading-relaxed text-[var(--text-secondary)] md:block">
            Reliable {product.categoryName.toLowerCase()} for homes, businesses and industry. The
            full product description arrives with the live catalogue.
          </p>

          <PurchasePanel product={product} />

          {/* Honest sample-data notice (SRS content rule) — discreet one-liner;
              the SAMPLE chip on the photo carries the main signal */}
          <p className="mt-4 text-[11px] leading-snug text-[var(--text-muted)]">
            Sample data — prices, options and stock are demonstration values until the live
            catalog launches.
          </p>

          <div className="mt-6 border-t border-[var(--color-light-grey)]">
            <AccordionSection title="Product overview" defaultOpen>
              <p>
                {product.name} from the TRONIC {product.categoryName.toLowerCase()} range. The
                full marketing description for this product is written with the live catalogue
                content.
              </p>
            </AccordionSection>
            <AccordionSection title="Specifications">
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
                <dt className="font-medium text-[var(--text-primary)]">Category</dt>
                <dd>{product.categoryName}</dd>
                {section ? (
                  <>
                    <dt className="font-medium text-[var(--text-primary)]">Department groups</dt>
                    <dd>{section.groups.map((group) => group.name).join(", ")}</dd>
                  </>
                ) : null}
                <dt className="font-medium text-[var(--text-primary)]">SKU</dt>
                <dd>{product.id.toUpperCase()}</dd>
                {product.variants ? (
                  <>
                    <dt className="font-medium text-[var(--text-primary)]">
                      {product.variantLabel ?? "Options"}
                    </dt>
                    <dd>{product.variants.join(", ")}</dd>
                  </>
                ) : null}
                {product.colors ? (
                  <>
                    <dt className="font-medium text-[var(--text-primary)]">Colors</dt>
                    <dd>{product.colors.map((option) => option.name).join(", ")}</dd>
                  </>
                ) : null}
              </dl>
              <p className="mt-3 text-xs text-[var(--text-muted)]">
                Full technical specifications arrive with the live catalogue.
              </p>
            </AccordionSection>
            <AccordionSection title="Delivery">
              <p>
                Delivery options and timelines are published in the{" "}
                <Link
                  href={policyHref("Delivery Information")}
                  className="font-medium text-[var(--color-action-red)] hover:underline"
                >
                  delivery information
                </Link>{" "}
                and{" "}
                <Link
                  href={policyHref("Shipping Policy")}
                  className="font-medium text-[var(--color-action-red)] hover:underline"
                >
                  shipping policy
                </Link>
                .
              </p>
            </AccordionSection>
            <AccordionSection title="Warranty">
              <p>
                Coverage is described in the{" "}
                <Link
                  href={policyHref("Warranty Policy")}
                  className="font-medium text-[var(--color-action-red)] hover:underline"
                >
                  warranty policy
                </Link>
                , and you can{" "}
                <Link
                  href={CHECK_WARRANTY_LINK.href}
                  className="font-medium text-[var(--color-action-red)] hover:underline"
                >
                  check an existing warranty
                </Link>
                .
              </p>
            </AccordionSection>
          </div>
        </div>
      </div>

      {/* Reviews: no fabricated ratings — an honest empty state until the
          live catalog brings verified reviews */}
      <section aria-label="Customer reviews" className="mt-10 border-t border-[var(--color-light-grey)] pt-2 md:mt-14">
        <EmptyState
          title="No reviews yet"
          description="Verified customer reviews appear here once the live catalog launches."
        />
      </section>

      {related.length > 0 ? (
        <ProductSection
          title="Related products"
          seeAllHref={`/categories/${product.categorySlug}`}
          products={related}
        />
      ) : null}

      <RecentlyViewed currentId={product.id} />
    </Container>
  );
}
