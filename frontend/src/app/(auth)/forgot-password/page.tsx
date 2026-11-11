import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import { ForgotPasswordForm } from "@/components/auth/AuthForms";
import { Accent, AuthLink, AuthScreen } from "@/components/auth/LoginScreen";

export const metadata: Metadata = { title: "Forgot your password?", robots: { index: false, follow: false } };

/** /forgot-password — same showroom shell as /login. No reset email is sent yet. */
export default function ForgotPasswordPage() {
  return (
    <AuthScreen
      icon={<KeyRound size={28} strokeWidth={1.9} aria-hidden="true" />}
      title={
        <>
          Forgot <Accent>Password?</Accent>
        </>
      }
      subtitle="Enter your email and we'll send you a link to choose a new one."
      footer={
        <>
          Remembered it? <AuthLink href="/login">Back to sign in</AuthLink>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthScreen>
  );
}
