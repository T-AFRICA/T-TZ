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
  | "weak_password"
  | "link_expired"
  | "rate_limited"
  | "network";

/** Shown while Supabase Auth is not configured for this deployment. */
export const AUTH_NOT_CONNECTED_MESSAGE = "Authentication will be available when account services are connected.";

export const AUTH_ERROR_TEXT: Record<AuthErrorCode, string> = {
  not_connected: AUTH_NOT_CONNECTED_MESSAGE,
  invalid_credentials: "That email and password don't match an account.",
  email_not_confirmed: "Confirm your email first: open the link we sent you, then sign in.",
  email_taken: "An account with this email already exists. Try signing in.",
  weak_password: "Choose a stronger password.",
  link_expired: "This reset link has expired or was already used. Request a new one.",
  rate_limited: "Too many attempts. Wait a minute and try again.",
  network: "We couldn't reach our servers. Check your connection and try again.",
};

/** Maps a Supabase Auth error code (AuthError.code) to ours. */
export function authErrorFromSupabase(code: string | undefined, status?: number): AuthErrorCode {
  switch (code) {
    case "invalid_credentials":
      return "invalid_credentials";
    case "email_not_confirmed":
      return "email_not_confirmed";
    case "user_already_exists":
    case "email_exists":
      return "email_taken";
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
      return status === 429 ? "rate_limited" : status === 400 ? "invalid_credentials" : "network";
  }
}
