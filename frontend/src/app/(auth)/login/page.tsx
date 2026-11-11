import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/AuthForms";
import { AuthLayout } from "@/components/auth/AuthLayout";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default function LoginPage() {
  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your TRONIC account."
      footer={
        <>
          New to TRONIC?{" "}
          <Link href="/register" className="font-semibold text-[var(--color-action-red)] underline-offset-4 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthLayout>
  );
}
