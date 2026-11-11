import type { Metadata } from "next";
import { UserPlus } from "lucide-react";
import { RegisterForm } from "@/components/auth/AuthForms";
import { Accent, AuthLink, AuthScreen } from "@/components/auth/LoginScreen";

export const metadata: Metadata = { title: "Create your account", robots: { index: false, follow: false } };

/** /register — same showroom shell as /login; the longer form may scroll on short screens. */
export default function RegisterPage() {
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
      <RegisterForm />
    </AuthScreen>
  );
}
