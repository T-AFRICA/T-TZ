import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/components/home/sampleProducts";
import { selectionLabel } from "@/features/cart/purchase";
import type { CheckoutQuote, LineIssue } from "@/features/checkout/quote";

const ISSUE_TEXT: Record<LineIssue, string> = {
  unavailable: "No longer available",
  out_of_stock: "Out of stock: left out of the total",
  invalid_options: "Options no longer match this product: left out of the total",
};

/**
 * Order summary on the checkout page: the server-priced lines (thumbnail
 * with quantity, name, SKU, options, unit and line price) and the totals.
 * Delivery and VAT show "Confirmed before payment" until TRONIC sets them;
 * the total says so instead of pretending to be final.
 */
export function CheckoutSummary({ quote }: { quote: CheckoutQuote }) {
  const blocked = quote.lines.filter((line) => line.issue !== null).length + quote.missing;
  return (
    <div>
      {blocked > 0 ? (
        <p role="alert" className="mb-3 rounded-lg bg-[#fdecec] px-3 py-2 text-xs font-medium text-[var(--color-action-red)]">
          {blocked === 1 ? "1 item can't be bought right now" : `${blocked} items can't be bought right now`} and{" "}
          {blocked === 1 ? "is" : "are"} left out of the total.{" "}
          <Link href="/cart" className="underline underline-offset-2">
            Review cart
          </Link>
        </p>
      ) : null}
      <ul className="divide-y divide-[var(--color-light-grey)]">
        {quote.lines.map((line) => {
          const selection = selectionLabel(line.color, line.variant);
          return (
            <li key={line.key} className={`flex gap-3 py-3 first:pt-0 ${line.issue ? "opacity-60" : ""}`}>
              <span className="relative h-16 w-16 shrink-0 rounded-lg border border-[var(--color-light-grey)] bg-white">
                <Image src={line.image} alt="" fill sizes="4rem" className="object-contain p-1.5" />
                <span
                  aria-hidden="true"
                  className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--color-premium-black)] px-1 text-[10px] font-bold text-white"
                >
                  {line.quantity}
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/products/${line.slug}`}
                  className="line-clamp-2 text-sm font-semibold leading-snug hover:text-[var(--color-action-red)]"
                >
                  {line.name}
                </Link>
                <p className="mt-0.5 text-[11px] uppercase tracking-wide text-[var(--text-muted)]">SKU {line.sku}</p>
                {selection ? <p className="text-xs text-[var(--text-secondary)]">{selection}</p> : null}
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  <span className="sr-only">Quantity {line.quantity}, </span>
                  {line.quantity} × {formatPrice(line.unitPriceMinor)}
                  {line.wasPriceMinor !== null ? (
                    <span className="ml-1.5 text-[var(--text-muted)] line-through">{formatPrice(line.wasPriceMinor)}</span>
                  ) : null}
                </p>
                {line.issue ? (
                  <p className="mt-0.5 text-xs font-medium text-[var(--color-action-red)]">{ISSUE_TEXT[line.issue]}</p>
                ) : null}
              </div>
              <p className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums">
                {formatPrice(line.lineTotalMinor)}
              </p>
            </li>
          );
        })}
      </ul>
      {quote.missing > 0 ? (
        <p className="mt-2 text-xs text-[var(--text-secondary)]">
          {quote.missing === 1 ? "1 product is" : `${quote.missing} products are`} no longer available and not shown.
        </p>
      ) : null}

      <dl className="mt-4 space-y-2 border-t border-[var(--color-light-grey)] pt-4 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--text-secondary)]">
            Subtotal ({quote.itemCount} {quote.itemCount === 1 ? "item" : "items"})
          </dt>
          <dd className="font-medium tabular-nums">{formatPrice(quote.subtotalMinor)}</dd>
        </div>
        {quote.savingsMinor > 0 ? (
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--text-secondary)]">Discount (included)</dt>
            <dd className="font-medium tabular-nums text-[var(--color-success)]">−{formatPrice(quote.savingsMinor)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--text-secondary)]">Delivery</dt>
          <dd className="text-right text-[var(--text-secondary)]">
            {quote.deliveryFeeMinor === null ? "Confirmed before payment" : formatPrice(quote.deliveryFeeMinor)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--text-secondary)]">VAT</dt>
          <dd className="text-right text-[var(--text-secondary)]">Confirmed before payment</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-t border-[var(--color-light-grey)] pt-3">
          <dt className="font-semibold">{quote.totalIsPartial ? "Total so far" : "Total"}</dt>
          <dd className="text-xl font-bold tabular-nums text-[var(--color-action-red)]">
            {formatPrice(quote.totalMinor)}
          </dd>
        </div>
      </dl>
      <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-muted)]">
        Prices are checked on our server.
        {quote.totalIsPartial ? " Delivery and any VAT are added before you pay." : null}
      </p>
    </div>
  );
}
