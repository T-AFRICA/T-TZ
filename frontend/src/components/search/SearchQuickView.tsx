"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ProductSearchHit } from "@tronic/types";
import { ArrowLeftIcon, ArrowRightIcon, CartIcon } from "@tronic/ui";
import { MAX_PURCHASE_QUANTITY, selectionLabel, usePurchaseActions } from "@/features/cart/purchase";
import { placeholderDescription } from "@/features/catalog/description";
import { formatHitPrice, isOnSale, productHref } from "./SearchResultItem";

const MODEL_LABEL = /^model\b/i;
/** Specification rows in the quick view (the hit lists the useful ones first). */
const QUICK_SPEC_ROWS = 5;
/** Descriptions longer than this get a Read more toggle. */
const DESCRIPTION_TOGGLE_CHARS = 180;
/** How long the Add to Cart button says "Added" (and ignores repeat clicks). */
const ADDED_FEEDBACK_MS = 1800;

function gallery(hit: ProductSearchHit): string[] {
  return [hit.image, ...(hit.images ?? [])];
}

/**
 * Right-hand quick view of the desktop search panel (owner briefs of
 * 2026-11-10): a compact product page for the product under the pointer or
 * keyboard highlight. Gallery, identity (category, name, SKU with the chosen
 * options, model), price with any sale price and saving, stock, description,
 * up to five specifications, colour and variant choices, quantity, Add to
 * Cart, Buy Now and a link to the full product page.
 *
 * Everything comes from the search hit that is already loaded, so hovering
 * never sends a request. Purchasing goes through usePurchaseActions, the
 * same entry point the product page uses (sample mode until the cart and
 * checkout exist). Options are never preselected: a product with colours or
 * variants cannot be bought until each is chosen. Per-option price, stock,
 * SKU and image do not exist in the catalogue yet, so the choice is carried
 * in the SKU line exactly as on the product page.
 *
 * All result images are stacked in the gallery box and only the active one
 * is visible, so moving between rows swaps instantly without a blank frame.
 */
export function SearchQuickView({
  hits,
  active,
  onNavigate,
  layout = "panel",
}: {
  hits: readonly ProductSearchHit[];
  active: ProductSearchHit;
  /** Called when a link inside the panel is followed (closes the panel). */
  onNavigate: () => void;
  /** "panel": desktop search column; "sheet": the phone bottom sheet. */
  layout?: "panel" | "sheet";
}) {
  // Gallery position belongs to one product; another product starts at 0.
  const [galleryState, setGalleryState] = useState({ id: active.id, index: 0 });
  const images = gallery(active);
  const imageIndex = galleryState.id === active.id ? Math.min(galleryState.index, images.length - 1) : 0;
  const showImage = (index: number) =>
    setGalleryState({ id: active.id, index: (index + images.length) % images.length });
  const onSale = isOnSale(active);
  const saving = onSale ? Math.round((1 - active.price / active.wasPrice) * 100) : 0;

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      {/* Column flex so a short product still has its purchase bar at the
          bottom of the panel; children never shrink, the area scrolls. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 pt-5 [&>*]:shrink-0">
        <div
          className={`grid gap-4 ${layout === "sheet" ? "grid-cols-[7.5rem_minmax(0,1fr)] sm:grid-cols-[9.5rem_minmax(0,1fr)]" : "grid-cols-[9.5rem_minmax(0,1fr)]"}`}
        >
          {/* Gallery */}
          <div>
            <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-[var(--color-light-grey)] bg-white">
              {hits.map((hit) =>
                gallery(hit).map((src, index) => {
                  const visible = hit.id === active.id && index === imageIndex;
                  // Non-active products only preload their main image.
                  if (hit.id !== active.id && index > 0) return null;
                  return (
                    <Image
                      key={`${hit.id}-${index}`}
                      src={src}
                      alt={visible ? `${hit.name}${images.length > 1 ? `, image ${index + 1} of ${images.length}` : ""}` : ""}
                      aria-hidden={visible ? undefined : true}
                      fill
                      sizes="152px"
                      className={`object-contain p-2.5 transition-opacity duration-150 ${visible ? "opacity-100" : "opacity-0"}`}
                    />
                  );
                }),
              )}
              {onSale ? (
                <span className="absolute left-1.5 top-1.5 rounded bg-[var(--color-action-red)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  Save {saving}%
                </span>
              ) : null}
            </div>
            {images.length > 1 ? (
              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  aria-label="Previous image"
                  onClick={() => showImage(imageIndex - 1)}
                  className="grid h-7 w-7 place-items-center rounded-full border border-[var(--color-light-grey)] bg-white text-[var(--text-secondary)] transition-colors hover:border-[var(--color-premium-black)] hover:text-[var(--text-primary)]"
                >
                  <ArrowLeftIcon size={13} />
                </button>
                <span className="text-[11px] tabular-nums text-[var(--text-muted)]">
                  {imageIndex + 1} / {images.length}
                </span>
                <button
                  type="button"
                  aria-label="Next image"
                  onClick={() => showImage(imageIndex + 1)}
                  className="grid h-7 w-7 place-items-center rounded-full border border-[var(--color-light-grey)] bg-white text-[var(--text-secondary)] transition-colors hover:border-[var(--color-premium-black)] hover:text-[var(--text-primary)]"
                >
                  <ArrowRightIcon size={13} />
                </button>
              </div>
            ) : null}
          </div>

          {/* Identity, price and stock */}
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              {active.categoryName}
            </p>
            <h3 className="mt-1 line-clamp-3 text-[15px] font-semibold leading-snug text-[var(--text-primary)]">
              {active.name}
            </h3>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-2">
              <span
                className={`text-xl font-bold leading-none ${onSale ? "text-[var(--color-action-red)]" : "text-[var(--color-premium-black)]"}`}
              >
                {formatHitPrice(active.price, active.currency)}
              </span>
              {onSale ? (
                <span className="text-[12px] text-[var(--text-muted)] line-through">
                  {formatHitPrice(active.wasPrice, active.currency)}
                </span>
              ) : null}
            </div>
            <p
              className={`mt-2 flex items-center gap-1.5 text-[12px] font-medium ${
                active.inStock ? "text-[var(--color-success)]" : "text-[var(--text-muted)]"
              }`}
            >
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
              {active.inStock ? "In stock" : "Out of stock"}
            </p>
          </div>
        </div>

        {/* Options, quantity and actions live in one keyed block so a new
            product always starts clean (no options, quantity 1). */}
        <QuickViewDetails key={active.id} hit={active} onNavigate={onNavigate} layout={layout} />
      </div>
    </div>
  );
}

