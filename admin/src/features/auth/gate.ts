import { isRoleKey, type Actor, type RoleAssignment } from "@tronic/permissions";

/**
 * Decides what a signed-in user of the admin Auth project is allowed to
 * reach, from facts the server has verified: the Auth user, the session's
 * assurance level and the administrator's record in the admin database.
 * Pure, so every outcome is covered by tests.
 */

export interface VerifiedIdentity {
  userId: string;
  email: string | null;
  emailConfirmed: boolean;
  /** "aal2" once this session passed the second factor. */
  aal: "aal1" | "aal2";
  /** True when the account has a verified authenticator. */
  hasVerifiedFactor: boolean;
}

export interface AdminRecord {
  known: boolean;
  status: "active" | "suspended" | null;
  fullName: string | null;
  assignments: { role: string; countryId: string | null }[];
  mfaRequired: boolean;
}

export type NoAccessReason = "unknown_account" | "email_not_confirmed" | "suspended" | "no_roles";

export type Gate =
  | { state: "no_access"; reason: NoAccessReason }
  /** A role asks for a second factor and the account has no authenticator yet. */
  | { state: "mfa_enroll" }
  /** A role asks for a second factor and this session has not passed it. */
  | { state: "mfa_challenge" }
  | { state: "ok"; actor: Actor };

export function decideGate(identity: VerifiedIdentity, record: AdminRecord): Gate {
  if (!record.known) return { state: "no_access", reason: identity.emailConfirmed ? "unknown_account" : "email_not_confirmed" };
  if (record.status !== "active") return { state: "no_access", reason: "suspended" };

  // Roles this version of the application does not know are ignored.
  const assignments: RoleAssignment[] = record.assignments.flatMap((assignment) =>
    isRoleKey(assignment.role) ? [{ role: assignment.role, countryId: assignment.countryId }] : [],
  );
  if (assignments.length === 0) return { state: "no_access", reason: "no_roles" };

  if (record.mfaRequired && identity.aal !== "aal2") {
    return { state: identity.hasVerifiedFactor ? "mfa_challenge" : "mfa_enroll" };
  }
  return { state: "ok", actor: { userId: identity.userId, status: "active", assignments, mfaVerified: identity.aal === "aal2" } };
}

/** Where each gate outcome sends the browser. */
export const GATE_PATHS = {
  signIn: "/sign-in",
  noAccess: "/no-access",
  mfaEnroll: "/mfa/setup",
  mfaChallenge: "/mfa",
  home: "/",
} as const;

export function gatePath(gate: Gate): string {
  switch (gate.state) {
    case "no_access":
      return GATE_PATHS.noAccess;
    case "mfa_enroll":
      return GATE_PATHS.mfaEnroll;
    case "mfa_challenge":
      return GATE_PATHS.mfaChallenge;
    case "ok":
      return GATE_PATHS.home;
  }
}
