import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MfaChallengeForm } from "@/components/console-forms";
import { signOutAction } from "@/features/auth/actions";
import { GATE_PATHS } from "@/features/auth/gate";
import { getSessionState } from "@/server/session";

export const metadata: Metadata = { title: "Second step" };

export default async function MfaChallengePage() {
  const session = await getSessionState();
  if (session.state === "signed_out" || session.state === "not_configured") redirect(GATE_PATHS.signIn);
  if (session.state === "mfa_enroll") redirect(GATE_PATHS.mfaEnroll);
  if (session.state === "no_access") redirect(GATE_PATHS.noAccess);
  if (session.state === "ok") redirect(GATE_PATHS.home);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl text-ink">Second step</h1>
        <p className="mt-1.5 text-sm text-muted">
          Your role needs a second factor. Enter the code from your authenticator app to continue as <span className="font-medium text-ink">{session.email}</span>.
        </p>
      </div>
      <MfaChallengeForm />
      <form action={signOutAction}>
        <button type="submit" className="text-sm font-medium text-muted underline underline-offset-4 hover:text-ink">
          Sign out and use another account
        </button>
      </form>
    </div>
  );
}
