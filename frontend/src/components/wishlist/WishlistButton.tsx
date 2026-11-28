"use client";

import { useRef } from "react";
import { HeartIcon, playMotion, useToast } from "@tronic/ui";
import { useHydrated, useWishlist } from "@/features/cart/hooks";

/**
 * Heart toggle on product cards and the product gallery: saves the product
 * to this browser's wishlist or removes it (owner request 2026-11-10).
 * aria-pressed carries the state; the heart fills red when saved, with a
 * pop, and the touch area is 44px even where the button is drawn smaller
 * (the caller positions the button). Before
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
  const heart = useRef<HTMLSpanElement>(null);

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
        // Saving pops; removing only dips, so the two do not feel the same.
        playMotion(heart.current, now ? "pop" : "release");
        showToast(now ? `Saved ${productName} to your wishlist` : `Removed ${productName} from your wishlist`, "info");
      }}
      className={`m-press m-press-icon m-hit ${className} ${
        saved
          ? "text-[var(--color-action-red)]"
          : "text-[var(--text-secondary)] hover:text-[var(--color-action-red)]"
      }`}
    >
      <span ref={heart} className="flex">
        <HeartIcon size={size} className={saved ? "fill-current" : undefined} />
      </span>
    </button>
  );
}
