/**
 * The customer session cookies, and the hint that goes with them.
 *
 * @supabase/ssr writes the session (access and refresh tokens) into cookies
 * named "sb-<project>-auth-token", in numbered parts when long. By that
 * library's default they are readable by scripts in the page and are not
 * marked Secure. Here they are HttpOnly, and Secure in production, so a
 * script injected into a page cannot read the tokens.
 *
 * Because the page can no longer see the session cookie, a second cookie
 * says only "this browser has a session": the header uses it to label its
 * button "Account" instead of "Login" (sessionHint.ts). It holds no token,
 * decides nothing, and every account page still verifies the session with
 * Supabase Auth on the server.
 */
export const SESSION_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;

export const SESSION_HINT_COOKIE = "tronic-signed-in";

const SECURE = process.env.NODE_ENV === "production";
const HINT_MAX_AGE = 400 * 24 * 60 * 60;

/** Passed to @supabase/ssr as `cookieOptions` by every server client. */
export const SESSION_COOKIE_OPTIONS = { httpOnly: true, secure: SECURE, sameSite: "lax", path: "/" } as const;

interface WrittenCookie {
  name: string;
  value: string;
  options?: { maxAge?: number | undefined } | undefined;
}

/**
 * What the hint becomes after the session client wrote these cookies: "set"
 * when a session cookie was stored, "clear" when the session cookies were
 * only removed, null when no session cookie was touched.
 */
export function hintChange(list: readonly WrittenCookie[]): "set" | "clear" | null {
  const session = list.filter((cookie) => SESSION_COOKIE.test(cookie.name));
  if (session.length === 0) return null;
  return session.some((cookie) => cookie.value !== "" && cookie.options?.maxAge !== 0) ? "set" : "clear";
}

/** The hint cookie to write for a change: readable by the page, never a token. */
export function hintCookie(change: "set" | "clear") {
  return {
    name: SESSION_HINT_COOKIE,
    value: change === "set" ? "1" : "",
    options: { httpOnly: false, secure: SECURE, sameSite: "lax", path: "/", maxAge: change === "set" ? HINT_MAX_AGE : 0 } as const,
  };
}
