import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/AuthForms";
import { AuthLayout } from "@/components/auth/AuthLayout";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false, follow: false } };

/** Opened from the reset email once auth is connected; the link's token is checked then. */
export default function ResetPasswordPage() {
  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="Your new password must meet the requirements below."
      footer={
        <Link href="/login" className="font-semibold text-[var(--color-action-red)] underline-offset-4 hover:underline">
          ← Back to sign in
        </Link>
      }
    >
      <ResetPasswordForm />
    </AuthLayout>
  );
}
