import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/console-forms";
import { Notice } from "@/components/ui";
import { GATE_PATHS } from "@/features/auth/gate";
import { getSessionState } from "@/server/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage() {
  const session = await getSessionState();
  if (session.state === "ok") redirect(GATE_PATHS.home);
  if (session.state === "mfa_challenge") redirect(GATE_PATHS.mfaChallenge);
  if (session.state === "mfa_enroll") redirect(GATE_PATHS.mfaEnroll);
  if (session.state === "no_access") redirect(GATE_PATHS.noAccess);
  const connected = session.state !== "not_configured";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl text-ink">Sign in</h1>
        <p className="mt-1.5 text-sm text-muted">Use the email address your administrator account was created with.</p>
      </div>
      {connected ? null : (
        <Notice tone="warn" title="Not connected yet">
          The Central Admin is not connected to its account service and database, so nobody can sign in. An owner has to complete the setup first.
        </Notice>
      )}
      <SignInForm disabled={!connected} />
      <p className="text-xs text-muted">There is no self-registration. Access is given by a Master Super Admin or your Country Super Admin.</p>
    </div>
  );
}
