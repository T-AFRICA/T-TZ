import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Info } from "lucide-react";
import { OrderTimeline } from "@/components/account/OrderTimeline";
import { ButtonLink, Field, Panel, PortalPage, StatusBadge, formatDate, money } from "@/components/account/ui";
import { createAccountService } from "@/features/account/service";
import { requireCustomer } from "@/features/account/session";
import {
  DELIVERY_METHOD_LABELS,
  ORDER_NUMBER_PATTERN,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  orderStatusTone,
  paymentStatusTone,
} from "@/features/orders/status";

export const metadata: Metadata = { title: "Track order" };

/**
 * /account/orders/[orderNumber]/tracking — the order's timeline. It shows
 * the status the order record has now; it is not live courier tracking and
 * says so. Courier, tracking number, dispatch date and delivery estimate
 * are listed as "not available" until a delivery service records them.
 */
export default async function OrderTrackingPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const user = await requireCustomer();
  const { orderNumber } = await params;
  if (!ORDER_NUMBER_PATTERN.test(orderNumber)) notFound();
  const service = createAccountService(user);
  const result = await service.getOrder(orderNumber);
  if (result.status !== "ok" || result.data === null) notFound();
  const order = result.data;
  const tracking = service.getTracking(order);
  const addressLines = [order.delivery.street, order.delivery.extra, order.delivery.ward, order.delivery.district, order.delivery.region].filter(
    (line): line is string => Boolean(line),
  );
  const base = `/account/orders/${order.orderNumber}`;

  return (
    <PortalPage>
      <div>
        <Link href={base} className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--color-action-red)]">
          <ChevronLeft size={16} aria-hidden="true" />
          Order details
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-action-red)]">Order tracking</p>
            <h1 className="mt-1 text-[1.5rem] font-bold leading-tight tabular-nums md:text-[1.85rem]">{order.orderNumber}</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Placed {formatDate(order.createdAt)} · {order.itemCount} {order.itemCount === 1 ? "item" : "items"} ·{" "}
              <span className="tabular-nums">{money(order.totalMinor, order.currency)}</span>
            </p>
          </div>
          <StatusBadge tone={orderStatusTone(order.status)}>{tracking.currentTitle}</StatusBadge>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_21rem] xl:gap-5">
        <Panel title="Progress" labelledBy="tracking-progress">
          <OrderTimeline tracking={tracking} />
          <p className="mt-5 flex items-start gap-2 rounded-xl bg-[#f6f6f7] px-3.5 py-3 text-xs text-[var(--text-secondary)]">
            <Info size={15} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span>
              This shows the status recorded for your order. It updates when our team moves the order to its next step; it is not live
              courier tracking.
            </span>
          </p>
        </Panel>

        <div className="min-w-0 space-y-4 md:space-y-5">
          <Panel title="Delivery" labelledBy="tracking-delivery">
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
              <Field label="Courier and tracking number">
                <span className="font-normal text-[var(--text-secondary)]">Not available yet</span>
              </Field>
              <Field label="Estimated delivery">
                <span className="font-normal text-[var(--text-secondary)]">Not available yet</span>
              </Field>
            </dl>
          </Panel>

          <Panel title="Payment" labelledBy="tracking-payment">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">{PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}</p>
              <StatusBadge tone={paymentStatusTone(order.paymentStatus)}>
                {PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}
              </StatusBadge>
            </div>
          </Panel>

          <div className="flex flex-col gap-2">
            <ButtonLink href={base}>View order details</ButtonLink>
            <ButtonLink href="/account/support" variant="outline">
              Contact support
            </ButtonLink>
          </div>
        </div>
      </div>
    </PortalPage>
  );
}
