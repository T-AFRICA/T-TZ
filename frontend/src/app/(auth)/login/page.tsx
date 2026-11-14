import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { authEnabledForRequest, currentUser } from "@/features/auth/server";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

/** /login — the art-directed sign-in screen (owner reference 2026-11-11). */
export default async function LoginPage() {
  // Already signed in (for example, back from the store): the account, not this form.
  if (await currentUser()) redirect("/account");
  return <LoginScreen authEnabled={await authEnabledForRequest()} />;
}
