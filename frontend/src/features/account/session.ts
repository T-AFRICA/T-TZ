import { cache } from "react";
import { redirect } from "next/navigation";
import { claimGuestOrders } from "@tronic/database";
import { currentUser, type SessionUser } from "@/features/auth/server";
import { getDb, ordersEnabled } from "@/features/data/source";

/**
 * The signed-in customer for an account page, or a redirect to /login.
 * Every account page and the account layout call this: the proxy already
 * sends signed-out visitors away, but a page never relies on the proxy or
 * the layout alone (layouts are not re-run on every navigation). Verified
 * with Supabase Auth on each request; cached within one request only.
 *
 * Before the page reads any order, the guest orders placed with the
 * customer's verified email address join their account (migration 0014),
 * so an order placed before signing in is listed too.
 */
export const requireCustomer = cache(async (): Promise<SessionUser> => {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.emailVerified && ordersEnabled()) {
    try {
      await claimGuestOrders(getDb(), { role: "authenticated", userId: user.id });
    } catch (error) {
      // The account still opens; its own order reads report a database
      // that is down. Logged without the customer's id or address.
      console.error("account: linking guest orders failed", (error as { code?: unknown } | null)?.code ?? "unknown");
    }
  }
  return user;
});

/** First name for the greeting, when the profile has a name. */
export function firstName(user: Pick<SessionUser, "fullName">): string | null {
  const name = user.fullName?.trim().split(/\s+/)[0];
  return name ? name : null;
}

/** Up to two initials for the avatar; "T" (TRONIC) without a name or email. */
export function initials(user: Pick<SessionUser, "fullName" | "email">): string {
  const source = user.fullName?.trim() || user.email?.trim() || "";
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  const letters = parts.length >= 2 ? `${parts[0]![0]}${parts[1]![0]}` : (parts[0]?.slice(0, 1) ?? "T");
  return letters.toUpperCase();
}
