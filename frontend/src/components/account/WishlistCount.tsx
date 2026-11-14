"use client";

import { useHydrated, useWishlist } from "@/features/cart/hooks";

/**
 * How many products are saved in this browser's wishlist (the storefront's
 * one wishlist store). A dash until the browser has read it, so the server
 * HTML never shows a wrong number.
 */
export function WishlistCount() {
  const hydrated = useHydrated();
  const { ids } = useWishlist();
  return <>{hydrated ? ids.length : "–"}</>;
}
