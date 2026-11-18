import type { Metadata } from "next";
import Link from "next/link";
import { Notice, PageHeader, StatusPill } from "@/components/ui";
import { SERVICE_UNAVAILABLE_TEXT, formatDateTime } from "@/features/labels";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, formatMinor } from "@/features/orders/labels";
import { countryApiFor } from "@/server/country-api";
import { requireCountry } from "@/server/session";

export const metadata: Metadata = { title: "My deliveries" };

/** The rider's own deliveries, phone first: what is still to do, then what was delivered today. */
export default async function DeliveriesPage({ params }: { params: Promise<{ country: string }> }) {
  const { country: countryId } = await params;
  const { admin, country } = await requireCountry(countryId, "deliveries.perform");
  const api = await countryApiFor(admin, country);
  const result = await api.listMyDeliveries(admin.actor.userId);

  if (!result.available) {
    return (
      <>
        <PageHeader eyebrow={country.name} title="My deliveries" />
        <Notice tone="warn" title="Your deliveries cannot be shown right now">
          {SERVICE_UNAVAILABLE_TEXT[result.reason]}
        </Notice>
      </>
    );
  }

  const deliveries = result.data.deliveries;
  const open = deliveries.filter((delivery) => delivery.status !== "delivered");
  const done = deliveries.filter((delivery) => delivery.status === "delivered");

  return (
    <>
      <PageHeader eyebrow={country.name} title="My deliveries" description={open.length === 0 ? "Nothing to deliver right now." : `${open.length} to deliver.`} />
      {open.length === 0 ? (
        <Notice tone="info">When an order manager gives you an order, it appears here.</Notice>
      ) : (
        <ul aria-label="Deliveries to make" className="flex flex-col gap-3">
          {open.map((delivery) => {
            const cod = delivery.paymentMethod === "pay_on_delivery" && delivery.paymentStatus === "pending";
            return (
              <li key={delivery.orderNumber}>
                <Link
                  href={`/c/${country.id}/deliveries/${delivery.orderNumber}`}
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
      )}
      {done.length > 0 ? (
        <section aria-labelledby="delivered-today" className="flex flex-col gap-2">
          <h2 id="delivered-today" className="text-sm font-semibold uppercase tracking-wide text-muted">
            Delivered in the last 24 hours
          </h2>
          <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface">
            {done.map((delivery) => (
              <li key={delivery.orderNumber} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="text-ink">{delivery.contactName}</span>
                <span className="text-muted">
                  {delivery.orderNumber} · given {formatDateTime(delivery.assignedAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
