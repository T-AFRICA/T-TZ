import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { readNext } from "@/features/auth/next";
import { authEnabledForRequest, currentUser } from "@/features/auth/server";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

/**
 * /login/registered — where a registration ends (signUpAction): the sign-in
 * screen, opening with a note to confirm by email first. A path rather than
 * a ?flag, so no account page ever has a query string. `?next=` is only
 * there when checkout sent the customer (back to checkout afterwards).
 */
export default async function RegisteredLoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const next = readNext((await searchParams).next);
  // Already signed in (for example, back from the store): where they were going, not this form.
  if (await currentUser()) redirect(next ?? "/account");
  return <LoginScreen authEnabled={await authEnabledForRequest()} registered next={next} />;
}
