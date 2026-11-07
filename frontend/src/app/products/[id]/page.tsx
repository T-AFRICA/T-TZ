import Link from "next/link";
import { notFound } from "next/navigation";
import { AccordionSection, Container, EmptyState } from "@tronic/ui";
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

function PolicyLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-medium text-[var(--color-action-red)] hover:underline">
      {children}
    </Link>
  );
}

/** One label-and-value row in the specifications list. */
function SpecRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-3 border-b border-[var(--color-light-grey)] py-2.5 last:border-b-0 md:grid-cols-[8rem_1fr]">
      <dt className="text-[var(--text-muted)]">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-[var(--text-primary)]">{children}</dd>
    </div>
  );
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

  return (
    <Container className="pt-3 pb-8 sm:pt-4 md:py-10 md:pb-16">
      <div className="grid gap-3 md:grid-cols-2 md:gap-10 lg:gap-16">
        <ProductGallery product={product} />

        {/* On phones: one white, edge-to-edge panel with thin dividers, no nested cards */}
        <div className="min-w-0 max-md:-mx-[var(--gutter)] max-md:bg-white max-md:px-[var(--gutter)] max-md:pt-3.5">
          {/* Breadcrumb lives in the info column (approved reference) */}
          <nav aria-label="Breadcrumb" className="text-[11px] text-[var(--text-muted)] md:text-xs">
            <ol className="flex items-center gap-1 md:flex-wrap">
              <li className="shrink-0">
                <Link href="/" className="hover:text-[var(--color-action-red)]">
                  Home
                </Link>
              </li>
              <li aria-hidden="true" className="text-[var(--color-light-grey)]">
                /
              </li>
              <li className="shrink-0">
                <Link
                  href={`/categories/${product.categorySlug}`}
                  className="hover:text-[var(--color-action-red)]"
                >
                  {product.categoryName}
                </Link>
              </li>
              <li aria-hidden="true" className="text-[var(--color-light-grey)]">
                /
              </li>
              <li aria-current="page" className="min-w-0 truncate text-[var(--text-secondary)]">
                {product.name}
              </li>
            </ol>
          </nav>

          <p className="mt-3.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)] md:mt-4 md:text-[11px]">
            TRONIC · {product.categoryName}
          </p>
          <h1
            className="mt-1.5 text-[1.5rem] font-bold leading-[1.15] tracking-[-0.015em] md:text-[length:var(--text-h2)] md:tracking-[-0.01em]"
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

          {/* Only verified facts: no technical figures or warranty terms are stated
              until the live catalogue supplies them. */}
          <div className="mt-5 border-t border-[var(--color-light-grey)] md:mt-6">
            <AccordionSection title="Product Overview" defaultOpen>
              <p>
                {product.name} from the TRONIC {product.categoryName.toLowerCase()} range. The
                full description is added with the live catalogue.
              </p>
            </AccordionSection>
            <AccordionSection title="Technical Specifications">
              <dl>
                <SpecRow label="Category">{product.categoryName}</SpecRow>
                <SpecRow label="SKU">{product.id.toUpperCase()}</SpecRow>
                {product.variants ? (
                  <SpecRow label={product.variantLabel ?? "Options"}>
                    {product.variants.join(", ")}
                  </SpecRow>
                ) : null}
                {product.colors ? (
                  <SpecRow label="Colors">
                    {product.colors.map((option) => option.name).join(", ")}
                  </SpecRow>
                ) : null}
              </dl>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Full technical specifications are added with the live catalogue.
              </p>
            </AccordionSection>
            <AccordionSection title="Delivery & Returns">
              <p>
                See the{" "}
                <PolicyLink href={policyHref("Delivery Information")}>
                  delivery information
                </PolicyLink>
                , <PolicyLink href={policyHref("Shipping Policy")}>shipping policy</PolicyLink> and{" "}
                <PolicyLink href={policyHref("Return Policy")}>return policy</PolicyLink>.
              </p>
            </AccordionSection>
            <AccordionSection title="Warranty Information">
              <p>
                See the <PolicyLink href={policyHref("Warranty Policy")}>warranty policy</PolicyLink>
                , or <PolicyLink href={CHECK_WARRANTY_LINK.href}>check an existing warranty</PolicyLink>
                .
              </p>
            </AccordionSection>
          </div>
        </div>
      </div>

      {/* Reviews: no fabricated ratings — an honest empty state until the
          live catalog brings verified reviews */}
      <section aria-label="Customer reviews" className="mt-4 border-t border-[var(--color-light-grey)] md:mt-14 md:pt-2">
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
