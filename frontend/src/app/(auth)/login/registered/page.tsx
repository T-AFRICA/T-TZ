import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { authEnabledForRequest, currentUser } from "@/features/auth/server";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

/**
 * /login/registered — where a registration ends (signUpAction): the sign-in
 * screen, opening with a note to confirm by email first. A path rather than
 * a ?flag, so no account page ever has a query string.
 */
export default async function RegisteredLoginPage() {
  // Already signed in (for example, back from the store): the account, not this form.
  if (await currentUser()) redirect("/account");
  return <LoginScreen authEnabled={await authEnabledForRequest()} registered />;
}
