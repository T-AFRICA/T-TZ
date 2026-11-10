"use client";

import { HeartIcon, useToast } from "@tronic/ui";
import { useHydrated, useWishlist } from "@/features/cart/hooks";

/**
 * Heart toggle on product cards and the product gallery: saves the product
 * to this browser's wishlist or removes it (owner request 2026-11-10).
 * aria-pressed carries the state; the heart fills red when saved. Before
 * hydration it renders unsaved, since the server cannot see this browser.
 */
export function WishlistButton({
  productId,
  productName,
  size = 14,
  className = "",
}: {
  productId: string;
  productName: string;
  size?: number;
  className?: string;
}) {
  const { ids, toggle } = useWishlist();
  const { showToast } = useToast();
  const hydrated = useHydrated();
  const saved = hydrated && ids.includes(productId);

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? `Remove ${productName} from wishlist` : `Save ${productName} to wishlist`}
      onClick={(event) => {
        // Cards wrap links; the heart never opens the product.
        event.preventDefault();
        event.stopPropagation();
        const now = toggle(productId);
        showToast(now ? `Saved ${productName} to your wishlist` : `Removed ${productName} from your wishlist`, "info");
      }}
      className={`${className} ${
        saved
          ? "text-[var(--color-action-red)]"
          : "text-[var(--text-secondary)] hover:text-[var(--color-action-red)]"
      }`}
    >
      <HeartIcon size={size} className={saved ? "fill-current" : undefined} />
    </button>
  );
}
