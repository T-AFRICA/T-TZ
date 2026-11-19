import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LockIcon } from "@tronic/ui";
import { AuthHead } from "@/components/auth-head";
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
    <div className="flex flex-col gap-6">
      <AuthHead icon={<LockIcon size={24} />} title="Second" accent="step" step={2} />
      <MfaChallengeForm />
      <form action={signOutAction}>
        <button type="submit" className="text-sm font-medium text-muted underline underline-offset-4 hover:text-ink">
          Sign out and use another account
        </button>
      </form>
    </div>
  );
}
