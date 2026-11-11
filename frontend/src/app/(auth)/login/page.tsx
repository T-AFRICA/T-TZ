import type { Metadata } from "next";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { authEnabledForRequest } from "@/features/auth/server";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

/** /login — the art-directed sign-in screen (owner reference 2026-11-11). */
export default async function LoginPage() {
  return <LoginScreen authEnabled={await authEnabledForRequest()} />;
}
