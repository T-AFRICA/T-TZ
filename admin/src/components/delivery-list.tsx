import Link from "next/link";
import type { RiderDeliverySummary } from "@tronic/api-contracts";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, formatMinor } from "@/features/orders/labels";
import { StatusPill } from "./ui";

/** A rider's deliveries still to make, as tappable cards (phone first). */
export function RiderDeliveryCards({ countryId, deliveries, label }: { countryId: string; deliveries: readonly RiderDeliverySummary[]; label: string }) {
  return (
    <ul aria-label={label} className="flex flex-col gap-3">
      {deliveries.map((delivery) => {
        const cod = delivery.paymentMethod === "pay_on_delivery" && delivery.paymentStatus === "pending";
        return (
          <li key={delivery.orderNumber}>
            <Link
              href={`/c/${countryId}/deliveries/${delivery.orderNumber}`}
              className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-line-strong focus-visible:outline-2 focus-visible:outline-accent"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="font-semibold text-ink">{delivery.contactName}</span>
                <StatusPill tone={ORDER_STATUS_TONE[delivery.status]}>{ORDER_STATUS_LABEL[delivery.status]}</StatusPill>
              </span>
              <span className="text-sm text-muted [overflow-wrap:anywhere]">
                {[delivery.street, delivery.ward, delivery.district, delivery.region].filter(Boolean).join(", ")}
              </span>
              <span className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-muted">
                  {delivery.orderNumber} · {delivery.itemCount} {delivery.itemCount === 1 ? "item" : "items"}
                </span>
                {cod ? (
                  <span className="font-semibold tabular-nums text-ink">Collect {formatMinor(delivery.totalMinor, delivery.currency, delivery.currencyExponent)}</span>
                ) : (
                  <span className="text-muted">Already paid</span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
