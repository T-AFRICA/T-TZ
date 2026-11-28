"use client";

import Link from "next/link";
import { UserIcon } from "@tronic/ui";
import { ACCOUNT_LINK, SIGNED_IN_ACCOUNT_LINK } from "@/config/site";
import { unreadBadge } from "@/features/account/notifications";
import { useUnreadNotifications } from "@/features/account/unread";
import { useSignedInHint } from "@/features/auth/sessionHint";

/**
 * The red account button of the desktop header. "Login" to /login for a
 * visitor; "Account" to /account once this browser has a customer session,
 * so a customer who went shopping gets back to their account in one click.
 * The label follows a hint (features/auth/sessionHint.ts); the account
 * pages themselves decide who is signed in.
 *
 * The desktop header has no bell, so a signed-in customer with unread
 * notifications sees how many on this button.
 */
export function AccountButton() {
  const link = useSignedInHint() ? SIGNED_IN_ACCOUNT_LINK : ACCOUNT_LINK;
  const unread = useUnreadNotifications();
  const badge = unreadBadge(unread);
  return (
    <Link
      href={link.href}
      aria-label={badge ? `${link.label}, ${unread} unread ${unread === 1 ? "notification" : "notifications"}` : link.label}
      className="relative hidden items-center gap-2 rounded-full m-press bg-[var(--color-action-red)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-action-red-dark)] md:flex"
    >
      <UserIcon size={18} />
      <span className="hidden lg:inline">{link.label}</span>
      {badge ? (
        <span
          aria-hidden="true"
          data-testid="account-unread-badge"
          className="absolute -right-1 -top-1 grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full bg-[var(--color-premium-black)] px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white"
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
