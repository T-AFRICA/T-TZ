import Image from "next/image";
import Link from "next/link";
import { CartIcon, Tilt3D } from "@tronic/ui";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import { AddToCartButton } from "./AddToCartButton";
import { discountPercent, formatSamplePrice, type SampleProduct } from "./sampleProducts";

/**
 * Shared product card for the homepage merchandising sections, kept compact
 * so wide viewports fit 5-6 per row: white card with glow-and-lift hover,
 * SAMPLE chip, wishlist heart, discount badge with inline was/now pricing,
 * stock status line and an Add to Cart CTA (quick variant selection when
 * the product has options; disabled while out of stock) wired to this
 * browser's cart and wishlist (features/cart). The photo carries a 3D hover tilt (interim
 * for real 360° photography, owner request).
 */
export function ProductCard({ product }: { product: SampleProduct }) {
  const saving = discountPercent(product);
  return (
    <li className="group/card flex flex-col rounded-xl bg-white p-2 shadow-[0_2px_10px_rgba(17,17,17,0.05)] transition-all duration-300 ease-out hover:z-10 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_0_0_1px_rgba(215,25,32,0.25),0_6px_16px_-6px_rgba(215,25,32,0.25),0_18px_38px_-12px_rgba(215,25,32,0.4)] active:translate-y-0 active:scale-[1.01] md:border md:border-[var(--color-light-grey)] md:p-2.5 md:shadow-none md:hover:border-transparent">
      {/* 4:3 photo area (was square) keeps the card shorter on phones and in
          the 5-6 per row desktop grid; object-contain still shows the whole
          product. */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-white">
        <Tilt3D className="absolute inset-0">
          <Link
            href={`/products/${product.slug}`}
            tabIndex={-1}
            aria-hidden="true"
            className="relative block h-full w-full"
          >
            <Image
              src={product.image}
              alt={product.name}
              fill
              sizes="(min-width: 1280px) 10rem, (min-width: 768px) 11rem, 45vw"
              className="object-contain p-2.5 transition-transform duration-300 group-hover/card:scale-105"
            />
          </Link>
        </Tilt3D>
        {/* Badge pair shares one size/radius/padding system (9px, rounded,
            1.5 inset) so chips read as a family across every card */}
        <span className="absolute left-1.5 top-1.5 rounded bg-[var(--color-premium-black)]/85 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">
          Sample
        </span>
        {saving !== null ? (
          <span className="absolute bottom-1.5 left-1.5 rounded bg-[var(--color-action-red)] px-1.5 py-0.5 text-[9px] font-semibold text-white">
            Save {saving}%
          </span>
        ) : null}
        <WishlistButton
          productId={product.id}
          productName={product.name}
          className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-sm transition-all hover:scale-110 active:scale-90"
        />
      </div>
      <div className="flex flex-1 flex-col px-1 pb-0.5 pt-1">
        <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
          {product.categoryName}
        </p>
        <Link
          href={`/products/${product.slug}`}
          className="mt-0.5 line-clamp-2 min-h-[2.5em] text-xs font-semibold leading-snug transition-colors hover:text-[var(--color-action-red)] md:text-[13px]"
        >
          {product.name}
        </Link>
        <div className="mt-auto pt-1">
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
            <AddToCartButton product={product} />
          ) : (
            <span
              aria-disabled="true"
              className="mt-1.5 flex h-8 w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-full bg-[var(--color-light-grey)] text-[9px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] md:text-[10px]"
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
