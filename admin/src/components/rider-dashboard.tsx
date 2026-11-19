import Link from "next/link";
import type { AdminCountry } from "@tronic/database/admin";
import { SERVICE_UNAVAILABLE_TEXT } from "@/features/labels";
import { formatMinor } from "@/features/orders/labels";
import { countryApiFor } from "@/server/country-api";
import type { AdminContext } from "@/server/session";
import { RiderDeliveryCards } from "./delivery-list";
import { Notice, PageHeader, Panel, StatCard, buttonClass } from "./ui";

/**
 * A rider's country dashboard: their own deliveries counted from the
 * country (never estimated), what is next, and the cash they should be
 * carrying back. The country decides which deliveries are theirs.
 */
export async function RiderDashboard({ admin, country }: { admin: AdminContext; country: AdminCountry }) {
  const api = await countryApiFor(admin, country);
  const result = await api.listMyDeliveries(admin.actor.userId);
  const header = (
    <PageHeader
      eyebrow={`${country.name} · Rider`}
      title={admin.fullName ? `Hello, ${admin.fullName.split(" ")[0]}` : "Your deliveries today"}
      description="Your deliveries, counted from the orders given to you."
      actions={
        <Link href={`/c/${country.id}/deliveries`} className={buttonClass.primary}>
          Open my deliveries
        </Link>
      }
    />
  );

  if (!result.available) {
    return (
      <>
        {header}
        <Notice tone="warn" title="Your deliveries cannot be shown right now">
          {SERVICE_UNAVAILABLE_TEXT[result.reason]}
        </Notice>
      </>
    );
  }

  const deliveries = result.data.deliveries;
  const ready = deliveries.filter((delivery) => delivery.status === "packed");
  const onTheWay = deliveries.filter((delivery) => delivery.status === "dispatched" || delivery.status === "in_transit");
  const preparing = deliveries.filter((delivery) => delivery.status === "confirmed" || delivery.status === "processing");
  const delivered = deliveries.filter((delivery) => delivery.status === "delivered");
  const toCollect = [...ready, ...onTheWay, ...preparing].filter((delivery) => delivery.paymentMethod === "pay_on_delivery" && delivery.paymentStatus === "pending");
  // Amounts of one country share its currency; the first delivery names it.
  const sample = toCollect[0];
  const cash = sample ? formatMinor(toCollect.reduce((sum, delivery) => sum + delivery.totalMinor, 0), sample.currency, sample.currencyExponent) : "Nothing";
  // On the way first, then ready to pick up, then still being prepared.
  const next = [...onTheWay, ...ready, ...preparing];
  const base = `/c/${country.id}/deliveries`;

  return (
    <>
      {header}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="On the way" value={onTheWay.length} hint="Picked up, not delivered yet" href={base} />
        <StatCard label="Ready to pick up" value={ready.length} hint="Packed and waiting for you" href={base} />
        <StatCard label="Delivered" value={delivered.length} hint="In the last 24 hours" href={base} />
        <StatCard label="Cash to collect" value={cash} hint={`From ${toCollect.length} Cash on Delivery ${toCollect.length === 1 ? "order" : "orders"}`} href={base} />
      </div>

      <Panel title="Next deliveries" description={preparing.length > 0 ? `${preparing.length} more being prepared; they become ready once packed.` : undefined}>
        {next.length === 0 ? (
          <p className="text-sm text-muted">Nothing to deliver right now. When an order manager gives you an order, it appears here.</p>
        ) : (
          <RiderDeliveryCards countryId={country.id} deliveries={next.slice(0, 5)} label="Next deliveries" />
        )}
        {next.length > 5 ? (
          <p className="mt-4">
            <Link href={base} className="text-sm font-semibold text-accent-ink underline-offset-4 hover:underline">
              See all {next.length} deliveries
            </Link>
          </p>
        ) : null}
      </Panel>
    </>
  );
}
