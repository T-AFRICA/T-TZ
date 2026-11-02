import Link from "next/link";
import { ArrowRightIcon, CartIcon, HeartIcon } from "@tronic/ui";
import { CART_LINK, WISHLIST_LINK } from "@/config/site";
import { CategoryArt } from "./CategoryArt";

/**
 * "Special for you" mobile merchandising section (approved mobile UI
 * reference, Nov 2026).
 *
 * SAMPLE DATA ONLY: the catalogue, real prices, ratings and discounts arrive
 * with Module 02 / the product API. Every card is visibly tagged SAMPLE, the
 * prices are synthetic TZS figures (not quotes), and no ratings or discounts
 * are fabricated. Cart/wishlist targets are the W03-04 placeholder routes.
 */
interface SampleProduct {
  id: string;
  name: string;
  categorySlug: string;
  categoryName: string;
  /** Synthetic display price — clearly sample data, not a real offer. */
  samplePrice: string;
}

const SAMPLE_PRODUCTS: readonly SampleProduct[] = [
  {
    id: "sample-led-panel",
    name: "LED Panel Light",
    categorySlug: "lighting",
    categoryName: "Lighting",
    samplePrice: "TZS 28,000",
  },
  {
    id: "sample-smart-plug",
    name: "Smart Plug Socket",
    categorySlug: "switches-sockets",
    categoryName: "Switches & Sockets",
    samplePrice: "TZS 18,500",
  },
  {
    id: "sample-extension",
    name: "Extension Socket",
    categorySlug: "switches-sockets",
    categoryName: "Switches & Sockets",
    samplePrice: "TZS 22,000",
  },
  {
    id: "sample-cable-roll",
    name: "Power Cable Roll",
    categorySlug: "cables-wiring",
    categoryName: "Cables & Wiring",
    samplePrice: "TZS 35,000",
  },
];

export function FeaturedSamples() {
  return (
    <section className="mt-10 md:hidden" aria-label="Featured sample products">
      <div className="flex items-baseline justify-between gap-3">
        <h2
          className="text-lg font-bold leading-tight"
          style={{ fontFamily: "var(--font-heading, var(--font-fallback-heading))" }}
        >
          Special for you
        </h2>
        <Link
          href="/categories/lighting"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--color-action-red)]"
        >
          See all
          <ArrowRightIcon size={13} />
        </Link>
      </div>
      <p className="mt-1 text-[11px] text-[var(--text-muted)]">
        Sample items for layout preview — the real catalogue and prices arrive with the product
        module.
      </p>
      <ul className="mt-4 grid grid-cols-2 gap-4">
        {SAMPLE_PRODUCTS.map((product) => (
          <li
            key={product.id}
            className="flex flex-col rounded-2xl bg-white p-2.5 shadow-[0_3px_14px_rgba(17,17,17,0.06)]"
          >
            <div className="relative grid aspect-square place-items-center rounded-xl bg-[var(--surface-card)] text-[var(--color-dark-grey)]">
              <CategoryArt slug={product.categorySlug} size={52} />
              <span className="absolute left-2 top-2 rounded-full bg-[var(--color-premium-black)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">
                Sample
              </span>
              <Link
                href={WISHLIST_LINK.href}
                aria-label={`Save ${product.name} to wishlist`}
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-[var(--text-secondary)] shadow-sm transition-colors hover:text-[var(--color-action-red)]"
              >
                <HeartIcon size={16} />
              </Link>
            </div>
            <div className="flex flex-1 flex-col px-1.5 pb-1.5 pt-3">
              <Link
                href={`/categories/${product.categorySlug}`}
                className="text-[13px] font-semibold leading-snug hover:text-[var(--color-action-red)]"
              >
                {product.name}
              </Link>
              <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{product.categoryName}</p>
              <p className="mt-1.5 text-sm font-bold text-[var(--color-premium-black)]">
                {product.samplePrice}
              </p>
              <Link
                href={CART_LINK.href}
                className="mt-2.5 inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--color-action-red)] px-3 py-2 text-[11px] font-semibold text-white transition-colors hover:bg-[var(--color-action-red-dark)]"
              >
                <CartIcon size={14} />
                Add to Cart
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
