import type { Metadata } from "next";
import { AccountShell } from "@/components/account/AccountShell";
import { requireCustomer } from "@/features/account/session";

export const metadata: Metadata = {
  title: "Your account",
  // Private pages: never indexed, whatever the site-wide setting becomes.
  robots: { index: false, follow: false },
};

/**
 * Customer portal frame for every /account page. Signed-out visitors are
 * sent to /login here, by the proxy before this, and again by each page
 * (a layout is not re-run on every navigation, so pages never rely on it).
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireCustomer();
  return <AccountShell user={user}>{children}</AccountShell>;
}
