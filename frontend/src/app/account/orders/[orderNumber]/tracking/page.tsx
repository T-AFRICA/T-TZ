import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { LineThumb } from "@/components/account/OrderCard";
import { Field, Panel, PortalPage, formatDate, money } from "@/components/account/ui";
import { DeliveryCode } from "@/components/orders/DeliveryCode";
import { LiveTracking } from "@/components/orders/LiveTracking";
import { createAccountService, loadLineImages } from "@/features/account/service";
import { requireCustomer } from "@/features/account/session";
import { DELIVERY_METHOD_LABELS, ORDER_NUMBER_PATTERN, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/features/orders/status";

export const metadata: Metadata = { title: "Track order" };

const MAX_LINES = 3;

/**
 * /account/orders/[orderNumber]/tracking — live order tracking for the
 * signed-in customer's own order: status, progress with the times from the
 * order's history, the rider (first name and phone) and the rider's position
 * on a map while the order is on its way (migration 0012). Before that
 * migration the page still shows the status and progress, and says the live
 * location is not available.
 */
export default async function OrderTrackingPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const user = await requireCustomer();
  const { orderNumber } = await params;
  if (!ORDER_NUMBER_PATTERN.test(orderNumber)) notFound();
  const service = createAccountService(user);
  const result = await service.getOrder(orderNumber);
  if (result.status !== "ok" || result.data === null) notFound();
  const order = result.data;
  const [live, deliveryCode, images] = await Promise.all([
    service.getLiveTracking(order.orderNumber),
    service.getDeliveryCode(order),
    loadLineImages([order]),
  ]);
  const addressLines = [order.delivery.street, order.delivery.extra, order.delivery.ward, order.delivery.district, order.delivery.region].filter(
    (line): line is string => Boolean(line),
  );
  const base = `/account/orders/${order.orderNumber}`;
  const shown = order.detailLines.slice(0, MAX_LINES);
  const more = order.detailLines.length - shown.length;

  return (
    <PortalPage>
      <div>
        <Link href={base} className="-my-2.5 inline-flex items-center gap-1 py-2.5 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--color-action-red)]">
          <ChevronLeft size={16} aria-hidden="true" />
          Order details
        </Link>
        <div className="mt-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-action-red)]">Track order</p>
          <h1 className="mt-1 text-[1.5rem] font-bold leading-tight tabular-nums md:text-[1.85rem]">{order.orderNumber}</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Placed {formatDate(order.createdAt, true)} · {order.itemCount} {order.itemCount === 1 ? "item" : "items"} ·{" "}
            <span className="tabular-nums">{money(order.totalMinor, order.currency)}</span>
          </p>
        </div>
      </div>

      <LiveTracking
        key={order.status}
        orderNumber={order.orderNumber}
        order={{
          status: order.status,
          paymentStatus: order.paymentStatus,
          paymentMethod: order.paymentMethod,
          deliveryMethod: order.deliveryMethod,
          createdAt: order.createdAt,
        }}
        initial={live}
        address={addressLines.length > 0 ? addressLines.join(", ") : null}
        orderHref={base}
        code={deliveryCode ? <DeliveryCode code={deliveryCode} /> : null}
        summary={
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:gap-5 xl:grid-cols-2">
            <Panel title="Order summary" labelledBy="tracking-summary">
              <ul className="divide-y divide-[var(--color-light-grey)]">
                {shown.map((line) => (
                  <li key={line.lineNo} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <LineThumb src={images.get(line.productSlug)} name={line.name} />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-semibold">{line.name}</p>
                      <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Qty {line.quantity}</p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums">{money(line.lineTotalMinor, order.currency)}</p>
                  </li>
                ))}
              </ul>
              {more > 0 ? (
                <p className="mt-2 text-xs text-[var(--text-secondary)]">
                  and {more} more {more === 1 ? "item" : "items"}
                </p>
              ) : null}
              <dl className="mt-4 space-y-2 border-t border-[var(--color-light-grey)] pt-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--text-secondary)]">Payment</dt>
                  <dd className="text-right font-medium">
                    {PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod} ·{" "}
                    {PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="font-semibold">Total</dt>
                  <dd className="text-lg font-bold tabular-nums text-[var(--color-action-red)]">{money(order.totalMinor, order.currency)}</dd>
                </div>
              </dl>
              <Link
                href={base}
                className="mt-4 hidden h-11 w-full items-center justify-center rounded-full border border-[var(--color-light-grey)] text-sm font-semibold transition-colors hover:border-[var(--color-premium-black)] lg:inline-flex"
              >
                Order details
              </Link>
            </Panel>

            <Panel title="Delivery details" labelledBy="tracking-delivery">
              <dl className="space-y-3.5">
                <Field label="Method">{DELIVERY_METHOD_LABELS[order.deliveryMethod] ?? order.deliveryMethod}</Field>
                {addressLines.length > 0 ? (
                  <Field label="Delivery address">
                    {addressLines.map((line, index) => (
                      <span key={index} className="block">
                        {line}
                      </span>
                    ))}
                  </Field>
                ) : null}
                <Field label="Recipient">
                  {order.contact.name} · {order.contact.phone}
                </Field>
                {order.delivery.notes ? <Field label="Delivery notes">{order.delivery.notes}</Field> : null}
              </dl>
              <Link href="/account/support" className="mt-4 inline-flex text-sm font-semibold text-[var(--color-action-red)] hover:underline">
                Need help with this order?
              </Link>
            </Panel>
          </div>
        }
      />
    </PortalPage>
  );
}
