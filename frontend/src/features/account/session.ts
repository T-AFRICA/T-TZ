import { cache } from "react";
import { redirect } from "next/navigation";
import { currentUser, type SessionUser } from "@/features/auth/server";

/**
 * The signed-in customer for an account page, or a redirect to /login.
 * Every account page and the account layout call this: the proxy already
 * sends signed-out visitors away, but a page never relies on the proxy or
 * the layout alone (layouts are not re-run on every navigation). Verified
 * with Supabase Auth on each request; cached within one request only.
 */
export const requireCustomer = cache(async (): Promise<SessionUser> => {
  const user = await currentUser();
  if (!user) redirect("/login");
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
