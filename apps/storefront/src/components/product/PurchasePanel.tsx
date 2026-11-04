"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CartIcon, useToast } from "@tronic/ui";
import { CART_LINK } from "@/config/site";
import {
  discountPercent,
  formatSamplePrice,
  type SampleProduct,
} from "@/components/home/sampleProducts";

const MAX_QUANTITY = 10;

/**
 * PDP purchase block: variant pills (brand red when selected), quantity
 * stepper, Add to Cart + Buy Now, and the sticky mobile purchase bar that
 * sits above the bottom tab bar. The cart itself arrives with Module 02:
 * Add to Cart confirms via toast (clearly labelled sample mode) and Buy
 * Now continues to the existing /cart placeholder route, so no fake order
 * is ever created. Per-variant price/stock/imagery wiring lands with the
 * live catalog — the selected variant is carried in the displayed SKU.
 * Purchasing is disabled while out of stock.
 */
export function PurchasePanel({ product }: { product: SampleProduct }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [variant, setVariant] = useState<string | null>(product.variants?.[0] ?? null);
  const [color, setColor] = useState<string | null>(product.colors?.[0]?.name ?? null);
  const [quantity, setQuantity] = useState(1);

  const saving = discountPercent(product);
  const selection = [color, variant].filter(Boolean).join(" · ");
  const sku = `${product.id.toUpperCase()}${selection ? ` · ${selection}` : ""}`;

  function addToCart() {
    showToast(
      `Added ${quantity} × ${product.name}${selection ? ` (${selection})` : ""} — sample mode, cart launches with the live catalog`,
      "success",
    );
  }

  function buyNow() {
    router.push(CART_LINK.href);
  }

  const primaryClasses =
    "inline-flex h-[3.25rem] w-full items-center justify-center gap-2 rounded-full bg-[var(--color-action-red)] text-[15px] font-semibold text-white shadow-[0_10px_26px_-10px_rgba(215,25,32,0.7)] transition-[background-color,transform] active:scale-[0.98] hover:bg-[var(--color-action-red-dark)] disabled:cursor-not-allowed disabled:bg-[var(--color-light-grey)] disabled:text-[var(--text-muted)] disabled:shadow-none";
  const secondaryClasses =
    "inline-flex h-[3.25rem] w-full items-center justify-center gap-2 rounded-full border border-[var(--color-light-grey)] bg-white text-[15px] font-semibold text-[var(--text-primary)] transition-[border-color,color,transform] active:scale-[0.98] hover:border-[var(--color-action-red)] hover:text-[var(--color-action-red)] disabled:cursor-not-allowed disabled:border-[var(--color-light-grey)] disabled:text-[var(--text-muted)] disabled:hover:border-[var(--color-light-grey)]";

  return (
    <div>
      {/* Price block — directly under the title on phones */}
      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 md:mt-4">
        <span
          className={`text-2xl font-bold md:text-3xl ${
            product.wasPrice !== undefined
              ? "text-[var(--color-action-red)]"
              : "text-[var(--color-premium-black)]"
          }`}
        >
          {formatSamplePrice(product.price)}
        </span>
        {product.wasPrice !== undefined ? (
          <span className="text-sm text-[var(--text-muted)] line-through">
            {formatSamplePrice(product.wasPrice)}
          </span>
        ) : null}
        {saving !== null ? (
          <span className="rounded bg-[var(--color-action-red)] px-1.5 py-0.5 text-[11px] font-semibold text-white">
            Save {saving}%
          </span>
        ) : null}
      </div>
      <p
        className={`mt-1.5 text-sm font-medium ${
          product.inStock ? "text-[var(--color-success)]" : "text-[var(--text-muted)]"
        }`}
      >
        {product.inStock ? "In stock" : "Out of stock"}
      </p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">SKU {sku}</p>

      {/* Colour swatches (reference style) — shown only for products with
          real colour options */}
      {product.colors && product.colors.length > 0 ? (
        <div
          role="group"
          aria-label="Color"
          className="mt-4 border-t border-[var(--color-light-grey)] pt-4 md:mt-6 md:pt-5"
        >
          <p className="text-sm font-semibold">
            Color: <span className="font-normal text-[var(--text-secondary)]">{color}</span>
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
            {product.colors.map((option) => {
              const selected = option.name === color;
              return (
                <button
                  key={option.name}
                  type="button"
                  aria-label={option.name}
                  aria-pressed={selected}
                  onClick={() => setColor(option.name)}
                  className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all hover:scale-105 ${
                    selected
                      ? "border-[var(--color-action-red)]"
                      : "border-transparent hover:border-[var(--color-light-grey)]"
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

      {/* Variants — labelled with the product's real option axis (e.g.
          Color Temperature, Type); hidden entirely without real variants */}
      {product.variants && product.variants.length > 0 ? (
        <div
          role="group"
          aria-label={product.variantLabel ?? "Options"}
          className="mt-4 border-t border-[var(--color-light-grey)] pt-4 md:mt-6 md:pt-5"
        >
          <p className="text-sm font-semibold">{product.variantLabel ?? "Options"}:</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {product.variants.map((option) => {
              const selected = option === variant;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setVariant(option)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
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

      {/* Quantity — soft pill with round steppers (reference style) */}
      <div className="mt-4 md:mt-5">
        <p className="text-sm font-semibold">Quantity:</p>
        <div className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-[var(--surface-card)] p-1.5">
          <button
            type="button"
            aria-label="Decrease quantity"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={!product.inStock || quantity <= 1}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg shadow-sm transition-colors hover:text-[var(--color-action-red)] disabled:text-[var(--color-light-grey)] disabled:shadow-none disabled:bg-transparent"
          >
            −
          </button>
          <span aria-live="polite" className="w-10 text-center text-sm font-semibold">
            {String(quantity).padStart(2, "0")}
          </span>
          <button
            type="button"
            aria-label="Increase quantity"
            onClick={() => setQuantity((q) => Math.min(MAX_QUANTITY, q + 1))}
            disabled={!product.inStock || quantity >= MAX_QUANTITY}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-action-red)] text-lg text-white shadow-sm transition-colors hover:bg-[var(--color-action-red-dark)] disabled:bg-transparent disabled:text-[var(--color-light-grey)] disabled:shadow-none"
          >
            +
          </button>
        </div>
      </div>

      {/* Actions: large stacked CTAs (in-flow on md+; phones use the sticky bar) */}
      <div className="mt-7 hidden flex-col gap-3 md:flex">
        <button type="button" onClick={addToCart} disabled={!product.inStock} className={primaryClasses}>
          <CartIcon size={18} />
          Add to Cart
        </button>
        <button type="button" onClick={buyNow} disabled={!product.inStock} className={secondaryClasses}>
          Buy Now
        </button>
      </div>
      {!product.inStock ? (
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          This sample item is marked out of stock, so purchasing is disabled.
        </p>
      ) : null}

      {/* Sticky mobile purchase bar, above the bottom tab bar (which is
          3.5rem plus the device safe-area inset tall) */}
      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-[var(--color-light-grey)] bg-white/95 px-4 pb-2 pt-2 backdrop-blur md:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <p className="truncate text-[11px] text-[var(--text-muted)]">{product.name}</p>
            <p
              className={`text-base font-bold leading-tight ${
                product.wasPrice !== undefined
                  ? "text-[var(--color-action-red)]"
                  : "text-[var(--color-premium-black)]"
              }`}
            >
              {formatSamplePrice(product.price)}
            </p>
          </div>
          <div className="ml-auto flex shrink-0 gap-2">
            <button
              type="button"
             
              onClick={buyNow}
              disabled={!product.inStock}
              className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--color-action-red)] px-4 text-xs font-semibold text-[var(--color-action-red)] transition-transform active:scale-[0.97] disabled:border-[var(--color-light-grey)] disabled:text-[var(--text-muted)]"
            >
              Buy Now
            </button>
            <button
              type="button"
             
              onClick={addToCart}
              disabled={!product.inStock}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-[var(--color-action-red)] px-5 text-xs font-semibold text-white transition-transform active:scale-[0.97] disabled:bg-[var(--color-light-grey)] disabled:text-[var(--text-muted)]"
            >
              <CartIcon size={15} />
              {product.inStock ? "Add to Cart" : "Out of Stock"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
