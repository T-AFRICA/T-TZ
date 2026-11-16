"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { adminConfigured } from "@/server/config";
import { allowAttempt, clientKey } from "@/server/rate-limit";
import { getSessionState } from "@/server/session";
import { supabaseServer } from "@/server/supabase";
import { fieldErrors, formText, signInSchema, totpSchema, type FormState } from "@/features/rules";
import { GATE_PATHS } from "./gate";

/**
 * Server actions behind the sign-in and second-factor forms. There is no
 * registration action: an account exists only because an owner or an
 * administrator created it, and it can do nothing until it holds a role.
 *
 * Every action validates its input, refuses while the application is not
 * connected, and returns only a status: never a password, a code, a token
 * or a provider message. The server log gets the provider's error code and
 * HTTP status for refusals that are ours to fix, and nothing the person typed.
 */

const NOT_CONNECTED: FormState = { status: "error", message: "The Central Admin is not connected to its account service yet." };
const TOO_MANY: FormState = { status: "error", message: "Too many attempts. Wait a few minutes and try again." };
const UNAVAILABLE: FormState = { status: "error", message: "We couldn't complete this right now. Please try again." };

type ProviderError = { code?: string | undefined; status?: number | undefined };

function log(operation: string, error: ProviderError): void {
  console.error(`admin auth: ${operation} refused by the provider`, { code: error.code ?? "none", status: error.status ?? "none" });
}

function isRateLimit(error: ProviderError): boolean {
  return error.status === 429 || error.code === "over_request_rate_limit";
}

export async function signInAction(_previous: FormState, form: FormData): Promise<FormState> {
  if (!adminConfigured()) return NOT_CONNECTED;
  const parsed = signInSchema.safeParse({ email: formText(form, "email"), password: formText(form, "password") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const client = clientKey(await headers());
  if (!allowAttempt(`sign-in:${client}`, 20, 10 * 60_000) || !allowAttempt(`sign-in:${parsed.data.email}`, 8, 10 * 60_000)) return TOO_MANY;

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (isRateLimit(error)) return TOO_MANY;
    // One answer for a wrong password, an unknown address and an
    // unconfirmed one: the form never says which accounts exist.
    if (error.status !== undefined && error.status >= 400 && error.status < 500) {
      return { status: "error", message: "That email and password don't match an administrator account." };
    }
    log("sign-in", error);
    return UNAVAILABLE;
  }
  // The console decides what comes next: a second factor, the no-access notice or the dashboard.
  redirect(GATE_PATHS.home);
}

export async function signOutAction(): Promise<void> {
  if (adminConfigured()) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.signOut();
    if (error) {
      // The provider could not end the session: end it on this device regardless.
      log("sign-out", error);
      await supabase.auth.signOut({ scope: "local" });
    }
  }
  redirect(GATE_PATHS.signIn);
}

export interface MfaSetupState extends FormState {
  /** Shown once so the person can add the account to their authenticator app. */
  enrollment?: { factorId: string; qrCode: string; secret: string };
}

/** Starts authenticator set-up for an account whose role asks for a second factor. */
export async function startMfaEnrollmentAction(): Promise<MfaSetupState> {
  if (!adminConfigured()) return NOT_CONNECTED;
  const session = await getSessionState();
  if (session.state !== "mfa_enroll") redirect(GATE_PATHS.home);
  if (!allowAttempt(`mfa-enroll:${session.identity.userId}`, 6, 10 * 60_000)) return TOO_MANY;

  const supabase = await supabaseServer();
  const { data: userData } = await supabase.auth.getUser();
  // A set-up that was started and never finished is replaced by this one.
  for (const factor of userData.user?.factors ?? []) {
    if (factor.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "TRONIC Central Admin" });
  if (error || !data || data.type !== "totp") {
    if (error) log("authenticator set-up", error);
    return UNAVAILABLE;
  }
  return { status: "ok", enrollment: { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret } };
}

async function verifyCode(factorId: string, code: string, userId: string): Promise<FormState | null> {
  if (!allowAttempt(`mfa-verify:${userId}`, 8, 5 * 60_000)) return TOO_MANY;
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (!error) return null;
  if (isRateLimit(error)) return TOO_MANY;
  if (error.status !== undefined && error.status >= 400 && error.status < 500) {
    return { status: "error", fieldErrors: { code: "That code is not right or has expired. Enter the current code from your app." } };
  }
  log("second factor", error);
  return UNAVAILABLE;
}

/** Finishes authenticator set-up with the first code from the app. */
export async function verifyMfaEnrollmentAction(_previous: FormState, form: FormData): Promise<FormState> {
  if (!adminConfigured()) return NOT_CONNECTED;
  const session = await getSessionState();
  if (session.state !== "mfa_enroll") redirect(GATE_PATHS.home);
  const parsed = totpSchema.safeParse({ code: formText(form, "code") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  // The factor must be one this account is setting up: the id in the form is only a hint.
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const factor = (data.user?.factors ?? []).find((candidate) => candidate.id === formText(form, "factorId") && candidate.factor_type === "totp");
  if (!factor) return { status: "error", message: "This set-up has expired. Start again." };

  const failure = await verifyCode(factor.id, parsed.data.code, session.identity.userId);
  if (failure) return failure;
  redirect(GATE_PATHS.home);
}

/** Second step of sign-in for an account that already has an authenticator. */
export async function verifyMfaChallengeAction(_previous: FormState, form: FormData): Promise<FormState> {
  if (!adminConfigured()) return NOT_CONNECTED;
  const session = await getSessionState();
  if (session.state !== "mfa_challenge") redirect(GATE_PATHS.home);
  const parsed = totpSchema.safeParse({ code: formText(form, "code") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const factor = (data.user?.factors ?? []).find((candidate) => candidate.factor_type === "totp" && candidate.status === "verified");
  if (!factor) redirect(GATE_PATHS.mfaEnroll);

  const failure = await verifyCode(factor.id, parsed.data.code, session.identity.userId);
  if (failure) return failure;
  redirect(GATE_PATHS.home);
}
