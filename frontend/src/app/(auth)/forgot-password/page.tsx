import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/AuthForms";
import { AuthLayout } from "@/components/auth/AuthLayout";

export const metadata: Metadata = { title: "Forgot your password?", robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a link to choose a new one."
      footer={
        <Link href="/login" className="font-semibold text-[var(--color-action-red)] underline-offset-4 hover:underline">
          ← Back to sign in
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
