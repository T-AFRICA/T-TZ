"use client";

import Link from "next/link";
import { ArrowRightIcon, Container, HeartIcon } from "@tronic/ui";
import { ProductCard } from "@/components/home/ProductCard";
import { useHydrated, useWishlist } from "@/features/cart/hooks";
import { resolveWishlist } from "@/features/cart/lines";

/**
 * The wishlist page body (owner request 2026-11-10): products saved with
 * the heart on this device, shown as the usual product cards, so a product
 * can be added to the cart or un-saved right here. Products no longer
 * listed in this country are skipped.
 *
 * `embedded` is for the customer portal (/account/wishlist): the portal
 * already provides the page width and padding, and its content column is
 * narrower, so the grid uses fewer columns there.
 */
export function WishlistView({ embedded = false }: { embedded?: boolean }) {
  const Frame = embedded ? "div" : Container;
  const hydrated = useHydrated();
  const { ids } = useWishlist();

  if (!hydrated) {
    return (
      <Frame className={embedded ? "" : "py-6 lg:py-8"}>
        <div aria-busy="true" aria-label="Loading your wishlist" className="h-48 animate-pulse rounded-2xl bg-white" />
      </Frame>
    );
  }

  const products = resolveWishlist(ids);

  if (products.length === 0) {
    return (
      <Frame className={`flex flex-col items-center text-center ${embedded ? "rounded-2xl bg-white px-4 py-12" : "py-14 lg:py-20"}`}>
        <span
          aria-hidden="true"
          className="grid h-16 w-16 place-items-center rounded-full bg-white text-[var(--color-action-red)] shadow-[0_3px_14px_rgba(17,17,17,0.08)]"
        >
          <HeartIcon size={28} />
        </span>
        <h2 className="mt-5 text-lg font-bold">Your wishlist is empty</h2>
        <p className="mt-1.5 max-w-sm text-sm text-[var(--text-secondary)]">
          Tap the heart on any product to save it here for later.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-[var(--color-action-red)] px-6 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-action-red-dark)]"
        >
          Browse products
          <ArrowRightIcon size={16} />
        </Link>
      </Frame>
    );
  }

  return (
    <Frame className={embedded ? "" : "py-6 lg:py-8"}>
      <p className="text-sm text-[var(--text-secondary)]">
        {products.length} saved {products.length === 1 ? "product" : "products"} · saved on this device
      </p>
      <ul
        className={`mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:mt-4 md:gap-4 ${
          embedded ? "md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4" : "md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
        }`}
      >
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </ul>
    </Frame>
  );
}
