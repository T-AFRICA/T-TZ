import type { Metadata } from "next";
import Link from "next/link";
import { Bell, BellOff } from "lucide-react";
import { EmptyState, NotConnected, PageHeading, Panel, PortalPage, TextLink, formatDate } from "@/components/account/ui";
import { createAccountService } from "@/features/account/service";
import { requireCustomer } from "@/features/account/session";

export const metadata: Metadata = { title: "Notifications" };

/**
 * /account/notifications — updates about the customer's orders. Only
 * events that really happened belong here; there is no event log or
 * notification service yet, so the list is not connected and no email, SMS
 * or WhatsApp message is sent by this page.
 */
export default async function AccountNotificationsPage() {
  const user = await requireCustomer();
  const result = await createAccountService(user).listNotifications();

  return (
    <PortalPage>
      <PageHeading eyebrow="Updates" title="Notifications" description="Updates about your orders and your account." />

      <div className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(17,17,17,0.04)]">
        {result.status === "not_connected" ? (
          <NotConnected
            icon={BellOff}
            title="Notifications are not connected yet"
            body="Order confirmations, dispatch and delivery updates will appear here as they happen. For now, check an order's progress on its tracking page."
            waitingFor={result.waitingFor}
            action={<TextLink href="/account/tracking">Track my orders</TextLink>}
          />
        ) : result.data.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications" body="You are all caught up." />
        ) : (
          <ul className="divide-y divide-[var(--color-light-grey)]" aria-label="Notifications">
            {result.data.map((notification) => (
              <li key={notification.id} className="flex gap-3 p-4 md:px-5">
                <span
                  aria-hidden="true"
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.readAt ? "bg-[var(--color-light-grey)]" : "bg-[var(--color-action-red)]"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {notification.title}
                    {notification.readAt ? null : <span className="sr-only"> (unread)</span>}
                  </p>
                  <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{notification.body}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {formatDate(notification.createdAt, true)}
                    {notification.orderNumber ? (
                      <>
                        {" · "}
                        <Link href={`/account/orders/${notification.orderNumber}`} className="font-semibold hover:text-[var(--color-action-red)]">
                          Order {notification.orderNumber}
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Panel title="What you will be told about" labelledBy="notification-kinds">
        <ul className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm text-[var(--text-secondary)] sm:grid-cols-2">
          {["Order confirmation", "Payment confirmation", "Order processing", "Dispatch", "Out for delivery", "Delivered", "Cancellation or refund"].map((kind) => (
            <li key={kind} className="flex items-center gap-2">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--color-action-red)]" />
              {kind}
            </li>
          ))}
        </ul>
      </Panel>
    </PortalPage>
  );
}
