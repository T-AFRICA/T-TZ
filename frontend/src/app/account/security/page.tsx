import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, KeyRound, LogOut, MailCheck, MonitorSmartphone, Smartphone } from "lucide-react";
import { NotConnected, PageHeading, Panel, PortalPage, StatusBadge } from "@/components/account/ui";
import { signOutAction } from "@/features/auth/actions";
import { createAccountService } from "@/features/account/service";
import { requireCustomer } from "@/features/account/session";

export const metadata: Metadata = { title: "Account security" };

/**
 * /account/security — what Supabase Auth really offers today: the password
 * reset flow (a link sent to the account email), the email verification
 * state and sign out. Phone verification and the list of active sessions
 * are not connected and are shown as such; this page never confirms a
 * security change it did not make.
 */
export default async function AccountSecurityPage() {
  const user = await requireCustomer();
  const sessions = await createAccountService(user).listSessions();

  return (
    <PortalPage>
      <div>
        <Link href="/account/profile" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--color-action-red)]">
          <ChevronLeft size={16} aria-hidden="true" />
          Profile
        </Link>
        <div className="mt-2">
          <PageHeading eyebrow="Account" title="Account security" description="Keep your TRONIC account safe." />
        </div>
      </div>

      <Panel>
        <ul className="divide-y divide-[var(--color-light-grey)]">
          <li className="flex flex-wrap items-center gap-3 py-4 first:pt-0">
            <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#f6f6f7]">
              <KeyRound size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold">Password</h2>
              <p className="text-xs text-[var(--text-secondary)]">
                We email a secure link to {user.email ?? "your email"} to set a new password.
              </p>
            </div>
            <Link
              href="/forgot-password"
              className="inline-flex h-10 items-center rounded-full border border-[var(--color-light-grey)] px-4 text-[13px] font-semibold transition-colors hover:border-[var(--color-premium-black)]"
            >
              Change password
            </Link>
          </li>
          <li className="flex flex-wrap items-center gap-3 py-4">
            <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#f6f6f7]">
              <MailCheck size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold">Email verification</h2>
              <p className="truncate text-xs text-[var(--text-secondary)]">{user.email ?? "No email on this account"}</p>
            </div>
            <StatusBadge tone={user.emailVerified ? "success" : "warning"}>{user.emailVerified ? "Verified" : "Not verified"}</StatusBadge>
          </li>
          <li className="flex flex-wrap items-center gap-3 py-4">
            <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#f6f6f7]">
              <Smartphone size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold">Phone verification</h2>
              <p className="text-xs text-[var(--text-secondary)]">Verifying your mobile number by SMS is not available yet.</p>
            </div>
            <StatusBadge tone="neutral">Not available</StatusBadge>
          </li>
          <li className="flex flex-wrap items-center gap-3 py-4 last:pb-0">
            <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#f6f6f7]">
              <LogOut size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold">Sign out</h2>
              <p className="text-xs text-[var(--text-secondary)]">End your session on this device.</p>
            </div>
            <form action={signOutAction}>
              <button
                type="submit"
                className="inline-flex h-10 items-center rounded-full bg-[var(--color-premium-black)] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--color-action-red)]"
              >
                Sign out
              </button>
            </form>
          </li>
        </ul>
      </Panel>

      <Panel title="Active sessions" labelledBy="security-sessions">
        {sessions.status === "not_connected" ? (
          <NotConnected
            icon={MonitorSmartphone}
            title="Session list is not available yet"
            body="Seeing the devices signed in to your account, and signing them out, will be available here."
            waitingFor={sessions.waitingFor}
          />
        ) : (
          <ul className="divide-y divide-[var(--color-light-grey)]" aria-label="Active sessions">
            {sessions.data.map((session) => (
              <li key={session.id} className="flex items-center justify-between gap-3 py-3">
                <p className="text-sm font-medium">{session.device}</p>
                {session.current ? <StatusBadge tone="success">This device</StatusBadge> : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </PortalPage>
  );
}
