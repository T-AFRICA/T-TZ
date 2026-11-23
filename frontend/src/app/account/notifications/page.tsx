import type { Metadata } from "next";
import Link from "next/link";
import { Bell, BellOff } from "lucide-react";
import { UnreadSync } from "@/components/account/UnreadSync";
import { EmptyState, NotConnected, PageHeading, Panel, PortalPage, TextLink, formatDate } from "@/components/account/ui";
import { markNotificationsReadAction } from "@/features/account/actions";
import { NOTIFICATION_KIND_LABELS } from "@/features/account/notifications";
import { createAccountService } from "@/features/account/service";
import { requireCustomer } from "@/features/account/session";

export const metadata: Metadata = { title: "Notifications" };

/**
 * /account/notifications — what happened to the customer's own orders
 * (migration 0023). The database writes a notification when the event
 * happens, so the list holds real events only; the customer reads their own
 * (Row Level Security) and can mark them read. Shown inside the site: no
 * email, SMS or WhatsApp message is sent.
 */
export default async function AccountNotificationsPage() {
  const user = await requireCustomer();
  const result = await createAccountService(user).listNotifications();
  const notifications = result.status === "ok" ? result.data : [];
  const unread = notifications.filter((notification) => notification.readAt === null).length;

  return (
    <PortalPage>
      <UnreadSync count={unread} />
      <PageHeading
        eyebrow="Updates"
        title="Notifications"
        description={unread > 0 ? `Updates about your orders. ${unread} unread.` : "Updates about your orders."}
        action={
          unread > 0 ? (
            <form action={markNotificationsReadAction}>
              <button
                type="submit"
                className="inline-flex h-10 items-center rounded-full border border-[var(--color-light-grey)] bg-white px-4 text-sm font-semibold transition-colors hover:border-[var(--color-action-red)] hover:text-[var(--color-action-red)]"
              >
                Mark all as read
              </button>
            </form>
          ) : null
        }
      />

      <div className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(17,17,17,0.04)]">
        {result.status === "not_connected" ? (
          <NotConnected
            icon={BellOff}
            title="Notifications are not connected yet"
            body="Order confirmations, dispatch and delivery updates will appear here as they happen. For now, check an order's progress on its tracking page."
            waitingFor={result.waitingFor}
            action={<TextLink href="/account/tracking">Track my orders</TextLink>}
          />
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications yet"
            body="When you place an order, each step from confirmation to delivery appears here."
            action={<TextLink href="/products">Browse products</TextLink>}
          />
        ) : (
          <ul className="divide-y divide-[var(--color-light-grey)]" aria-label="Notifications">
            {notifications.map((notification) => {
              const isUnread = notification.readAt === null;
              return (
                <li key={notification.id} className={`flex gap-3 p-4 md:px-5 ${isUnread ? "bg-[#fffafa]" : ""}`}>
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${isUnread ? "bg-[var(--color-action-red)]" : "bg-[var(--color-light-grey)]"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${isUnread ? "font-bold" : "font-semibold"}`}>
                      {notification.title}
                      {isUnread ? <span className="sr-only"> (unread)</span> : null}
                    </p>
                    <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{notification.body}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-[var(--text-muted)]">
                      <span>{formatDate(notification.createdAt, true)}</span>
                      <span aria-hidden="true">·</span>
                      <Link href={`/account/orders/${notification.orderNumber}`} className="font-semibold hover:text-[var(--color-action-red)]">
                        Order {notification.orderNumber}
                      </Link>
                    </p>
                  </div>
                  {isUnread ? (
                    <form action={markNotificationsReadAction} className="shrink-0 self-start">
                      <input type="hidden" name="id" value={notification.id} />
                      <button
                        type="submit"
                        aria-label={`Mark "${notification.title}" for order ${notification.orderNumber} as read`}
                        className="inline-flex min-h-9 items-center rounded-full px-2.5 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[#f6f6f7] hover:text-[var(--color-action-red)]"
                      >
                        Mark read
                      </button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Panel title="What you will be told about" labelledBy="notification-kinds">
        <ul className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm text-[var(--text-secondary)] sm:grid-cols-2">
          {NOTIFICATION_KIND_LABELS.map((kind) => (
            <li key={kind} className="flex items-center gap-2">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--color-action-red)]" />
              {kind}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-[var(--text-muted)]">These updates are shown here on the website. We do not send them by email, SMS or WhatsApp yet.</p>
      </Panel>
    </PortalPage>
  );
}
