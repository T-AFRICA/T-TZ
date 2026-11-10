"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, CartIcon, Container } from "@tronic/ui";
import { formatSamplePrice } from "@/components/home/sampleProducts";
import { useCart, useHydrated, useWishlist } from "@/features/cart/hooks";
import { resolveLines, summarize, type ResolvedLine } from "@/features/cart/lines";
import { MAX_LINE_QUANTITY } from "@/features/cart/store";
import { selectionLabel } from "@/features/cart/purchase";

const CARD = "rounded-2xl bg-white md:border md:border-[var(--color-light-grey)]";
const STEP =
  "grid h-9 w-9 place-items-center rounded-full text-lg leading-none text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-card)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";

/**
 * The cart page body (owner request 2026-11-10). Lines come from this
 * browser's cart; every price, name, image and stock flag comes from the
 * catalogue (features/cart/lines.ts). Quantity can be changed (1–10) and
 * lines removed. Out-of-stock and no-longer-listed lines stay visible with
 * a note but are left out of the subtotal.
 *
 * There is no checkout yet (Module 02 / Phase 5): the button is disabled
 * and says so, and nothing is ordered or paid.
 */
export function CartView() {
  const hydrated = useHydrated();
  const { lines, setQuantity, remove } = useCart();
  const { ids: wishlistIds } = useWishlist();

  if (!hydrated) {
    return (
      <Container className="py-6 lg:py-8">
        <div aria-busy="true" aria-label="Loading your cart" className="grid gap-3 lg:grid-cols-[1fr_22rem]">
          <div className="h-40 animate-pulse rounded-2xl bg-white" />
          <div className="h-40 animate-pulse rounded-2xl bg-white" />
        </div>
      </Container>
    );
  }

  if (lines.length === 0) {
    return (
      <Container className="flex flex-col items-center py-14 text-center lg:py-20">
        <span
          aria-hidden="true"
          className="grid h-16 w-16 place-items-center rounded-full bg-white text-[var(--color-action-red)] shadow-[0_3px_14px_rgba(17,17,17,0.08)]"
        >
          <CartIcon size={28} />
        </span>
        <h2 className="mt-5 text-lg font-bold">Your cart is empty</h2>
        <p className="mt-1.5 max-w-sm text-sm text-[var(--text-secondary)]">
          Add products with the Add or Buy Now buttons and they will wait for you here.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--color-action-red)] px-6 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-action-red-dark)]"
          >
            Browse products
            <ArrowRightIcon size={16} />
          </Link>
          {wishlistIds.length > 0 ? (
            <Link
              href="/wishlist"
              className="inline-flex h-11 items-center rounded-full border border-[var(--color-light-grey)] bg-white px-6 text-sm font-semibold transition-colors hover:border-[var(--color-action-red)] hover:text-[var(--color-action-red)]"
            >
              View wishlist ({wishlistIds.length})
            </Link>
          ) : null}
        </div>
      </Container>
    );
  }

  const resolved = resolveLines(lines);
  const { itemCount, subtotal } = summarize(resolved);

  return (
    <Container className="py-6 lg:py-8">
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_22rem] lg:gap-6">
        <section aria-label="Cart items" className={`${CARD} divide-y divide-[var(--color-light-grey)] px-3 md:px-5`}>
          {resolved.map((item) => (
            <CartLineRow key={item.key} item={item} onQuantity={setQuantity} onRemove={remove} />
          ))}
        </section>

        <aside aria-label="Order summary" className={`${CARD} p-4 md:p-5 lg:sticky lg:top-[calc(var(--header-height)_+_1rem)]`}>
          <h2 className="text-base font-bold">Summary</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--text-secondary)]">Items</dt>
              <dd className="font-medium tabular-nums">{itemCount}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-[var(--color-light-grey)] pt-2">
              <dt className="font-semibold">Subtotal</dt>
              <dd className="text-lg font-bold tabular-nums text-[var(--color-action-red)]">{formatSamplePrice(subtotal)}</dd>
            </div>
          </dl>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Delivery is worked out at checkout.</p>
          <button
            type="button"
            disabled
            aria-describedby="checkout-note"
            className="mt-4 inline-flex h-12 w-full cursor-not-allowed items-center justify-center rounded-full bg-[var(--color-light-grey)] text-sm font-semibold text-[var(--text-muted)]"
          >
            Checkout opens soon
          </button>
          <p id="checkout-note" className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
            Prices are demo values and checkout is not open yet, so no order is placed and nothing is
            charged. Your cart is saved on this device.
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:text-[var(--color-action-red)] hover:underline"
          >
            Continue shopping
            <ArrowRightIcon size={14} />
          </Link>
        </aside>
      </div>
    </Container>
  );
}

function CartLineRow({
  item,
  onQuantity,
  onRemove,
}: {
  item: ResolvedLine;
  onQuantity: (key: string, quantity: number) => void;
  onRemove: (key: string) => void;
}) {
  const { key, line, product } = item;
  const selection = selectionLabel(line.color, line.variant);
  const removeButton = (
    <button
      type="button"
      onClick={() => onRemove(key)}
      aria-label={`Remove ${product?.name ?? "this item"}${selection ? ` (${selection})` : ""} from cart`}
      className="text-xs font-semibold text-[var(--text-secondary)] underline-offset-4 hover:text-[var(--color-action-red)] hover:underline"
    >
      Remove
    </button>
  );

  if (!product) {
    return (
      <div className="flex items-center justify-between gap-3 py-4">
        <p className="text-sm text-[var(--text-secondary)]">This product is no longer available.</p>
        {removeButton}
      </div>
    );
  }

  const href = `/products/${product.slug}`;
  return (
    <article className="flex gap-3 py-4 md:gap-4">
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden="true"
        className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[var(--surface-card)] md:h-24 md:w-24"
      >
        <Image src={product.image} alt="" fill sizes="6rem" className="object-contain p-2" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
            {product.categoryName}
          </p>
          <Link
            href={href}
            className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug hover:text-[var(--color-action-red)]"
          >
            {product.name}
          </Link>
          {selection ? <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{selection}</p> : null}
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            {formatSamplePrice(product.price)} each
          </p>
          {!product.inStock ? (
            <p className="mt-1 text-xs font-medium text-[var(--color-action-red)]">
              Out of stock: not counted in the subtotal.
            </p>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
          <div
            role="group"
            aria-label={`Quantity of ${product.name}`}
            className="inline-flex h-10 items-center rounded-full border border-[var(--color-light-grey)] p-0.5"
          >
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => onQuantity(key, line.quantity - 1)}
              disabled={line.quantity <= 1}
              className={STEP}
            >
              −
            </button>
            <span aria-live="polite" className="w-8 text-center text-sm font-semibold tabular-nums">
              {line.quantity}
            </span>
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => onQuantity(key, line.quantity + 1)}
              disabled={line.quantity >= MAX_LINE_QUANTITY}
              className={STEP}
            >
              +
            </button>
          </div>
          <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-1">
            <p className="whitespace-nowrap text-sm font-bold tabular-nums">
              {formatSamplePrice(product.price * line.quantity)}
            </p>
            {removeButton}
          </div>
        </div>
      </div>
    </article>
  );
}
