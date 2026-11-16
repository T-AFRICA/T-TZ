import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import {
  acceptAdminInvitations,
  getAdminSession,
  listAdminCountries,
  recordSecurityEvent,
  type AdminAccess,
  type AdminCountry,
} from "@tronic/database/admin";
import { can, canAccessCountry, isMaster, type Actor, type CountryPermission, type GlobalPermission } from "@tronic/permissions";
import { GATE_PATHS, decideGate, gatePath, type Gate, type NoAccessReason, type VerifiedIdentity } from "@/features/auth/gate";
import { adminConfigured } from "./config";
import { getAdminDb } from "./db";
import { supabaseServer } from "./supabase";

/**
 * Who is making this request. Everything here is verified on the server on
 * every request: the Auth user with Supabase Auth (a cookie alone is never
 * trusted), the administrator's status and roles with the admin database.
 * Nothing is read from the URL, a header or a form field.
 */

export interface AdminContext {
  actor: Actor;
  /** What database calls run as. */
  access: AdminAccess;
  email: string;
  fullName: string | null;
  isMaster: boolean;
  /** The countries this administrator has a role in (every country for a Master Super Admin). */
  countries: AdminCountry[];
}

export type SessionState =
  | { state: "not_configured" }
  | { state: "signed_out" }
  | { state: "no_access"; reason: NoAccessReason; email: string | null }
  | { state: "mfa_enroll" | "mfa_challenge"; email: string | null; identity: VerifiedIdentity }
  | { state: "ok"; admin: AdminContext };

async function readIdentity(): Promise<VerifiedIdentity | null> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const level = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return {
    userId: data.user.id,
    email: data.user.email ?? null,
    emailConfirmed: Boolean(data.user.email_confirmed_at),
    aal: level.data?.currentLevel === "aal2" ? "aal2" : "aal1",
    hasVerifiedFactor: (data.user.factors ?? []).some((factor) => factor.factor_type === "totp" && factor.status === "verified"),
  };
}

/** The request's session, resolved once per request. */
export const getSessionState = cache(async (): Promise<SessionState> => {
  // Always per request: nothing about a session is ever prerendered.
  await connection();
  if (!adminConfigured()) return { state: "not_configured" };
  const identity = await readIdentity();
  if (!identity) return { state: "signed_out" };

  const db = getAdminDb();
  const access: AdminAccess = { userId: identity.userId, aal: identity.aal };
  let record = await getAdminSession(db, access);
  if (!record.known && identity.emailConfirmed) {
    // First sign-in of an invited person: their invitations become roles.
    const accepted = await acceptAdminInvitations(db, access);
    if (accepted.ok && accepted.accepted > 0) record = await getAdminSession(db, access);
  }

  const gate: Gate = decideGate(identity, record);
  if (gate.state === "no_access") {
    if (gate.reason === "suspended") await recordSecurityEvent(db, access, { kind: "suspended_access" });
    return { state: "no_access", reason: gate.reason, email: identity.email };
  }
  if (gate.state !== "ok") return { state: gate.state, email: identity.email, identity };

  const countries = await listAdminCountries(db, access);
  return {
    state: "ok",
    admin: {
      actor: gate.actor,
      access,
      email: record.email ?? identity.email ?? "",
      fullName: record.fullName,
      isMaster: isMaster(gate.actor),
      countries,
    },
  };
});

function pathFor(session: Exclude<SessionState, { state: "ok" }>): string {
  if (session.state === "signed_out") return GATE_PATHS.signIn;
  if (session.state === "not_configured") return GATE_PATHS.signIn;
  if (session.state === "no_access") return GATE_PATHS.noAccess;
  return gatePath({ state: session.state });
}

/**
 * The administrator for a console page or action, or a redirect to where
 * they have to go first (sign in, second factor, the no-access notice).
 * Every page and every server action calls this itself: the layout and the
 * proxy are conveniences, never the only guard.
 */
export async function requireAdmin(): Promise<AdminContext> {
  const session = await getSessionState();
  if (session.state !== "ok") redirect(pathFor(session));
  return session.admin;
}

/** Records a refused attempt and answers "not found": the page gives nothing away about what exists. */
async function refuse(admin: AdminContext, kind: "permission_denied" | "country_denied", countryId: string | null, what: string): Promise<never> {
  await recordSecurityEvent(getAdminDb(), admin.access, { kind, countryId: countryId?.slice(0, 24) ?? null, detail: { what } });
  notFound();
}

/** A Master Super Admin, or "not found". */
export async function requireMaster(what: string): Promise<AdminContext> {
  const admin = await requireAdmin();
  if (!admin.isMaster) await refuse(admin, "permission_denied", null, what);
  return admin;
}

export async function requireGlobalPermission(permission: GlobalPermission): Promise<AdminContext> {
  const admin = await requireAdmin();
  if (!can(admin.actor, permission)) await refuse(admin, "permission_denied", null, permission);
  return admin;
}

/**
 * The administrator and the country for a country page or action. The
 * country id comes from the URL or a form and is treated as a request, not
 * as a fact: it must be one of the countries the database returned for this
 * administrator, and the permission (when given) must be held there.
 */
export async function requireCountry(countryId: string, permission?: CountryPermission): Promise<{ admin: AdminContext; country: AdminCountry }> {
  const admin = await requireAdmin();
  const country = admin.countries.find((candidate) => candidate.id === countryId);
  if (!country || !canAccessCountry(admin.actor, country.id)) return refuse(admin, "country_denied", countryId, permission ?? "country");
  if (permission && !can(admin.actor, permission, country.id)) return refuse(admin, "permission_denied", country.id, permission);
  return { admin, country };
}
