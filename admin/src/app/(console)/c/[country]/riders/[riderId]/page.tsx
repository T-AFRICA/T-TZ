import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listRiders } from "@tronic/database/admin";
import { can } from "@tronic/permissions";
import { RiderContactForm } from "@/components/deliveries";
import { Cell, DataTable, EmptyRow, Notice, PageHeader, Panel, StatCard, StatusPill, buttonClass } from "@/components/ui";
import { FAILURE_REASON_LABEL } from "@/features/deliveries/labels";
import { SERVICE_UNAVAILABLE_TEXT, formatDateTime } from "@/features/labels";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, formatMinor, paymentMethodLabel } from "@/features/orders/labels";
import { countryApiFor } from "@/server/country-api";
import { getAdminDb } from "@/server/db";
import { requireCountry } from "@/server/session";

export const metadata: Metadata = { title: "Rider" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One rider of the country: their figures, the orders with them, their recent deliveries and failed attempts. */
export default async function RiderPage({ params }: { params: Promise<{ country: string; riderId: string }> }) {
  const { country: countryId, riderId } = await params;
  const { admin, country } = await requireCountry(countryId, "deliveries.assign");
  if (!UUID.test(riderId)) notFound();
  const riders = await listRiders(getAdminDb(), admin.access, country.id);
  const rider = riders.find((candidate) => candidate.userId === riderId.toLowerCase());
  if (!rider) notFound();

  const api = await countryApiFor(admin, country);
  const [figures, history] = await Promise.all([api.riderFigures(admin.actor.userId), api.riderDeliveries(admin.actor.userId, rider.userId)]);
  const back = `/c/${country.id}/riders`;
  const seesOrders = can(admin.actor, "orders.read", country.id);

  const header = (
    <PageHeader
      eyebrow={`${country.name} · Riders`}
      title={rider.name ?? rider.email}
      description={rider.name ? rider.email : "Rider"}
      actions={
        <Link href={back} className={buttonClass.secondary}>
          All riders
        </Link>
      }
    />
  );
  if (!figures.available || !history.available) {
    const reason = !figures.available ? figures.reason : !history.available ? history.reason : "server_error";
    return (
      <>
        {header}
        <Notice tone="warn" title="This rider's deliveries cannot be shown right now">
          {SERVICE_UNAVAILABLE_TEXT[reason]}
        </Notice>
      </>
    );
  }

  const f = figures.data.riders[rider.userId];
  const amount = (minor: number) => formatMinor(minor, history.data.currency, history.data.currencyExponent);
  const open = history.data.deliveries.filter((delivery) => delivery.status !== "delivered" && delivery.status !== "cancelled");
  const done = history.data.deliveries.filter((delivery) => delivery.status === "delivered" || delivery.status === "cancelled");
  const orderCell = (orderNumber: string) =>
    seesOrders ? (
      <Link href={`/c/${country.id}/orders/${orderNumber}`} className="font-medium text-ink underline-offset-4 hover:underline">
        {orderNumber}
      </Link>
    ) : (
      <span className="font-medium text-ink">{orderNumber}</span>
    );

  return (
    <>
      {header}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="With them now" value={f?.open ?? 0} hint={`${f?.onTheWay ?? 0} on the way`} />
        <StatCard label="Delivered today" value={f?.deliveredToday ?? 0} hint={`${f?.delivered7Days ?? 0} in 7 days · ${f?.delivered30Days ?? 0} in 30 days`} />
        <StatCard label="Cash collected today" value={amount(f?.cashTodayMinor ?? 0)} hint="Cash on Delivery, confirmed at the door" />
        <StatCard label="Failed attempts" value={f?.failed7Days ?? 0} hint="In the last 7 days" />
      </div>

      <Panel title="Name and phone" description="What the customer sees while this rider brings their order.">
        <RiderContactForm countryId={country.id} riderId={rider.userId} name={rider.name} phone={rider.phone} />
      </Panel>

      <Panel title="With them now" flush>
        {open.length === 0 ? (
          <EmptyRow title="No orders with this rider" description="Give one from an order's Delivery panel." />
        ) : (
          <DataTable caption="Orders with this rider" head={["Order", "Customer", "Area", "Status", "To collect", "Given"]}>
            {open.map((delivery) => (
              <tr key={delivery.orderNumber}>
                <Cell>{orderCell(delivery.orderNumber)}</Cell>
                <Cell>{delivery.contactName}</Cell>
                <Cell className="text-muted">{[delivery.district, delivery.region].filter(Boolean).join(", ")}</Cell>
                <Cell>
                  <StatusPill tone={ORDER_STATUS_TONE[delivery.status]}>{ORDER_STATUS_LABEL[delivery.status]}</StatusPill>
                </Cell>
                <Cell className="whitespace-nowrap tabular-nums">{delivery.paymentMethod === "pay_on_delivery" ? amount(delivery.totalMinor) : "Paid"}</Cell>
                <Cell className="whitespace-nowrap text-muted">{formatDateTime(delivery.assignedAt)}</Cell>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>

      <Panel title="Recent deliveries" description="The last 50 orders given to this rider." flush>
        {done.length === 0 ? (
          <EmptyRow title="Nothing delivered yet" />
        ) : (
          <DataTable caption="Recent deliveries" head={["Order", "Customer", "Status", "Payment", "Cash collected", "Delivered"]}>
            {done.map((delivery) => (
              <tr key={delivery.orderNumber}>
                <Cell>{orderCell(delivery.orderNumber)}</Cell>
                <Cell>{delivery.contactName}</Cell>
                <Cell>
                  <StatusPill tone={ORDER_STATUS_TONE[delivery.status]}>{ORDER_STATUS_LABEL[delivery.status]}</StatusPill>
                </Cell>
                <Cell className="text-muted">{paymentMethodLabel(delivery.paymentMethod)}</Cell>
                <Cell className="whitespace-nowrap tabular-nums">{delivery.cashCollectedMinor === null ? "–" : amount(delivery.cashCollectedMinor)}</Cell>
                <Cell className="whitespace-nowrap text-muted">{delivery.deliveredAt ? formatDateTime(delivery.deliveredAt) : "–"}</Cell>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>

      <Panel title="Failed attempts" description="The last 30 days." flush>
        {history.data.attempts.length === 0 ? (
          <EmptyRow title="No failed attempts" />
        ) : (
          <DataTable caption="Failed attempts" head={["Order", "What happened", "Note", "When"]}>
            {history.data.attempts.map((attempt, index) => (
              <tr key={index}>
                <Cell>{orderCell(attempt.orderNumber)}</Cell>
                <Cell>{FAILURE_REASON_LABEL[attempt.reason]}</Cell>
                <Cell className="text-muted [overflow-wrap:anywhere]">{attempt.note ?? "–"}</Cell>
                <Cell className="whitespace-nowrap text-muted">{formatDateTime(attempt.createdAt)}</Cell>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </>
  );
}
