import Link from "next/link";
import { ArrowRightIcon } from "@tronic/ui";
import { Reveal } from "@/components/motion/Reveal";
import { ProductCard } from "./ProductCard";
import type { SampleProduct } from "./sampleProducts";

interface ProductSectionProps {
  title: string;
  seeAllHref: string;
  products: readonly SampleProduct[];
  /** Extra classes on the section, e.g. to hide a rail below md. */
  className?: string;
}

/**
 * Homepage merchandising section: heading, "See all" link into the category,
 * and a responsive grid of SAMPLE-tagged product cards (2-up on mobile,
 * stepping up to 6-up on wide desktops for a compact, premium density).
 */
export function ProductSection({ title, seeAllHref, products, className }: ProductSectionProps) {
  return (
    <section className={`mt-7 md:mt-14 ${className ?? ""}`.trim()} aria-label={`${title} — sample products`}>
      <Reveal>
      <div className="flex items-baseline justify-between gap-3">
        <h2
          className="text-lg font-bold leading-tight md:text-[length:var(--text-h2)] md:tracking-[-0.01em]"
          style={{ fontFamily: "var(--font-heading, var(--font-fallback-heading))" }}
        >
          {title}
        </h2>
        <Link
          href={seeAllHref}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--color-action-red)]"
        >
          See all
          <ArrowRightIcon size={13} />
        </Link>
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:mt-5 md:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </ul>
      </Reveal>
    </section>
  );
}
