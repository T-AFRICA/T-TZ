"use client";

import { useState } from "react";
import { CartIcon, Dialog } from "@tronic/ui";
import type { Product } from "@tronic/types";
import { usePurchaseActions } from "@/features/cart/purchase";

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

type Mode = "add" | "buy";

/**
 * Card CTAs (owner request 2026-11-10: a working cart on every device).
 * A product without options goes straight into the cart: Add confirms with
 * a toast, Buy Now adds and opens the cart. A product with colours or
 * variants first opens a small dialog where each must be chosen, so a line
 * never lands in the cart without its options.
 */
export function AddToCartButton({ product }: { product: Pick<Product, "id" | "name" | "colors" | "variants" | "variantLabel"> }) {
  const purchase = usePurchaseActions();
  const [mode, setMode] = useState<Mode | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [variant, setVariant] = useState<string | null>(null);

  const colors = product.colors ?? [];
  const variants = product.variants ?? [];
  const hasOptions = colors.length > 0 || variants.length > 0;
  const variantLabel = product.variantLabel ?? "Option";
  const complete = (colors.length === 0 || color !== null) && (variants.length === 0 || variant !== null);

  function run(action: Mode, chosenColor: string | null, chosenVariant: string | null) {
    const line = { productId: product.id, name: product.name, quantity: 1, color: chosenColor, variant: chosenVariant };
    if (action === "buy") {
      purchase.buyNow(line);
    } else {
      purchase.addToCart(line);
    }
  }

  function start(action: Mode) {
    if (hasOptions) {
      setColor(null);
      setVariant(null);
      setMode(action);
    } else {
      run(action, null, null);
    }
  }

  function confirm() {
    if (!mode || !complete) return;
    const action = mode;
    setMode(null);
    run(action, color, variant);
  }

  // Accessible names start with the visible text so voice-control users can
  // activate each button by its label.
  const suffix = hasOptions ? " — choose options" : "";
  return (
    <>
      <div className={ROW_CLASSES}>
        <button
          type="button"
          aria-haspopup={hasOptions ? "dialog" : undefined}
          aria-label={`Buy now: ${product.name}${suffix}`}
          onClick={() => start("buy")}
          className={BUY_CLASSES}
        >
          Buy Now
        </button>
        <button
          type="button"
          aria-haspopup={hasOptions ? "dialog" : undefined}
          aria-label={`Add to cart: ${product.name}${suffix}`}
          onClick={() => start("add")}
          className={ADD_CLASSES}
        >
          {/* Cards are 170-190px wide in every grid, so the label is "Add";
              the accessible name still says "Add to cart". */}
          <CartIcon size={12} />
          <span>Add</span>
        </button>
      </div>
      {hasOptions ? (
        <Dialog open={mode !== null} onClose={() => setMode(null)} title="Choose options">
          <p className="text-sm font-semibold">{product.name}</p>
          {colors.length > 0 ? (
            <div role="group" aria-label="Colour" className="mt-4">
              <p className="text-xs font-semibold">
                Colour{color ? <span className="font-normal text-[var(--text-secondary)]">: {color}</span> : null}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {colors.map((option) => {
                  const selected = option.name === color;
                  return (
                    <button
                      key={option.name}
                      type="button"
                      aria-label={option.name}
                      aria-pressed={selected}
                      onClick={() => setColor(option.name)}
                      className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors ${
                        selected ? "border-[var(--color-action-red)]" : "border-transparent hover:border-[var(--color-light-grey)]"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="h-6 w-6 rounded-full shadow-[inset_0_0_0_1px_rgba(17,17,17,0.12)]"
                        style={{ backgroundColor: option.swatch }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {variants.length > 0 ? (
            <div role="group" aria-label={variantLabel} className="mt-4">
              <p className="text-xs font-semibold">{variantLabel}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {variants.map((option) => {
                  const selected = option === variant;
                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setVariant(option)}
                      className={`rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
                        selected
                          ? "border-[var(--color-action-red)] bg-[var(--color-action-red)] text-white"
                          : "border-[var(--color-light-grey)] hover:border-[var(--color-action-red)] hover:text-[var(--color-action-red)]"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <button
            type="button"
            onClick={confirm}
            disabled={!complete}
            className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--color-action-red)] text-sm font-semibold text-white transition-colors hover:bg-[var(--color-action-red-dark)] disabled:cursor-not-allowed disabled:bg-[var(--color-light-grey)] disabled:text-[var(--text-muted)]"
          >
            <CartIcon size={16} />
            {mode === "buy" ? "Buy Now" : "Add to Cart"}
          </button>
          {!complete ? (
            <p className="mt-2 text-center text-xs text-[var(--text-muted)]">Choose each option to continue.</p>
          ) : null}
        </Dialog>
      ) : null}
    </>
  );
}
