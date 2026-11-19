import type { Metadata } from "next";
import { RiderDeliveryCards } from "@/components/delivery-list";
import { Notice, PageHeader } from "@/components/ui";
import { SERVICE_UNAVAILABLE_TEXT, formatDateTime } from "@/features/labels";
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
        <RiderDeliveryCards countryId={country.id} deliveries={open} label="Deliveries to make" />
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
