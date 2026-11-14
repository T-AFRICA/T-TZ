import type { Metadata } from "next";
import Link from "next/link";
import { Truck } from "lucide-react";
import { ArrowRightIcon } from "@tronic/ui";
import { OrderTimeline } from "@/components/account/OrderTimeline";
import { ButtonLink, EmptyState, NotConnected, PageHeading, PortalPage, StatusBadge, TextLink, formatDate, money } from "@/components/account/ui";
import { createAccountService } from "@/features/account/service";
import { requireCustomer } from "@/features/account/session";
import { ACTIVE_STATUSES } from "@/features/account/tracking";
import { orderStatusTone } from "@/features/orders/status";

export const metadata: Metadata = { title: "Track order" };

/**
 * /account/tracking — the signed-in customer's orders that are still on
 * their way, each with its progress and a link to the full timeline.
 * Tracking an order placed without an account stays on /track-order, where
 * the order number must be matched with the checkout email or phone.
 */
export default async function AccountTrackingPage() {
  const user = await requireCustomer();
  const service = createAccountService(user);
  const result = await service.listOrders({ statuses: ACTIVE_STATUSES, pageSize: 20 });

  return (
    <PortalPage>
      <PageHeading eyebrow="Delivery" title="Track order" description="Orders that are still being prepared or on their way to you." />

      {result.status === "not_connected" ? (
        <div className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(17,17,17,0.04)]">
          <NotConnected
            icon={Truck}
            title="Order tracking is not connected yet"
            body="Once online ordering is connected, the progress of your orders will show here."
            waitingFor={result.waitingFor}
          />
        </div>
      ) : result.data.items.length === 0 ? (
        <div className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(17,17,17,0.04)]">
          <EmptyState
            icon={Truck}
            title="Nothing on its way right now"
            body="You have no orders in progress. Delivered and cancelled orders are under My orders."
            action={<ButtonLink href="/account/orders">View my orders</ButtonLink>}
          />
        </div>
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 xl:grid-cols-2 xl:gap-4" aria-label="Orders in progress">
          {result.data.items.map((order) => {
            const tracking = service.getTracking(order);
            return (
              <li key={order.orderNumber} className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(17,17,17,0.04)] md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-[var(--text-secondary)]">Order</p>
                    <h2 className="text-sm font-bold tabular-nums md:text-base">{order.orderNumber}</h2>
                    <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                      Placed {formatDate(order.createdAt)} · <span className="tabular-nums">{money(order.totalMinor, order.currency)}</span>
                    </p>
                  </div>
                  <StatusBadge tone={orderStatusTone(order.status)}>{tracking.currentTitle}</StatusBadge>
                </div>
                <div className="mt-4 border-t border-[var(--color-light-grey)] pt-4">
                  <OrderTimeline tracking={tracking} compact />
                </div>
                <Link
                  href={`/account/orders/${order.orderNumber}/tracking`}
                  className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-full bg-[var(--color-action-red)] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--color-premium-black)]"
                >
                  Full tracking
                  <ArrowRightIcon size={14} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(17,17,17,0.04)] md:p-5">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Ordered without signing in?</p>
          <p className="text-xs text-[var(--text-secondary)]">Track it with the order number and the email or phone used at checkout.</p>
        </div>
        <TextLink href="/track-order">Track by order number</TextLink>
      </div>
    </PortalPage>
  );
}
