import Image from "next/image";
import Link from "next/link";
import { CartIcon, Tilt3D } from "@tronic/ui";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import { AddToCartButton } from "./AddToCartButton";
import { discountPercent, formatPrice, type SampleProduct } from "./sampleProducts";

/**
 * Shared product card for the homepage merchandising sections, kept compact
 * so wide viewports fit 5-6 per row: white card with glow-and-lift hover,
 * SAMPLE chip, wishlist heart, discount badge with inline was/now pricing,
 * stock status line and an Add to Cart CTA (quick variant selection when
 * the product has options; disabled while out of stock) wired to this
 * browser's cart and wishlist (features/cart). The photo carries a 3D hover tilt (interim
 * for real 360° photography, owner request).
 */
export function ProductCard({
  product,
  showSku = false,
  className = "",
}: {
  product: SampleProduct;
  /** Show the SKU under the name (Featured Products). */
  showSku?: boolean;
  /** Extra classes on the card, e.g. a fixed width inside a carousel. */
  className?: string;
}) {
  const saving = discountPercent(product);
  return (
    <li className={`group/card flex flex-col rounded-2xl bg-white p-2 shadow-[0_1px_2px_rgba(17,17,17,0.04),0_4px_14px_-6px_rgba(17,17,17,0.08)] transition-[transform,box-shadow] duration-300 ease-out hover:z-10 hover:-translate-y-1 hover:shadow-[0_2px_4px_rgba(17,17,17,0.04),0_18px_36px_-14px_rgba(17,17,17,0.28)] md:p-2.5 ${className}`}>
      {/* Product "stage" (design pass 2026-11-12): a soft grey surface; the
          photos' white studio backgrounds blend into it (multiply), so mixed
          photography reads as one set. 5:4 keeps the card compact. */}
      <div className="relative aspect-[5/4] overflow-hidden rounded-xl bg-[#f4f4f5]">
        <Tilt3D className="absolute inset-0">
          <Link
            href={`/products/${product.slug}`}
            tabIndex={-1}
            aria-hidden="true"
            className="relative block h-full w-full bg-[#f4f4f5]"
          >
            <Image
              src={product.image}
              alt={product.name}
              fill
              sizes="(min-width: 1280px) 10rem, (min-width: 768px) 11rem, 45vw"
              className="object-contain p-3 mix-blend-multiply transition-transform duration-500 ease-out group-hover/card:scale-[1.06] md:p-4"
            />
          </Link>
        </Tilt3D>
        {/* Discount chip: 9px, rounded, 1.5 inset. The SAMPLE chip was
            removed 2026-11-12 (owner request). */}
        {saving !== null ? (
          <span className="absolute left-2 top-2 rounded-full bg-[var(--color-action-red)] px-2 py-0.5 text-[10px] font-bold text-white">
            Save {saving}%
          </span>
        ) : null}
        <WishlistButton
          productId={product.id}
          productName={product.name}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-[0_2px_8px_rgba(17,17,17,0.12)] transition-all hover:scale-110 active:scale-90"
        />
      </div>
      <div className="flex flex-1 flex-col px-1 pb-0.5 pt-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
          {product.categoryName}
        </p>
        <Link
          href={`/products/${product.slug}`}
          className="mt-1 line-clamp-2 min-h-[2.6em] text-[13px] font-semibold leading-snug text-[var(--text-primary)] transition-colors hover:text-[var(--color-action-red)] md:text-sm"
        >
          {product.name}
        </Link>
        {showSku ? (
          <p className="mt-0.5 truncate text-[10px] tracking-wide text-[var(--text-muted)]">SKU {product.sku}</p>
        ) : null}
        <div className="mt-auto pt-1.5">
          <p className="flex flex-wrap items-baseline gap-x-1.5">
            <span
              className={`text-sm font-bold tabular-nums md:text-[15px] ${
                product.wasPriceMinor !== undefined
                  ? "text-[var(--color-action-red)]"
                  : "text-[var(--color-premium-black)]"
              }`}
            >
              {formatPrice(product.priceMinor)}
            </span>
            {product.wasPriceMinor !== undefined ? (
              <span className="text-[11px] text-[var(--text-muted)] line-through">
                {formatPrice(product.wasPriceMinor)}
              </span>
            ) : null}
          </p>
          <p
            className={`mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium ${
              product.inStock ? "text-[var(--color-success)]" : "text-[var(--text-muted)]"
            }`}
          >
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
            {product.inStock ? "In stock" : "Out of stock"}
          </p>
          {product.inStock ? (
            <AddToCartButton product={product} />
          ) : (
            <span
              aria-disabled="true"
              className="mt-2 flex h-[34px] w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-full bg-[#f4f4f5] text-[11px] font-semibold text-[var(--text-muted)]"
            >
              <CartIcon size={13} />
              Out of stock
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
