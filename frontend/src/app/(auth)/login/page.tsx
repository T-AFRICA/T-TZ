import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { readNext } from "@/features/auth/next";
import { authEnabledForRequest, currentUser } from "@/features/auth/server";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

/**
 * /login — the art-directed sign-in screen (owner reference 2026-11-11).
 * `?next=` (a same-site path) is where the customer goes afterwards, for
 * example back to checkout, which needs an account (owner decision
 * 2026-11-19).
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const next = readNext((await searchParams).next);
  // Already signed in (for example, back from the store): where they were going, not this form.
  if (await currentUser()) redirect(next ?? "/account");
  return <LoginScreen authEnabled={await authEnabledForRequest()} next={next} />;
}
