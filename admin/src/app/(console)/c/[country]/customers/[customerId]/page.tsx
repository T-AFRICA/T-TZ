import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@tronic/permissions";
import { Cell, DataTable, EmptyRow, Notice, PageHeader, Panel, StatCard, StatusPill, buttonClass } from "@/components/ui";
import { SERVICE_UNAVAILABLE_TEXT, formatDateTime } from "@/features/labels";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, formatMinor, isOrderStatus, paymentMethodLabel, paymentStatusLabel } from "@/features/orders/labels";
import { countryApiFor } from "@/server/country-api";
import { requireCountry } from "@/server/session";

export const metadata: Metadata = { title: "Customer" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One customer account: contact details from their profile and every order they placed in the country. Read only. */
export default async function CustomerPage({ params }: { params: Promise<{ country: string; customerId: string }> }) {
  const { country: countryId, customerId } = await params;
  const { admin, country } = await requireCountry(countryId, "customers.read");
  if (!UUID.test(customerId)) notFound();
  const api = await countryApiFor(admin, country);
  const result = await api.getCustomer(admin.actor.userId, customerId.toLowerCase());
  const back = `/c/${country.id}/customers`;
  if (!result.available) {
    return (
      <>
        <PageHeader eyebrow={`${country.name} · Customers`} title="Customer" />
        <Notice tone="warn" title="This customer cannot be shown right now">
          {SERVICE_UNAVAILABLE_TEXT[result.reason]}
        </Notice>
      </>
    );
  }
  if (!result.data.ok) notFound();
  const customer = result.data.customer;
  const amount = (minor: number) => formatMinor(minor, customer.currency, customer.currencyExponent);
  const paid = customer.orders.filter((order) => order.paymentStatus === "paid").reduce((sum, order) => sum + order.totalMinor, 0);
  const open = customer.orders.filter((order) => order.status !== "delivered" && order.status !== "cancelled").length;
  const seesOrders = can(admin.actor, "orders.read", country.id);

  return (
    <>
      <PageHeader
        eyebrow={`${country.name} · Customers`}
        title={customer.name ?? customer.email ?? "Unnamed account"}
        description={`Account since ${formatDateTime(customer.createdAt)}`}
        actions={
          <Link href={back} className={buttonClass.secondary}>
            All customers
          </Link>
        }
      />

      <Panel title="Contact">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Email</dt>
            <dd className="mt-1 text-sm text-ink [overflow-wrap:anywhere]">
              {customer.email ?? "–"} {customer.emailConfirmed ? null : <StatusPill tone="warn">Not confirmed</StatusPill>}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Phone</dt>
            <dd className="mt-1 text-sm text-ink">{customer.phone ?? "Not given"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Name</dt>
            <dd className="mt-1 text-sm text-ink">{customer.name ?? "Not given"}</dd>
          </div>
        </dl>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Orders" value={customer.orders.length} hint={`${open} still open`} />
        <StatCard label="Paid" value={amount(paid)} hint="Total of their paid orders" />
        <StatCard label="Last order" value={customer.orders[0] ? formatDateTime(customer.orders[0].createdAt) : "None yet"} />
      </div>

      <Panel title="Orders" flush>
        {customer.orders.length === 0 ? (
          <EmptyRow title="No orders from this account yet" />
        ) : (
          <DataTable caption="Customer's orders" head={["Order", "Placed", "Status", "Payment", "Items", "Total"]}>
            {customer.orders.map((order) => (
              <tr key={order.orderNumber}>
                <Cell>
                  {seesOrders ? (
                    <Link href={`/c/${country.id}/orders/${order.orderNumber}`} className="font-medium text-ink underline-offset-4 hover:underline">
                      {order.orderNumber}
                    </Link>
                  ) : (
                    <span className="font-medium text-ink">{order.orderNumber}</span>
                  )}
                </Cell>
                <Cell className="whitespace-nowrap text-muted">{formatDateTime(order.createdAt)}</Cell>
                <Cell>{isOrderStatus(order.status) ? <StatusPill tone={ORDER_STATUS_TONE[order.status]}>{ORDER_STATUS_LABEL[order.status]}</StatusPill> : order.status}</Cell>
                <Cell className="text-muted">
                  {paymentMethodLabel(order.paymentMethod)} · {paymentStatusLabel(order.paymentStatus)}
                </Cell>
                <Cell className="tabular-nums">{order.itemCount}</Cell>
                <Cell className="whitespace-nowrap font-medium tabular-nums text-ink">{amount(order.totalMinor)}</Cell>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </>
  );
}
