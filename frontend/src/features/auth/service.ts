/**
 * Account error codes and the customer-facing text for each. Provider
 * details never reach the page: Supabase Auth errors are mapped to these
 * codes in features/auth/actions.ts. Values are never logged.
 */
export type AuthErrorCode =
  | "not_connected"
  | "invalid_credentials"
  | "email_not_confirmed"
  | "email_taken"
  | "email_invalid"
  | "weak_password"
  | "link_expired"
  | "rate_limited"
  | "unavailable"
  | "network";

/**
 * Where a registration ends when the provider opened no session (email
 * confirmation on): the sign-in page with AUTH_REGISTERED_NOTICE above an
 * empty form. A path of its own, so the address has no query string and
 * nothing the customer typed.
 */
export const AUTH_REGISTERED_PATH = "/login/registered";
export const AUTH_REGISTERED_NOTICE = "Check your email: we sent a link to confirm your account. Then sign in.";

/** Shown while Supabase Auth is not configured for this deployment. */
export const AUTH_NOT_CONNECTED_MESSAGE = "Authentication will be available when account services are connected.";

export const AUTH_ERROR_TEXT: Record<AuthErrorCode, string> = {
  not_connected: AUTH_NOT_CONNECTED_MESSAGE,
  invalid_credentials: "That email and password don't match an account.",
  email_not_confirmed: "Confirm your email first: open the link we sent you, then sign in.",
  email_taken: "An account with this email already exists. Try signing in.",
  email_invalid: "We can't use this email address. Check it for typos or use another one.",
  weak_password: "Choose a stronger password.",
  link_expired: "This reset link has expired or was already used. Request a new one.",
  rate_limited: "Too many attempts. Wait a minute and try again.",
  unavailable: "We couldn't complete this right now. Please try again later.",
  network: "We couldn't reach our servers. Check your connection and try again.",
};

/**
 * Maps a Supabase Auth error (AuthError.code and HTTP status) to ours.
 *
 * Only a code that says so becomes "invalid_credentials". Anything the
 * provider refuses for a reason not listed here is "unavailable": that
 * covers account-service settings the customer cannot fix (sign-ups or the
 * email provider turned off, CAPTCHA required, an email sender that only
 * delivers to authorised addresses), so a refused sign-up is never
 * reported as a wrong password.
 */
export function authErrorFromSupabase(code: string | undefined, status?: number): AuthErrorCode {
  switch (code) {
    case "invalid_credentials":
      return "invalid_credentials";
    case "email_not_confirmed":
      return "email_not_confirmed";
    case "user_already_exists":
    case "email_exists":
      return "email_taken";
    case "email_address_invalid":
      return "email_invalid";
    case "weak_password":
    case "same_password":
      return "weak_password";
    case "otp_expired":
    case "flow_state_expired":
    case "session_not_found":
    case "session_expired":
      return "link_expired";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "rate_limited";
    default:
      if (status === 429) return "rate_limited";
      // No HTTP status: the request never got an answer.
      if (status === undefined || status === 0) return "network";
      return "unavailable";
  }
}

/** Codes that mean something is wrong on our side, worth a line in the server log. */
export function isUnexpectedAuthError(code: AuthErrorCode): boolean {
  return code === "unavailable" || code === "network";
}
