"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { CartIcon, Dialog } from "@tronic/ui";
import { CART_LINK } from "@/config/site";

const MotionLink = motion.create(Link);

/** Quick press-down spring; motion skips it under reduced motion via the hook. */
const TAP_SPRING = { type: "spring", stiffness: 500, damping: 30 } as const;

/** Shared CTA styling; h-9 below md keeps the target easy to tap on phones. */
const CTA_CLASSES =
  "mt-1.5 flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-[var(--color-action-red)] text-[10px] font-semibold uppercase tracking-wide text-white shadow-[0_5px_12px_-6px_rgba(215,25,32,0.55)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--color-action-red-dark)] md:h-8 md:text-[11px]";

export interface AddToCartButtonProps {
  productName: string;
  /** Synthetic variant options; when present a quick-selection dialog opens first. */
  variants?: readonly string[];
}

/**
 * Homepage card CTA. Without variants it links straight to the cart
 * placeholder route (the real add-to-cart lands with Module 02); with
 * variants it opens a quick-selection dialog so a choice is made before
 * anything would be added.
 */
export function AddToCartButton({ productName, variants }: AddToCartButtonProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const whileTap = reduceMotion ? undefined : { scale: 0.96 };

  if (!variants || variants.length === 0) {
    return (
      <MotionLink
        href={CART_LINK.href}
        aria-label={`Add ${productName} to cart`}
        whileTap={whileTap}
        transition={TAP_SPRING}
        className={CTA_CLASSES}
      >
        <CartIcon size={13} />
        Add to Cart
      </MotionLink>
    );
  }

  return (
    <>
      <motion.button
        type="button"
        aria-haspopup="dialog"
        aria-label={`Add ${productName} to cart — choose an option`}
        onClick={() => setOpen(true)}
        whileTap={whileTap}
        transition={TAP_SPRING}
        className={CTA_CLASSES}
      >
        <CartIcon size={13} />
        Add to Cart
      </motion.button>
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
