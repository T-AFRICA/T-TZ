import Image from "next/image";
import Link from "next/link";
import { CartIcon, HeartIcon, Tilt3D } from "@tronic/ui";
import { WISHLIST_LINK } from "@/config/site";
import { AddToCartButton } from "./AddToCartButton";
import { discountPercent, formatSamplePrice, type SampleProduct } from "./sampleProducts";

/**
 * Shared product card for the homepage merchandising sections, kept compact
 * so wide viewports fit 5-6 per row: white card with glow-and-lift hover,
 * SAMPLE chip, wishlist heart, discount badge with inline was/now pricing,
 * stock status line and an Add to Cart CTA (quick variant selection when
 * the product has options; disabled while out of stock) pointing at the
 * W03-04 placeholder routes. The photo carries a 3D hover tilt (interim
 * for real 360° photography, owner request).
 */
export function ProductCard({ product }: { product: SampleProduct }) {
  const saving = discountPercent(product);
  return (
    <li className="group/card flex flex-col rounded-xl bg-white p-2 shadow-[0_2px_10px_rgba(17,17,17,0.05)] transition-all duration-300 ease-out hover:z-10 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_0_0_1px_rgba(215,25,32,0.25),0_6px_16px_-6px_rgba(215,25,32,0.25),0_18px_38px_-12px_rgba(215,25,32,0.4)] active:translate-y-0 active:scale-[1.01] md:border md:border-[var(--color-light-grey)] md:p-2.5 md:shadow-none md:hover:border-transparent">
      <div className="relative aspect-square overflow-hidden rounded-lg bg-white">
        <Tilt3D className="absolute inset-0">
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(min-width: 1280px) 10rem, (min-width: 768px) 11rem, 45vw"
            className="object-contain p-2.5 transition-transform duration-300 group-hover/card:scale-105"
          />
        </Tilt3D>
        <span className="absolute left-1.5 top-1.5 rounded bg-[var(--color-premium-black)]/85 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-white">
          Sample
        </span>
        {saving !== null ? (
          <span className="absolute bottom-1.5 left-1.5 rounded bg-[var(--color-action-red)] px-1.5 py-0.5 text-[9px] font-semibold text-white">
            Save {saving}%
          </span>
        ) : null}
        <Link
          href={WISHLIST_LINK.href}
          aria-label={`Save ${product.name} to wishlist`}
          className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white text-[var(--text-secondary)] shadow-sm transition-all hover:scale-110 hover:text-[var(--color-action-red)] active:scale-90"
        >
          <HeartIcon size={14} />
        </Link>
      </div>
      <div className="flex flex-1 flex-col px-1 pb-0.5 pt-1.5">
        <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
          {product.categoryName}
        </p>
        <Link
          href={`/categories/${product.categorySlug}`}
          className="mt-0.5 line-clamp-2 min-h-[2.5em] text-xs font-semibold leading-snug transition-colors hover:text-[var(--color-action-red)] md:text-[13px]"
        >
          {product.name}
        </Link>
        <div className="mt-auto pt-1.5">
          <p className="flex flex-wrap items-baseline gap-x-1.5">
            <span
              className={`text-[13px] font-bold md:text-sm ${
                product.wasPrice !== undefined
                  ? "text-[var(--color-action-red)]"
                  : "text-[var(--color-premium-black)]"
              }`}
            >
              {formatSamplePrice(product.price)}
            </span>
            {product.wasPrice !== undefined ? (
              <span className="text-[11px] text-[var(--text-muted)] line-through">
                {formatSamplePrice(product.wasPrice)}
              </span>
            ) : null}
          </p>
          <p
            className={`mt-0.5 text-[10px] font-medium md:text-[11px] ${
              product.inStock ? "text-[var(--color-success)]" : "text-[var(--text-muted)]"
            }`}
          >
            {product.inStock ? "In stock" : "Out of stock"}
          </p>
          {product.inStock ? (
            <AddToCartButton productName={product.name} variants={product.variants} />
          ) : (
            <span
              aria-disabled="true"
              className="mt-1.5 flex h-9 w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-full bg-[var(--color-light-grey)] text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)] md:h-8 md:text-[11px]"
            >
              <CartIcon size={13} />
              Out of Stock
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