function QuickViewDetails({
  hit,
  onNavigate,
  layout,
}: {
  hit: ProductSearchHit;
  onNavigate: () => void;
  layout: "panel" | "sheet";
}) {
  const purchase = usePurchaseActions();
  const [color, setColor] = useState<string | null>(null);
  const [variant, setVariant] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<"idle" | "added" | "leaving">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const specs = hit.specifications ?? [];
  const model = specs.find((spec) => MODEL_LABEL.test(spec.label))?.value;
  const rows = specs.filter((spec) => !MODEL_LABEL.test(spec.label)).slice(0, QUICK_SPEC_ROWS);
  const variantLabel = hit.variantLabel ?? "Option";
  const needsColor = (hit.colors?.length ?? 0) > 0 && color === null;
  const needsVariant = (hit.variants?.length ?? 0) > 0 && variant === null;
  const selection = selectionLabel(color, variant);
  const canBuy = hit.inStock && !needsColor && !needsVariant && status === "idle";
  const longDescription = (hit.description?.length ?? 0) > DESCRIPTION_TOGGLE_CHARS;

  const missing = [needsColor ? "a colour" : null, needsVariant ? `a ${variantLabel.toLowerCase()}` : null]
    .filter(Boolean)
    .join(" and ");
  const hint = !hit.inStock
    ? "Out of stock, so it cannot be bought right now."
    : missing
      ? `Choose ${missing} to continue.`
      : null;

  function addToCart() {
    if (!canBuy) return;
    purchase.addToCart({ name: hit.name, quantity, selection });
    setStatus("added");
    timer.current = setTimeout(() => setStatus("idle"), ADDED_FEEDBACK_MS);
  }

  function buyNow() {
    if (!canBuy) return;
    setStatus("leaving");
    onNavigate();
    purchase.buyNow();
  }

  const sheet = layout === "sheet";
  const label = "text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]";
  const stepButton =
    "grid h-8 w-8 place-items-center rounded-full text-lg leading-none text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-card)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    <>
      <p className="mt-3 truncate text-[12px] text-[var(--text-muted)]">
        SKU {hit.sku}
        {selection ? ` · ${selection}` : ""}
        {model ? ` · Model ${model}` : ""}
      </p>

      <div className="mt-3">
        <p className={label}>Description</p>
        {/* The product's own copy, or the same generic line the product
            page shows until the live catalogue supplies one. */}
        <p
          id={`${hit.id}-description`}
          className={`mt-1 text-[12.5px] leading-relaxed text-[var(--text-secondary)] ${expanded ? "" : "line-clamp-4"}`}
        >
          {hit.description ?? placeholderDescription(hit.categoryName)}
        </p>
        {longDescription ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={`${hit.id}-description`}
            onClick={() => setExpanded((open) => !open)}
            className="mt-1 text-[12px] font-semibold text-[var(--color-action-red)] underline-offset-4 hover:underline"
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        ) : null}
      </div>

      {rows.length > 0 ? (
        <div className="mt-4">
          <p className={label}>Specifications</p>
          <dl className="mt-1.5 divide-y divide-[var(--color-light-grey)]/70 text-[12px]">
            {rows.map((spec) => (
              <div key={spec.label} className="flex justify-between gap-4 py-1.5">
                <dt className="shrink-0 text-[var(--text-muted)]">{spec.label}</dt>
                <dd className="min-w-0 truncate text-right font-medium text-[var(--text-primary)]">{spec.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {hit.colors && hit.colors.length > 0 ? (
        <div role="group" aria-label="Colour" className="mt-4">
          <p className={label}>
            Colour{color ? <span className="ml-1 normal-case tracking-normal text-[var(--text-secondary)]">{color}</span> : null}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {hit.colors.map((option) => {
              const selected = option.name === color;
              return (
                <button
                  key={option.name}
                  type="button"
                  aria-label={option.name}
                  aria-pressed={selected}
                  disabled={!hit.inStock}
                  onClick={() => setColor(option.name)}
                  className={`grid h-8 w-8 place-items-center rounded-full border-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    selected ? "border-[var(--color-action-red)]" : "border-transparent hover:border-[var(--color-light-grey)]"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="h-5 w-5 rounded-full shadow-[inset_0_0_0_1px_rgba(17,17,17,0.12)]"
                    style={{ backgroundColor: option.swatch }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {hit.variants && hit.variants.length > 0 ? (
        <div role="group" aria-label={variantLabel} className="mt-4">
          <p className={label}>{variantLabel}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {hit.variants.map((option) => {
              const selected = option === variant;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={selected}
                  disabled={!hit.inStock}
                  onClick={() => setVariant(option)}
                  className={`h-8 rounded-full border px-3 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    selected
                      ? "border-[var(--color-action-red)] bg-[var(--color-action-red)] text-white"
                      : "border-[var(--color-light-grey)] bg-white hover:border-[var(--color-action-red)] hover:text-[var(--color-action-red)]"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Spacer: at least 1rem, grows to push the purchase bar down. */}
      <div aria-hidden="true" className="grow basis-4" />
      {/* Purchase bar: sticks to the bottom of the quick view while the
          details above it scroll. */}
      <div
        className={`sticky bottom-0 -mx-5 border-t border-[var(--color-light-grey)] bg-white px-5 pt-3 ${
          sheet ? "pb-[calc(0.75rem+env(safe-area-inset-bottom))]" : "pb-3"
        }`}
      >
        {/* Phones: quantity and Add to Cart on one row, Buy Now full width
            below, all 44px tall. */}
        <div className={`flex items-center gap-2 ${sheet ? "flex-wrap" : ""}`}>
          <div
            role="group"
            aria-label="Quantity"
            className={`inline-flex shrink-0 items-center rounded-full border border-[var(--color-light-grey)] bg-white px-1 ${sheet ? "h-11" : "h-10"}`}
          >
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={!hit.inStock || quantity <= 1}
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className={stepButton}
            >
              −
            </button>
            <span aria-live="polite" className="w-7 text-center text-[13px] font-semibold tabular-nums">
              {quantity}
            </span>
            <button
              type="button"
              aria-label="Increase quantity"
              disabled={!hit.inStock || quantity >= MAX_PURCHASE_QUANTITY}
              onClick={() => setQuantity((q) => Math.min(MAX_PURCHASE_QUANTITY, q + 1))}
              className={stepButton}
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={addToCart}
            disabled={!canBuy}
            aria-describedby={hint ? `${hit.id}-purchase-hint` : undefined}
            className={`inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full bg-[var(--color-action-red)] px-3 text-[13px] ${sheet ? "h-11" : "h-10"} font-semibold text-white transition-[background-color,transform] hover:bg-[var(--color-action-red-dark)] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[var(--color-light-grey)] disabled:text-[var(--text-muted)] disabled:active:scale-100`}
          >
            {status === "added" ? (
              <>
                <span aria-hidden="true">✓</span> Added
              </>
            ) : (
              <>
                <CartIcon size={15} /> Add to Cart
              </>
            )}
          </button>
          <button
            type="button"
            onClick={buyNow}
            disabled={!canBuy}
            aria-describedby={hint ? `${hit.id}-purchase-hint` : undefined}
            className={`inline-flex shrink-0 items-center justify-center rounded-full border-[1.5px] ${sheet ? "h-11 basis-full" : "h-10"} border-[var(--color-action-red)] px-4 text-[13px] font-semibold text-[var(--color-action-red)] transition-[background-color,transform] hover:bg-[#fdecec] active:scale-[0.98] disabled:cursor-not-allowed disabled:border-[var(--color-light-grey)] disabled:text-[var(--text-muted)] disabled:hover:bg-transparent disabled:active:scale-100`}
          >
            {status === "leaving" ? "Opening…" : "Buy Now"}
          </button>
        </div>
        <div className={`mt-2 flex ${sheet ? "flex-col items-start gap-1.5" : "items-center justify-between gap-3"}`}>
          <p
            id={`${hit.id}-purchase-hint`}
            aria-live="polite"
            className={`min-w-0 text-[11px] ${sheet ? "" : "truncate"} ${hint ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]"}`}
          >
            {status === "added"
              ? "Added to cart (sample mode, nothing is stored)."
              : (hint ?? (quantity >= MAX_PURCHASE_QUANTITY ? "Maximum quantity reached" : "Sample mode: no order is placed."))}
          </p>
          <Link
            href={productHref(hit)}
            onClick={onNavigate}
            className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-[var(--text-primary)] underline-offset-4 hover:text-[var(--color-action-red)] hover:underline"
          >
            View full product details
            <ArrowRightIcon size={12} />
          </Link>
        </div>
      </div>
    </>
  );
}
