import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ORDER_NUMBER_PATTERN } from "@tronic/api-contracts";
import { listAdministrators } from "@tronic/database/admin";
import { can } from "@tronic/permissions";
import { OrderNoteForm } from "@/components/console-forms";
import { ConfirmAction } from "@/components/forms";
import { Cell, DataTable, Notice, PageHeader, Panel, StatusPill, buttonClass } from "@/components/ui";
import { SERVICE_UNAVAILABLE_TEXT, formatDateTime } from "@/features/labels";
import { updateOrderStatusAction } from "@/features/orders/actions";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  ORDER_STEP_LABEL,
  deliveryMethodLabel,
  formatMinor,
  paymentMethodLabel,
  paymentStatusLabel,
} from "@/features/orders/labels";
import { countryApiFor } from "@/server/country-api";
import { getAdminDb } from "@/server/db";
import { requireCountry } from "@/server/session";

export const metadata: Metadata = { title: "Order" };

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-sm text-ink [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

export default async function OrderPage({ params }: { params: Promise<{ country: string; orderNumber: string }> }) {
  const { country: countryId, orderNumber: raw } = await params;
  const { admin, country } = await requireCountry(countryId, "orders.read");
  const orderNumber = decodeURIComponent(raw).toUpperCase();
  if (!ORDER_NUMBER_PATTERN.test(orderNumber)) notFound();

  const api = await countryApiFor(admin, country);
  const result = await api.getOrder(admin.actor.userId, orderNumber);
  const back = `/c/${country.id}/orders`;

  if (!result.available) {
    return (
      <>
        <PageHeader eyebrow={country.name} title={`Order ${orderNumber}`} />
        <Notice tone="warn" title="This order cannot be shown right now">
          {SERVICE_UNAVAILABLE_TEXT[result.reason]}
        </Notice>
        <div>
          <Link href={back} className={buttonClass.secondary}>
            Back to orders
          </Link>
        </div>
      </>
    );
  }
  if (!result.data.ok) notFound();
  const order = result.data.order;
  const mayChange = can(admin.actor, "orders.update", country.id);
  const amount = (minor: number) => formatMinor(minor, order.currency, order.currencyExponent);

  // Names for the administrators in the history, as far as this viewer may see them.
  const people = await listAdministrators(getAdminDb(), admin.access, { countryId: country.id });
  const who = (actorId: string) => (actorId === admin.actor.userId ? "You" : (people.find((person) => person.userId === actorId)?.email ?? "Another administrator"));
  const address = [order.delivery.street, order.delivery.extra, order.delivery.ward, order.delivery.district, order.delivery.region].filter(Boolean).join(", ");

  return (
    <>
      <PageHeader
        eyebrow={`${country.name} · Orders`}
        title={`Order ${order.orderNumber}`}
        description={`Placed ${formatDateTime(order.createdAt)} · ${order.registeredCustomer ? "customer account" : "guest checkout"}`}
        actions={
          <>
            <StatusPill tone={ORDER_STATUS_TONE[order.status]}>{ORDER_STATUS_LABEL[order.status]}</StatusPill>
            <Link href={back} className={buttonClass.secondary}>
              Back to orders
            </Link>
          </>
        }
      />

      <Panel
        title="Next step"
        description={
          order.nextStatuses.length === 0
            ? "This order is finished. Its status can no longer change."
            : "An order moves one step at a time. It can be cancelled until it is dispatched."
        }
      >
        {order.nextStatuses.length === 0 ? (
          <p className="text-sm text-muted">Nothing to do.</p>
        ) : mayChange ? (
          <div className="flex flex-wrap gap-2">
            {order.nextStatuses.map((next) => (
              <ConfirmAction
                key={next}
                action={updateOrderStatusAction}
                fields={{ countryId: country.id, orderNumber: order.orderNumber, status: next }}
                label={ORDER_STEP_LABEL[next]}
                title={next === "cancelled" ? `Cancel order ${order.orderNumber}?` : `${ORDER_STEP_LABEL[next]}?`}
                description={
                  next === "cancelled"
                    ? "The order stops here and its stock becomes available again. This cannot be undone."
                    : `Order ${order.orderNumber} moves from "${ORDER_STATUS_LABEL[order.status]}" to "${ORDER_STATUS_LABEL[next]}". The customer sees the new status. This cannot be undone.`
                }
                confirmLabel={ORDER_STEP_LABEL[next]}
                variant={next === "cancelled" ? "danger" : "primary"}
                reasonField={{ name: "note", label: next === "cancelled" ? "Reason (optional, internal)" : "Note (optional, internal)" }}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Your role can see orders but not change them.</p>
        )}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Customer">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Fact label="Name">{order.contact.name}</Fact>
            <Fact label="Phone">{order.contact.phone}</Fact>
            <div className="sm:col-span-2">
              <Fact label="Email">{order.contact.email}</Fact>
            </div>
          </dl>
        </Panel>
        <Panel title="Delivery and payment">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Fact label="Delivery">{deliveryMethodLabel(order.delivery.method)}</Fact>
            <Fact label="Payment">
              {paymentMethodLabel(order.paymentMethod)} · {paymentStatusLabel(order.paymentStatus)}
            </Fact>
            <div className="sm:col-span-2">
              <Fact label="Address">{address || "Not given"}</Fact>
            </div>
            {order.delivery.notes ? (
              <div className="sm:col-span-2">
                <Fact label="Customer's delivery note">{order.delivery.notes}</Fact>
              </div>
            ) : null}
          </dl>
        </Panel>
      </div>

      <Panel title="Items" flush>
        <DataTable caption="Order items" head={["Product", "SKU", "Quantity", "Unit price", "Line total"]}>
          {order.lines.map((line) => (
            <tr key={line.lineNo}>
              <Cell>
                <p className="font-medium text-ink">{line.name}</p>
                {line.color || line.variant ? <p className="text-xs text-muted">{[line.color, line.variant].filter(Boolean).join(" · ")}</p> : null}
              </Cell>
              <Cell className="whitespace-nowrap text-muted">{line.sku}</Cell>
              <Cell className="tabular-nums">{line.quantity}</Cell>
              <Cell className="whitespace-nowrap tabular-nums text-muted">{amount(line.unitPriceMinor)}</Cell>
              <Cell className="whitespace-nowrap font-medium tabular-nums text-ink">{amount(line.lineTotalMinor)}</Cell>
            </tr>
          ))}
        </DataTable>
        <dl className="flex flex-col items-end gap-1.5 border-t border-line px-5 py-4 text-sm">
          <div className="flex gap-6">
            <dt className="text-muted">Subtotal</dt>
            <dd className="tabular-nums text-ink">{amount(order.subtotalMinor)}</dd>
          </div>
          <div className="flex gap-6">
            <dt className="text-muted">Delivery fee</dt>
            <dd className="tabular-nums text-ink">{order.deliveryFeeMinor === null ? "Not set" : amount(order.deliveryFeeMinor)}</dd>
          </div>
          <div className="flex gap-6 text-base font-semibold">
            <dt className="text-ink">Total</dt>
            <dd className="tabular-nums text-ink">{amount(order.totalMinor)}</dd>
          </div>
        </dl>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="History" description="Every status change, with who made it.">
          <ol aria-label="Order history" className="flex flex-col gap-4">
            <li className="border-l-2 border-line pl-4">
              <p className="text-sm font-medium text-ink">Order placed</p>
              <p className="text-xs text-muted">{formatDateTime(order.createdAt)} · by the customer</p>
            </li>
            {order.events.map((event, index) => (
              <li key={index} className="border-l-2 border-line pl-4">
                <p className="text-sm font-medium text-ink">
                  {ORDER_STATUS_LABEL[event.fromStatus]} → {ORDER_STATUS_LABEL[event.toStatus]}
                </p>
                <p className="text-xs text-muted">
                  {formatDateTime(event.createdAt)} · {who(event.actorId)}
                </p>
                {event.note ? <p className="mt-1 text-sm text-ink [overflow-wrap:anywhere]">{event.note}</p> : null}
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title="Internal notes" description="For administrators only. The customer never sees these.">
          <div className="flex flex-col gap-5">
            {order.notes.length === 0 ? (
              <p className="text-sm text-muted">No notes yet.</p>
            ) : (
              <ul aria-label="Internal notes" className="flex flex-col gap-3">
                {order.notes.map((note, index) => (
                  <li key={index} className="rounded-lg border border-line bg-raised px-4 py-3">
                    <p className="whitespace-pre-wrap text-sm text-ink [overflow-wrap:anywhere]">{note.body}</p>
                    <p className="mt-1.5 text-xs text-muted">
                      {formatDateTime(note.createdAt)} · {who(note.actorId)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {mayChange ? <OrderNoteForm countryId={country.id} orderNumber={order.orderNumber} /> : null}
          </div>
        </Panel>
      </div>
    </>
  );
}
