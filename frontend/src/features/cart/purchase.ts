"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { flyBetween, playMotion, useToast } from "@tronic/ui";
import { startNavigationProgress } from "@/components/nav/NavigationProgress";
import { buyNowHref } from "@/features/checkout/links";
import { useCart } from "./hooks";
import { MAX_LINE_QUANTITY } from "./store";

/**
 * The storefront's one purchase entry point, shared by the product page
 * (PurchasePanel), the search quick view and the product cards, so all of
 * them behave the same.
 *
 * - Add to Cart puts the product and its chosen options in this browser's
 *   cart (./store.ts) and confirms with a toast. Where the caller says
 *   which control was pressed, a dot also travels from it to the cart icon
 *   (decoration only: the cart has already changed, and nothing waits).
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

/** How long an Add to Cart button says "Added" after it worked. */
export const ADDED_FEEDBACK_MS = 1600;

/**
 * "Added" on the button that was pressed, for a moment: [added, flash].
 * Call flash() after the cart has taken the product. The cart store is in
 * this browser and cannot refuse, so this never shows before it is true.
 */
export function useAddedFeedback(): readonly [boolean, () => void] {
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const flash = useCallback(() => {
    setAdded(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), ADDED_FEEDBACK_MS);
  }, []);
  return [added, flash] as const;
}

/** Where an Add to Cart was pressed, for the feedback that follows it. */
export interface PurchaseOrigin {
  /** The control that was pressed. */
  from?: Element | null;
  /** The product's photo, shown on the dot that travels to the cart. */
  image?: string | null;
}

/** The cart icon the customer can see now: the header's on desktop, the bottom bar's on phones. */
function visibleCartTarget(): Element | null {
  if (typeof document === "undefined") return null;
  for (const target of document.querySelectorAll("[data-cart-target]")) {
    const box = target.getBoundingClientRect();
    if (box.width > 0 && box.height > 0) return target;
  }
  return null;
}

export function usePurchaseActions() {
  const router = useRouter();
  const { showToast } = useToast();
  const { add } = useCart();

  const addToCart = useCallback(
    ({ productId, name, quantity, color, variant }: PurchaseLine, origin: PurchaseOrigin = {}) => {
      // The cart changes first; what follows only shows that it did.
      add({ productId, color, variant, quantity });
      const target = visibleCartTarget();
      flyBetween(origin.from, target, { image: origin.image, onArrive: () => playMotion(target, "bump") });
      const selection = selectionLabel(color, variant);
      showToast(`Added ${quantity} × ${name}${selection ? ` (${selection})` : ""} to your cart`, "success");
    },
    [add, showToast],
  );

  const buyNow = useCallback(
    ({ productId, quantity, color, variant }: PurchaseLine) => {
      startNavigationProgress();
      router.push(buyNowHref({ productId, color, variant, quantity }));
    },
    [router],
  );

  return useMemo(() => ({ addToCart, buyNow }), [addToCart, buyNow]);
}
