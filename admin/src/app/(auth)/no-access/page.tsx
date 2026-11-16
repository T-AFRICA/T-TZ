import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signOutAction } from "@/features/auth/actions";
import { GATE_PATHS, type NoAccessReason } from "@/features/auth/gate";
import { buttonClass } from "@/components/ui";
import { getSessionState } from "@/server/session";

export const metadata: Metadata = { title: "No access" };

const TEXT: Record<NoAccessReason, { title: string; body: string }> = {
  unknown_account: {
    title: "This account has no access",
    body: "You are signed in, but this account has not been given a role in the Central Admin. Ask a Master Super Admin or your Country Super Admin to invite this email address.",
  },
  email_not_confirmed: {
    title: "Confirm your email address first",
    body: "Access can only be given to a confirmed email address. Open the confirmation link you were sent, then sign in again.",
  },
  suspended: {
    title: "This account is suspended",
    body: "A Master Super Admin has suspended this account. It cannot view or change anything until it is reinstated.",
  },
  no_roles: {
    title: "This account has no roles",
    body: "Every role of this account has been removed. Ask a Master Super Admin or your Country Super Admin if you still need access.",
  },
};

export default async function NoAccessPage() {
  const session = await getSessionState();
  if (session.state !== "no_access") redirect(session.state === "ok" ? GATE_PATHS.home : GATE_PATHS.signIn);
  const text = TEXT[session.reason];
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl text-ink">{text.title}</h1>
        <p className="mt-2 text-sm text-muted">{text.body}</p>
        {session.email ? (
          <p className="mt-3 text-sm text-muted">
            Signed in as <span className="font-medium text-ink">{session.email}</span>.
          </p>
        ) : null}
      </div>
      <form action={signOutAction}>
        <button type="submit" className={`${buttonClass.secondary} w-full`}>
          Sign out
        </button>
      </form>
    </div>
  );
}
