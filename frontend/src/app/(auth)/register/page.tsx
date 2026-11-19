import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UserPlus } from "lucide-react";
import { RegisterForm } from "@/components/auth/AuthForms";
import { Accent, AuthLink, AuthScreen } from "@/components/auth/LoginScreen";
import { readNext, withNext } from "@/features/auth/next";
import { authEnabledForRequest, currentUser } from "@/features/auth/server";

export const metadata: Metadata = { title: "Create your account", robots: { index: false, follow: false } };

/**
 * /register — same showroom shell as /login; the longer form may scroll on
 * short screens. `?next=` (a same-site path) is where the customer goes once
 * the account is ready, for example back to checkout.
 */
export default async function RegisterPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const next = readNext((await searchParams).next);
  // Already signed in (for example, back from the store): where they were going, not this form.
  if (await currentUser()) redirect(next ?? "/account");
  return (
    <AuthScreen
      icon={<UserPlus size={28} strokeWidth={1.9} aria-hidden="true" />}
      long
      title={
        <>
          Create your <Accent>Account</Accent>
        </>
      }
      subtitle="Join TRONIC for a smoother shopping experience."
      footer={
        <>
          Already have an account? <AuthLink href={withNext("/login", next)}>Sign in</AuthLink>
        </>
      }
    >
      <RegisterForm enabled={await authEnabledForRequest()} next={next} />
    </AuthScreen>
  );
}
