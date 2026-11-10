"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@tronic/ui";
import { buyNowHref } from "@/features/checkout/links";
import { useCart } from "./hooks";
import { MAX_LINE_QUANTITY } from "./store";

/**
 * The storefront's one purchase entry point, shared by the product page
 * (PurchasePanel), the search quick view and the product cards, so all of
 * them behave the same.
 *
 * - Add to Cart puts the product and its chosen options in this browser's
 *   cart (./store.ts) and confirms with a toast.
 * - Buy Now opens checkout with just this product and its options; it
 *   does not touch the cart (owner brief 2026-11-10).
 *
 * Payments and orders are not connected yet (Module 02 / Phase 5):
 * checkout says so, and no order is ever created or simulated.
 */
export const MAX_PURCHASE_QUANTITY = MAX_LINE_QUANTITY;

export interface PurchaseLine {
  productId: string;
  name: string;
  quantity: number;
  color: string | null;
  variant: string | null;
}

/** Options joined for display, in a fixed order: colour, then variant. */
export function selectionLabel(color: string | null, variant: string | null): string {
  return [color, variant].filter(Boolean).join(" · ");
}

export function usePurchaseActions() {
  const router = useRouter();
  const { showToast } = useToast();
  const { add } = useCart();

  const addToCart = useCallback(
    ({ productId, name, quantity, color, variant }: PurchaseLine) => {
      add({ productId, color, variant, quantity });
      const selection = selectionLabel(color, variant);
      showToast(`Added ${quantity} × ${name}${selection ? ` (${selection})` : ""} to your cart`, "success");
    },
    [add, showToast],
  );

  const buyNow = useCallback(
    ({ productId, quantity, color, variant }: PurchaseLine) => {
      router.push(buyNowHref({ productId, color, variant, quantity }));
    },
    [router],
  );

  return useMemo(() => ({ addToCart, buyNow }), [addToCart, buyNow]);
}
