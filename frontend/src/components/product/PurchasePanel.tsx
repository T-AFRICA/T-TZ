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

  // One pill holds both steps: a quiet minus, the count, and a filled plus.
  // Buttons are 40px inside a 44px pill, so each is a comfortable tap target.
  const stepBase =
    "flex h-10 w-10 items-center justify-center rounded-full text-xl font-medium leading-none transition-[background-color,color,transform] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-action-red)] disabled:cursor-not-allowed disabled:active:scale-100";
  const minusClasses = `${stepBase} text-[var(--text-primary)] hover:bg-[var(--surface-card)] disabled:text-[var(--text-muted)] disabled:opacity-40 disabled:hover:bg-transparent`;
  const plusClasses = `${stepBase} bg-[var(--color-action-red)] text-white shadow-[0_6px_14px_-8px_rgba(215,25,32,0.8)] hover:bg-[var(--color-action-red-dark)] disabled:bg-[var(--color-light-grey)] disabled:text-[var(--text-muted)] disabled:shadow-none`;

  return (
    <div>
      {/* Price block — directly under the title on phones */}
      <div className="mt-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 md:mt-4">
        <span className="text-[1.75rem] font-bold leading-none tracking-[-0.01em] text-[var(--color-action-red)] md:text-3xl">
          {formatSamplePrice(product.price)}
        </span>
        {product.wasPrice !== undefined ? (
          <span className="text-sm text-[var(--text-muted)] line-through decoration-[1.5px]">
            {formatSamplePrice(product.wasPrice)}
          </span>
        ) : null}
        {saving !== null ? (
          <span className="translate-y-[-2px] rounded-md bg-[var(--color-action-red)] px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white">
            Save {saving}%
          </span>
        ) : null}
      </div>
      {/* Availability, SKU and the demo marker on one quiet line. The marker
          stays for as long as demo data is active (the site is public), but
          as a discreet indicator rather than a banner in the hierarchy. */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span
          className={`inline-flex items-center gap-1.5 font-medium ${
            product.inStock ? "text-[var(--color-success)]" : "text-[var(--text-muted)]"
          }`}
        >
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
          {product.inStock ? "In stock" : "Out of stock"}
        </span>
        <span className="tracking-wide text-[var(--text-muted)]">SKU {sku}</span>
        <span
          title="Prices, options and stock are demonstration values until the live catalogue launches."
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[var(--color-light-grey)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)] md:ml-auto"
        >
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#d97706]" />
          Demo price &amp; stock
        </span>
      </div>

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

      {/* Quantity — label left, one unified pill right: [−] [01] [+] */}
      <div
        role="group"
        aria-label="Quantity"
        className="mt-4 flex items-center justify-between gap-4 border-t border-[var(--color-light-grey)] pt-3.5 md:mt-5 md:justify-start md:pt-4"
      >
        <div>
          <p aria-hidden="true" className="text-sm font-semibold">
            Quantity
          </p>
          {quantity >= MAX_QUANTITY ? (
            <p className="mt-0.5 text-[11px] leading-tight text-[var(--text-muted)]">
              Maximum quantity reached
            </p>
          ) : null}
        </div>
        <div className="inline-flex h-11 shrink-0 items-center gap-1 rounded-full border border-[var(--color-light-grey)] bg-white p-0.5">
          <button
            type="button"
            aria-label="Decrease quantity"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={!product.inStock || quantity <= 1}
            className={minusClasses}
          >
            −
          </button>
          <span aria-live="polite" className="w-10 text-center text-[15px] font-semibold tabular-nums">
            {String(quantity).padStart(2, "0")}
          </span>
          <button
            type="button"
            aria-label="Increase quantity"
            onClick={() => setQuantity((q) => Math.min(MAX_QUANTITY, q + 1))}
            disabled={!product.inStock || quantity >= MAX_QUANTITY}
            className={plusClasses}
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
          3.5rem plus the device safe-area inset tall). The data attribute lets
          the page reserve this bar's height, so it never covers the footer. */}
      <div
        data-sticky-purchase
        className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-[var(--color-light-grey)] bg-white/95 px-4 py-2 backdrop-blur md:hidden"
      >
        <div className="flex items-center gap-2">
          {/* Price only — the name is on screen already (no duplication). Below
              360px the two buttons need the whole width, so the price (shown just
              above in the panel) steps out. */}
          <p className="shrink-0 text-base font-bold leading-tight text-[var(--color-action-red)] max-[359px]:hidden">
            {formatSamplePrice(product.price)}
          </p>
          {/* Secondary outline beside the filled primary: 44px pills, 8px apart,
              comfortable to tap one-handed above the tab bar. */}
          <div className="ml-auto flex shrink-0 gap-2 max-[359px]:w-full">
            <button
              type="button"
              onClick={buyNow}
              disabled={!product.inStock}
              className="inline-flex h-11 items-center justify-center rounded-full border-[1.5px] border-[var(--color-action-red)] px-4 text-[13px] font-semibold leading-none text-[var(--color-action-red)] transition-[transform,background-color] active:scale-[0.97] active:bg-[#fdecec] disabled:border-[var(--color-light-grey)] disabled:text-[var(--text-muted)] disabled:active:bg-transparent max-[359px]:flex-1 max-[359px]:px-3"
            >
              Buy Now
            </button>
            <button
              type="button"
              onClick={addToCart}
              disabled={!product.inStock}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-[var(--color-action-red)] px-5 text-[13px] font-semibold leading-none text-white shadow-[0_8px_18px_-10px_rgba(215,25,32,0.8)] transition-[transform,background-color] active:scale-[0.97] active:bg-[var(--color-action-red-dark)] disabled:bg-[var(--color-light-grey)] disabled:text-[var(--text-muted)] disabled:shadow-none max-[359px]:flex-1 max-[359px]:px-3"
            >
              <span className="max-[359px]:hidden">
                <CartIcon size={15} />
              </span>
              {product.inStock ? "Add to Cart" : "Out of Stock"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
