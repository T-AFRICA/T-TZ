import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UserPlus } from "lucide-react";
import { RegisterForm } from "@/components/auth/AuthForms";
import { Accent, AuthLink, AuthScreen } from "@/components/auth/LoginScreen";
import { authEnabledForRequest, currentUser } from "@/features/auth/server";

export const metadata: Metadata = { title: "Create your account", robots: { index: false, follow: false } };

/** /register — same showroom shell as /login; the longer form may scroll on short screens. */
export default async function RegisterPage() {
  // Already signed in (for example, back from the store): the account, not this form.
  if (await currentUser()) redirect("/account");
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
          Already have an account? <AuthLink href="/login">Sign in</AuthLink>
        </>
      }
    >
      <RegisterForm enabled={await authEnabledForRequest()} />
    </AuthScreen>
  );
}
