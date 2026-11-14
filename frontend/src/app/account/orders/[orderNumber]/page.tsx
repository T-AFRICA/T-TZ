import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FileText, LifeBuoy, Truck } from "lucide-react";
import { LineThumb } from "@/components/account/OrderCard";
import { OrderTimeline } from "@/components/account/OrderTimeline";
import { Field, Panel, PortalPage, StatusBadge, formatDate, money } from "@/components/account/ui";
import { createAccountService, loadLineImages } from "@/features/account/service";
import { requireCustomer } from "@/features/account/session";
import {
  DELIVERY_METHOD_LABELS,
  ORDER_NUMBER_PATTERN,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  orderStatusTone,
  paymentStatusTone,
} from "@/features/orders/status";

export const metadata: Metadata = { title: "Order details" };

/**
 * /account/orders/[orderNumber] — one order of the signed-in customer.
 * Another customer's order and an unknown number both give the same 404,
 * so the page never confirms that an order number exists. Actions are the
 * ones that exist today: tracking, the product pages (to buy again) and
 * support. Cancellation, returns and invoices are not offered until their
 * back-office workflows exist.
 */
export default async function OrderDetailsPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const user = await requireCustomer();
  const { orderNumber } = await params;
  if (!ORDER_NUMBER_PATTERN.test(orderNumber)) notFound();
  const service = createAccountService(user);
  const result = await service.getOrder(orderNumber);
  if (result.status !== "ok" || result.data === null) notFound();
  const order = result.data;
  const images = await loadLineImages([order]);
  const tracking = service.getTracking(order);
  const addressLines = [order.delivery.street, order.delivery.extra, order.delivery.ward, order.delivery.district, order.delivery.region].filter(
    (line): line is string => Boolean(line),
  );
  const base = `/account/orders/${order.orderNumber}`;

  return (
    <PortalPage>
      <div>
        <Link href="/account/orders" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--color-action-red)]">
          <ChevronLeft size={16} aria-hidden="true" />
          My orders
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-action-red)]">Order</p>
            <h1 className="mt-1 text-[1.5rem] font-bold leading-tight tabular-nums md:text-[1.85rem]">{order.orderNumber}</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Placed {formatDate(order.createdAt, true)}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <StatusBadge tone={orderStatusTone(order.status)}>{ORDER_STATUS_LABELS[order.status] ?? order.status}</StatusBadge>
            <StatusBadge tone={paymentStatusTone(order.paymentStatus)}>
              {PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}
            </StatusBadge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_21rem] xl:gap-5">
        <div className="min-w-0 space-y-4 md:space-y-5">
          <Panel title="Items" labelledBy="order-items">
            <ul className="divide-y divide-[var(--color-light-grey)]">
              {order.detailLines.map((line) => (
                <li key={line.lineNo} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <LineThumb src={images.get(line.productSlug)} name={line.name} size="lg" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/products/${line.productSlug}`} className="line-clamp-2 text-sm font-semibold hover:text-[var(--color-action-red)]">
                      {line.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                      SKU {line.sku}
                      {line.color ? ` · ${line.color}` : ""}
                      {line.variant ? ` · ${line.variant}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                      <span className="tabular-nums">{money(line.unitPriceMinor, order.currency)}</span> × {line.quantity}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end justify-between">
                    <p className="text-sm font-bold tabular-nums">{money(line.lineTotalMinor, order.currency)}</p>
                    <Link href={`/products/${line.productSlug}`} className="text-xs font-semibold text-[var(--color-action-red)] hover:underline">
                      Buy again
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Delivery" labelledBy="order-delivery">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Method">{DELIVERY_METHOD_LABELS[order.deliveryMethod] ?? order.deliveryMethod}</Field>
              <Field label="Recipient">{order.contact.name}</Field>
              <Field label="Phone">{order.contact.phone}</Field>
              <Field label="Email">{order.contact.email}</Field>
              {addressLines.length > 0 ? (
                <div className="sm:col-span-2">
                  <Field label="Delivery address">
                    {addressLines.map((line, index) => (
                      <span key={index} className="block">
                        {line}
                      </span>
                    ))}
                  </Field>
                </div>
              ) : null}
              {order.delivery.notes ? (
                <div className="sm:col-span-2">
                  <Field label="Delivery notes">{order.delivery.notes}</Field>
                </div>
              ) : null}
            </dl>
          </Panel>
        </div>

        <div className="min-w-0 space-y-4 md:space-y-5">
          <Panel title="Summary" labelledBy="order-summary">
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--text-secondary)]">Subtotal</dt>
                <dd className="font-medium tabular-nums">{money(order.subtotalMinor, order.currency)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--text-secondary)]">Delivery</dt>
                <dd className="text-right font-medium tabular-nums">
                  {order.deliveryFeeMinor === null ? "Not yet quoted" : money(order.deliveryFeeMinor, order.currency)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t border-[var(--color-light-grey)] pt-2.5">
                <dt className="font-semibold">Total</dt>
                <dd className="text-lg font-bold tabular-nums text-[var(--color-action-red)]">{money(order.totalMinor, order.currency)}</dd>
              </div>
            </dl>
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--color-light-grey)] pt-4">
              <Field label="Payment method">{PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}</Field>
              <Field label="Payment status">{PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}</Field>
            </dl>
          </Panel>

          <Panel title="Progress" labelledBy="order-progress">
            <OrderTimeline tracking={tracking} compact />
            <Link
              href={`${base}/tracking`}
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--color-action-red)] text-sm font-semibold text-white transition-colors hover:bg-[var(--color-premium-black)]"
            >
              <Truck size={16} aria-hidden="true" />
              Track order
            </Link>
          </Panel>

          <Panel>
            <ul className="space-y-1 text-sm">
              <li>
                <Link href="/account/support" className="flex h-10 items-center gap-2.5 rounded-lg px-2 font-medium hover:bg-[#f6f6f7]">
                  <LifeBuoy size={17} aria-hidden="true" className="text-[var(--text-secondary)]" />
                  Contact support about this order
                </Link>
              </li>
              <li>
                <Link href="/account/invoices" className="flex h-10 items-center gap-2.5 rounded-lg px-2 font-medium hover:bg-[#f6f6f7]">
                  <FileText size={17} aria-hidden="true" className="text-[var(--text-secondary)]" />
                  Invoices and receipts
                </Link>
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    </PortalPage>
  );
}
