"use server";

import { redirect } from "next/navigation";
import { normalizeTzPhone } from "@/features/checkout/validation";
import { validateForgot, validateLogin, validateRegister, validateReset } from "./rules";
import { authConfigured, safeNextPath, siteOrigin, supabaseServer } from "./server";
import { authErrorFromSupabase, isUnexpectedAuthError } from "./service";
import type { AuthFormState } from "./state";

/**
 * Server actions behind the account forms. They are the forms' POST
 * handlers: with JavaScript the form calls them in the background; without
 * it (or if hydration failed) the browser posts the form to the page and
 * Next.js runs the same action. Either way nothing typed into a form goes
 * into a URL.
 *
 * Every action re-validates its input with the same rules the browser uses,
 * refuses while auth is not configured, and returns only a status: never a
 * password, token or provider message.
 *
 * When the provider refuses for a reason that is ours to fix (a setting, an
 * outage), the server log gets the provider's error code and HTTP status
 * and nothing else: not its message, which can quote the email address,
 * and nothing the customer typed.
 */

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function fieldErrors(errors: object): Record<string, string> {
  return Object.fromEntries(Object.entries(errors).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

const NOT_CONNECTED: AuthFormState = { status: "error", code: "not_connected" };

type ProviderError = { code?: string | undefined; status?: number | undefined };

function logUnexpected(operation: string, error: ProviderError): void {
  console.error(`auth: ${operation} refused by the provider`, { code: error.code ?? "none", status: error.status ?? "none" });
}

/** Our status for a provider error; unexpected ones are also logged. */
function providerError(operation: string, error: ProviderError): AuthFormState {
  const code = authErrorFromSupabase(error.code, error.status);
  if (isUnexpectedAuthError(code)) logUnexpected(operation, error);
  return { status: "error", code };
}

export async function signInAction(_previous: AuthFormState, form: FormData): Promise<AuthFormState> {
  if (!authConfigured()) return NOT_CONNECTED;
  const values = { email: text(form, "email").trim(), password: text(form, "password") };
  const errors = fieldErrors(validateLogin(values));
  if (Object.keys(errors).length > 0) return { status: "invalid", fieldErrors: errors };

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword(values);
  if (error) return providerError("sign-in", error);
  redirect(safeNextPath(text(form, "next")));
}

export async function signUpAction(_previous: AuthFormState, form: FormData): Promise<AuthFormState> {
  if (!authConfigured()) return NOT_CONNECTED;
  const values = {
    fullName: text(form, "fullName"),
    email: text(form, "email").trim(),
    phone: text(form, "phone"),
    password: text(form, "password"),
    confirmPassword: text(form, "confirmPassword"),
    acceptTerms: form.get("acceptTerms") === "on" || form.get("acceptTerms") === "true",
  };
  const errors = fieldErrors(validateRegister(values));
  if (Object.keys(errors).length > 0) return { status: "invalid", fieldErrors: errors };

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email: values.email,
    password: values.password,
    options: {
      emailRedirectTo: `${siteOrigin()}/auth/confirm?next=/account`,
      data: { full_name: values.fullName.trim(), phone: normalizeTzPhone(values.phone) },
    },
  });
  if (error) return providerError("sign-up", error);
  // With email confirmation on (the expected setting) there is no session
  // yet; Supabase answers the same way for a new and an existing email, so
  // the page cannot be used to find out who has an account.
  if (!data.session) {
    return { status: "sent", text: "Check your email: we sent a link to confirm your account. Then sign in." };
  }
  redirect("/account");
}

export async function requestPasswordResetAction(_previous: AuthFormState, form: FormData): Promise<AuthFormState> {
  if (!authConfigured()) return NOT_CONNECTED;
  const values = { email: text(form, "email").trim() };
  const errors = fieldErrors(validateForgot(values));
  if (Object.keys(errors).length > 0) return { status: "invalid", fieldErrors: errors };

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
    redirectTo: `${siteOrigin()}/auth/confirm?next=/reset-password`,
  });
  // Same answer whether or not the email has an account, except for limits.
  // A refusal that is ours to fix still goes to the server log, or a reset
  // email that is never sent would leave no trace.
  if (error) {
    const code = authErrorFromSupabase(error.code, error.status);
    if (code === "rate_limited") return { status: "error", code };
    if (isUnexpectedAuthError(code)) logUnexpected("password reset request", error);
  }
  return { status: "sent", text: "If an account uses that email, a link to choose a new password is on its way." };
}

export async function updatePasswordAction(_previous: AuthFormState, form: FormData): Promise<AuthFormState> {
  if (!authConfigured()) return NOT_CONNECTED;
  const values = { password: text(form, "password"), confirmPassword: text(form, "confirmPassword") };
  const errors = fieldErrors(validateReset(values));
  if (Object.keys(errors).length > 0) return { status: "invalid", fieldErrors: errors };

  const supabase = await supabaseServer();
  // The reset link signs the customer in for this one purpose; without that
  // session there is nothing to update.
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { status: "error", code: "link_expired" };
  const { error } = await supabase.auth.updateUser({ password: values.password });
  if (error) return providerError("password update", error);
  redirect("/account");
}

export async function signOutAction(): Promise<void> {
  if (authConfigured()) {
    const supabase = await supabaseServer();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
