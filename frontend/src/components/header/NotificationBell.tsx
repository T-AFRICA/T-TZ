"use client";

import Link from "next/link";
import { BellIcon } from "@tronic/ui";
import { unreadBadge } from "@/features/account/notifications";
import { useUnreadNotifications } from "@/features/account/unread";

/**
 * The bell of the phone header (owner brief 2026-11-14). It opens the
 * customer's notifications; a visitor is taken to sign in first by the
 * account pages. While a signed-in customer has unread notifications a red
 * bubble shows how many, and the link's name says so for screen readers.
 */
export function NotificationBell() {
  const unread = useUnreadNotifications();
  const badge = unreadBadge(unread);
  return (
    <Link
      href="/account/notifications"
      aria-label={badge ? `Notifications, ${unread} unread` : "Notifications"}
      className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm transition-colors hover:bg-[var(--surface-card)] md:hidden"
    >
      <BellIcon size={20} />
      {badge ? (
        <span
          aria-hidden="true"
          data-testid="notification-badge"
          className="absolute -right-0.5 -top-0.5 grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full bg-[var(--color-action-red)] px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white"
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
