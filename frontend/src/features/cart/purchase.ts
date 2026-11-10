"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@tronic/ui";
import { CART_LINK } from "@/config/site";

/**
 * The storefront's one purchase entry point, shared by the product page
 * (PurchasePanel) and the search quick view so both behave identically.
 *
 * There is no cart or checkout service yet (Module 02 / Phase 5, see
 * README.md here). Until then:
 * - Add to Cart confirms with a toast that says it is sample mode; nothing
 *   is stored and there is no cart badge to update.
 * - Buy Now goes to the existing /cart placeholder route. No order is
 *   created and no payment is simulated.
 * When the cart lands, only this hook changes; both callers keep working.
 */
export const MAX_PURCHASE_QUANTITY = 10;

export interface PurchaseLine {
  name: string;
  quantity: number;
  /** Chosen options, e.g. "White · 4-way"; empty when the product has none. */
  selection: string;
}

/** Options joined for display, in a fixed order: colour, then variant. */
export function selectionLabel(color: string | null, variant: string | null): string {
  return [color, variant].filter(Boolean).join(" · ");
}

export function usePurchaseActions() {
  const router = useRouter();
  const { showToast } = useToast();

  const addToCart = useCallback(
    ({ name, quantity, selection }: PurchaseLine) => {
      showToast(
        `Added ${quantity} × ${name}${selection ? ` (${selection})` : ""} — sample mode, cart launches with the live catalog`,
        "success",
      );
    },
    [showToast],
  );

  const buyNow = useCallback(() => {
    router.push(CART_LINK.href);
  }, [router]);

  return useMemo(() => ({ addToCart, buyNow }), [addToCart, buyNow]);
}
