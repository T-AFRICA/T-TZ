"use client";

import { useRef, useState } from "react";
import { CartIcon, CheckCircleIcon, Dialog } from "@tronic/ui";
import type { Product } from "@tronic/types";
import { useAddedFeedback, usePurchaseActions } from "@/features/cart/purchase";

/**
 * Two compact CTAs in one row: Buy Now (quiet outline, fixed width) and
 * Add to Cart (filled, takes the rest). 34px tall; each button is its own
 * tap target. Add is brand red and turns black on hover/focus (owner
 * request 2026-11-12); Buy Now is a neutral outline so the red stays on the
 * one main action. Press feedback is the shared m-press class (CSS, so SSR
 * markup never depends on the reduced-motion preference), and m-hit-y
 * gives each 34px button a 44px tall touch area.
 */
const ROW_CLASSES = "mt-2 flex gap-1.5";
const BASE_CLASSES =
  "m-press m-hit-y relative flex h-[34px] items-center justify-center gap-1 rounded-full text-[11px] font-semibold";
const BUY_CLASSES = `${BASE_CLASSES} shrink-0 border border-[var(--color-light-grey)] px-2.5 text-[var(--text-primary)] hover:border-[var(--color-premium-black)] max-[359px]:px-2 md:px-3`;
const ADD_CLASSES = `${BASE_CLASSES} min-w-0 flex-1 bg-[var(--color-action-red)] px-2 text-white hover:bg-[var(--color-premium-black)] focus-visible:bg-[var(--color-premium-black)]`;

type Mode = "add" | "buy";

/**
 * Card CTAs (owner request 2026-11-10: a working cart on every device).
 * A product without options acts at once: Add puts it in the cart and
 * confirms with a toast; Buy Now opens the checkout with that one product
 * and leaves the cart as it is. A product with colours or
 * variants first opens a small dialog where each must be chosen, so a line
 * never lands in the cart without its options. After an add the button says
 * "Added" for a moment and the product's photo travels to the cart icon.
 */
export function AddToCartButton({
  product,
}: {
  product: Pick<Product, "id" | "name" | "colors" | "variants" | "variantLabel"> & { image?: string };
}) {
  const purchase = usePurchaseActions();
  const [added, flashAdded] = useAddedFeedback();
  const addButton = useRef<HTMLButtonElement>(null);
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
      purchase.addToCart(line, { from: addButton.current, image: product.image });
      flashAdded();
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
          Buy now
        </button>
        <button
          type="button"
          aria-haspopup={hasOptions ? "dialog" : undefined}
          aria-label={`Add to cart: ${product.name}${suffix}`}
          ref={addButton}
          data-added={added ? "" : undefined}
          onClick={() => start("add")}
          className={ADD_CLASSES}
        >
          {/* Cards are 170-190px wide in every grid, so the label is "Add";
              the accessible name still says "Add to cart". The toast
              announces the add; this is its visible echo on the button. */}
          {added ? <CheckCircleIcon size={13} /> : <CartIcon size={13} />}
          <span>{added ? "Added" : "Add"}</span>
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
                      className={`m-press m-press-icon m-hit relative flex h-9 w-9 items-center justify-center rounded-full border-2 ${
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
                      className={`m-press m-hit-y relative rounded-full border px-3.5 py-2 text-sm font-medium ${
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
            className="m-press mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--color-action-red)] text-sm font-semibold text-white hover:bg-[var(--color-action-red-dark)] disabled:cursor-not-allowed disabled:bg-[var(--color-light-grey)] disabled:text-[var(--text-muted)]"
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
