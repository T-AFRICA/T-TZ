"use client";

import { useCartCount, useHydrated, useWishlist } from "@/features/cart/hooks";

/**
 * Item counts on the header and bottom tab bar icons (owner request
 * 2026-11-10). The red bubble is visual only; screen readers get
 * ", 3 items" in the link name from the matching *CountText, placed after
 * the link's label. Nothing renders while the count is zero or before
 * hydration (the server cannot see this browser's cart).
 */
function useVisibleCount(count: number): number {
  return useHydrated() ? count : 0;
}

function Bubble({ count, className = "" }: { count: number; className?: string }) {
  if (count === 0) return null;
  return (
    <span
      aria-hidden="true"
      className={`absolute grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full bg-[var(--color-action-red)] px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white ${className}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function Text({ count }: { count: number }) {
  if (count === 0) return null;
  return <span className="sr-only">{`, ${count} ${count === 1 ? "item" : "items"}`}</span>;
}

export function CartCountBadge({ className }: { className?: string }) {
  return <Bubble count={useVisibleCount(useCartCount())} className={className} />;
}

export function CartCountText() {
  return <Text count={useVisibleCount(useCartCount())} />;
}

export function WishlistCountBadge({ className }: { className?: string }) {
  return <Bubble count={useVisibleCount(useWishlist().ids.length)} className={className} />;
}

export function WishlistCountText() {
  return <Text count={useVisibleCount(useWishlist().ids.length)} />;
}
