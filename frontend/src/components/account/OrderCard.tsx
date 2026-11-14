import Image from "next/image";
import Link from "next/link";
import { Package } from "lucide-react";
import type { CustomerOrderSummary } from "@tronic/database";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  orderStatusTone,
  paymentStatusTone,
} from "@/features/orders/status";
import { StatusBadge, formatDate, money } from "./ui";

const MAX_THUMBS = 3;

/** Product photo of an order line; a neutral icon when the product is no longer in the catalogue. */
export function LineThumb({ src, name, size = "md" }: { src: string | undefined; name: string; size?: "md" | "lg" }) {
  const box = size === "lg" ? "h-16 w-16 md:h-20 md:w-20" : "h-14 w-14";
  return (
    <span className={`relative grid shrink-0 place-items-center overflow-hidden rounded-xl bg-[#f4f4f5] ${box}`}>
      {src ? (
        <Image src={src} alt="" fill sizes="5rem" className="object-contain p-1.5 mix-blend-multiply" />
      ) : (
        <Package size={20} aria-hidden="true" className="text-[var(--text-muted)]" />
      )}
      <span className="sr-only">{name}</span>
    </span>
  );
}

/**
 * One order in a list: number, date, product photos and names with
 * quantities, total, order and payment status, and the two actions. Every
 * value is the order record's own.
 */
export function OrderCard({ order, images }: { order: CustomerOrderSummary; images: ReadonlyMap<string, string> }) {
  const shown = order.lines.slice(0, MAX_THUMBS);
  const more = order.lines.length - shown.length;
  const href = `/account/orders/${order.orderNumber}`;
  return (
    <article className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(17,17,17,0.04)] transition-shadow hover:shadow-[0_10px_28px_-16px_rgba(17,17,17,0.3)] md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-[var(--text-secondary)]">Order</p>
          <h3 className="text-sm font-bold tabular-nums md:text-base">
            <Link href={href} className="hover:text-[var(--color-action-red)]">
              {order.orderNumber}
            </Link>
          </h3>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Placed {formatDate(order.createdAt)}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          <StatusBadge tone={orderStatusTone(order.status)}>{ORDER_STATUS_LABELS[order.status] ?? order.status}</StatusBadge>
          <StatusBadge tone={paymentStatusTone(order.paymentStatus)}>
            {PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}
          </StatusBadge>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 border-t border-[var(--color-light-grey)] pt-3">
        <div className="flex shrink-0 -space-x-2">
          {shown.map((line) => (
            <span key={`${line.productSlug}-${line.sku}`} className="rounded-xl ring-2 ring-white">
              <LineThumb src={images.get(line.productSlug)} name={line.name} />
            </span>
          ))}
        </div>
        <ul className="min-w-0 flex-1 space-y-0.5 text-sm">
          {shown.map((line) => (
            <li key={`${line.productSlug}-${line.sku}`} className="truncate">
              <span className="font-medium">{line.name}</span>
              <span className="text-[var(--text-secondary)]"> × {line.quantity}</span>
            </li>
          ))}
          {more > 0 ? <li className="text-xs text-[var(--text-secondary)]">and {more} more</li> : null}
        </ul>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          <span className="text-[var(--text-secondary)]">
            {order.itemCount} {order.itemCount === 1 ? "item" : "items"} ·{" "}
          </span>
          <span className="font-bold tabular-nums">{money(order.totalMinor, order.currency)}</span>
        </p>
        <div className="flex gap-2">
          <Link
            href={`${href}/tracking`}
            className="inline-flex h-10 items-center rounded-full border border-[var(--color-light-grey)] px-4 text-[13px] font-semibold transition-colors hover:border-[var(--color-premium-black)]"
          >
            Track order
          </Link>
          <Link
            href={href}
            className="inline-flex h-10 items-center rounded-full bg-[var(--color-action-red)] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--color-premium-black)]"
          >
            View details
          </Link>
        </div>
      </div>
    </article>
  );
}
