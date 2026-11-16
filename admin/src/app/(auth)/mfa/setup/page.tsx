import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MfaSetupForm } from "@/components/console-forms";
import { signOutAction } from "@/features/auth/actions";
import { GATE_PATHS } from "@/features/auth/gate";
import { getSessionState } from "@/server/session";

export const metadata: Metadata = { title: "Set up your authenticator" };

export default async function MfaSetupPage() {
  const session = await getSessionState();
  if (session.state === "signed_out" || session.state === "not_configured") redirect(GATE_PATHS.signIn);
  if (session.state === "mfa_challenge") redirect(GATE_PATHS.mfaChallenge);
  if (session.state === "no_access") redirect(GATE_PATHS.noAccess);
  if (session.state === "ok") redirect(GATE_PATHS.home);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl text-ink">Set up your authenticator</h1>
        <p className="mt-1.5 text-sm text-muted">
          Your role needs a second factor on every sign-in. Set it up once for <span className="font-medium text-ink">{session.email}</span>.
        </p>
      </div>
      <MfaSetupForm />
      <form action={signOutAction}>
        <button type="submit" className="text-sm font-medium text-muted underline underline-offset-4 hover:text-ink">
          Sign out
        </button>
      </form>
    </div>
  );
}
