"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CartIcon, Dialog } from "@tronic/ui";
import { CART_LINK } from "@/config/site";

/**
 * Two compact CTAs in one row: Buy Now (outline, fixed width) and Add to
 * Cart (filled, takes the rest). 32px tall so the pair costs the card no
 * more height than the old single button; the whole row is still a clean
 * tap target per button. Press feedback is CSS (active:scale) so SSR markup
 * never depends on the reduced-motion preference — the global CSS override
 * disables it there.
 */
const ROW_CLASSES = "mt-1.5 flex gap-1.5";
const BASE_CLASSES =
  "flex h-8 items-center justify-center gap-1 rounded-full text-[9px] font-semibold uppercase tracking-[0.04em] transition-all duration-200 active:scale-[0.97] md:text-[10px]";
const BUY_CLASSES = `${BASE_CLASSES} shrink-0 border-[1.5px] border-[var(--color-action-red)] px-2 text-[var(--color-action-red)] hover:bg-[#fdecec] max-[359px]:px-1.5 md:px-3`;
const ADD_CLASSES = `${BASE_CLASSES} min-w-0 flex-1 bg-[var(--color-action-red)] px-1.5 text-white shadow-[0_5px_12px_-6px_rgba(215,25,32,0.55)] hover:-translate-y-0.5 hover:bg-[var(--color-action-red-dark)] sm:px-2`;

export interface AddToCartButtonProps {
  productName: string;
  /** Synthetic variant options; when present a quick-selection dialog opens first. */
  variants?: readonly string[];
}

/** The filled label; in the two-up phone grid only "Add" fits beside the icon. */
function AddLabel() {
  return (
    <>
      <CartIcon size={12} />
      <span className="truncate">
        Add<span className="max-sm:hidden"> to Cart</span>
      </span>
    </>
  );
}

/**
 * Homepage card CTAs. Buy Now and, without variants, Add to Cart link
 * straight to the cart placeholder route (the real cart lands with Module
 * 02); with variants, Add to Cart opens a quick-selection dialog so a choice
 * is made before anything would be added.
 */
export function AddToCartButton({ productName, variants }: AddToCartButtonProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  // Accessible names start with the visible text so voice-control users can
  // activate each button by its label.
  const buyNow = (
    <Link href={CART_LINK.href} aria-label={`Buy now: ${productName}`} className={BUY_CLASSES}>
      Buy Now
    </Link>
  );

  if (!variants || variants.length === 0) {
    return (
      <div className={ROW_CLASSES}>
        {buyNow}
        <Link href={CART_LINK.href} aria-label={`Add to cart: ${productName}`} className={ADD_CLASSES}>
          <AddLabel />
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className={ROW_CLASSES}>
        {buyNow}
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label={`Add to cart: ${productName} — choose an option`}
          onClick={() => setOpen(true)}
          className={ADD_CLASSES}
        >
          <AddLabel />
        </button>
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title="Choose an option">
        <p className="text-sm font-semibold">{productName}</p>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          Sample options — live variants arrive with the product catalog.
        </p>
        <ul className="mt-3 grid gap-2">
          {variants.map((variant) => (
            <li key={variant}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push(CART_LINK.href);
                }}
                className="flex w-full items-center justify-between rounded-xl border border-[var(--color-light-grey)] px-4 py-2.5 text-sm font-medium transition-colors hover:border-[var(--color-action-red)] hover:text-[var(--color-action-red)]"
              >
                {variant}
                <span aria-hidden="true" className="text-[var(--text-muted)]">
                  →
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  );
}
