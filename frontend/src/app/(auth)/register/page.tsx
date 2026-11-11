import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/components/auth/AuthForms";
import { AuthLayout } from "@/components/auth/AuthLayout";

export const metadata: Metadata = { title: "Create your account", robots: { index: false, follow: false } };

export default function RegisterPage() {
  return (
    <AuthLayout
      title="Create your account"
      subtitle="Join TRONIC for a smoother shopping experience."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-[var(--color-action-red)] underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthLayout>
  );
}
