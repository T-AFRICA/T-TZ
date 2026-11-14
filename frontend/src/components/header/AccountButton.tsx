"use client";

import Link from "next/link";
import { UserIcon } from "@tronic/ui";
import { ACCOUNT_LINK, SIGNED_IN_ACCOUNT_LINK } from "@/config/site";
import { useSignedInHint } from "@/features/auth/sessionHint";

/**
 * The red account button of the desktop header. "Login" to /login for a
 * visitor; "Account" to /account once this browser has a customer session,
 * so a customer who went shopping gets back to their account in one click.
 * The label follows a hint (features/auth/sessionHint.ts); the account
 * pages themselves decide who is signed in.
 */
export function AccountButton() {
  const link = useSignedInHint() ? SIGNED_IN_ACCOUNT_LINK : ACCOUNT_LINK;
  return (
    <Link
      href={link.href}
      aria-label={link.label}
      className="hidden items-center gap-2 rounded-full bg-[var(--color-action-red)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-action-red-dark)] md:flex"
    >
      <UserIcon size={18} />
      <span className="hidden lg:inline">{link.label}</span>
    </Link>
  );
}
