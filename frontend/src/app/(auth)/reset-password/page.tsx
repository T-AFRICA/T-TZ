import type { Metadata } from "next";
import { LockKeyhole } from "lucide-react";
import { ResetPasswordForm } from "@/components/auth/AuthForms";
import { Accent, AuthLink, AuthScreen } from "@/components/auth/LoginScreen";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false, follow: false } };

/**
 * /reset-password — opened from the reset email once auth is connected; the
 * link's token is checked then. Same showroom shell as /login.
 */
export default function ResetPasswordPage() {
  return (
    <AuthScreen
      icon={<LockKeyhole size={28} strokeWidth={1.9} aria-hidden="true" />}
      long
      title={
        <>
          New <Accent>Password</Accent>
        </>
      }
      subtitle="Choose a password that meets the requirements below."
      footer={
        <>
          Remembered it? <AuthLink href="/login">Back to sign in</AuthLink>
        </>
      }
    >
      <ResetPasswordForm />
    </AuthScreen>
  );
}
