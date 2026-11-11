import type { ReactNode } from "react";
import { AuthStage } from "@/components/auth/AuthStage";

/** Login, register and the password pages share one mounted stage; only the card changes. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AuthStage>{children}</AuthStage>;
}
