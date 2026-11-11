/**
 * The boundary between the account forms and the future auth provider
 * (Supabase Auth, connected later). Forms call these four functions and
 * render the result; they never talk to a provider directly.
 *
 * Until auth is connected every call returns `not_connected`: nothing is
 * sent anywhere, nothing is stored, and no session exists. There are no
 * mock users, tokens or passwords. Values are never logged.
 */
export type AuthErrorCode =
  | "not_connected"
  | "invalid_credentials"
  | "email_taken"
  | "weak_password"
  | "link_expired"
  | "rate_limited"
  | "network";

export type AuthResult = { ok: true } | { ok: false; code: AuthErrorCode };

export interface AuthService {
  signIn(input: { email: string; password: string; remember: boolean }): Promise<AuthResult>;
  signUp(input: { fullName: string; email: string; phone: string; password: string }): Promise<AuthResult>;
  requestPasswordReset(input: { email: string }): Promise<AuthResult>;
  updatePassword(input: { password: string }): Promise<AuthResult>;
}

export const AUTH_CONNECTED = false;

/** Shown when a valid form is submitted while auth is not connected. */
export const AUTH_NOT_CONNECTED_MESSAGE = "Authentication will be available when account services are connected.";

/** Customer-facing text for each failure; provider details never reach the page. */
export const AUTH_ERROR_TEXT: Record<AuthErrorCode, string> = {
  not_connected: AUTH_NOT_CONNECTED_MESSAGE,
  invalid_credentials: "That email and password don't match an account.",
  email_taken: "An account with this email already exists. Try signing in.",
  weak_password: "Choose a stronger password.",
  link_expired: "This reset link has expired. Request a new one.",
  rate_limited: "Too many attempts. Wait a minute and try again.",
  network: "We couldn't reach our servers. Check your connection and try again.",
};

const notConnected = async (): Promise<AuthResult> => ({ ok: false, code: "not_connected" });

export const authService: AuthService = {
  signIn: notConnected,
  signUp: notConnected,
  requestPasswordReset: notConnected,
  updatePassword: notConnected,
};
