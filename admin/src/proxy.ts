import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Keeps the administrator's session cookies fresh and sends visitors
 * without a session to the sign-in page.
 *
 * This is a convenience, not the guard: every page and every server action
 * verifies the session, the account's status, the second factor and the
 * permission itself (server/session.ts), and the database checks again.
 *
 * - No session cookie: console pages redirect to /sign-in without asking
 *   the Auth server anything.
 * - A session that has ended elsewhere (signed out, expired, revoked)
 *   leaves its cookie behind. When the Auth server says it is not valid the
 *   cookie is removed here, where a response can still set cookies. A
 *   cookie is kept when the Auth server could not be reached: that says
 *   nothing about the session.
 */
const SESSION_COOKIE = /^sb-tronic-admin-auth-token(\.\d+)?$/;
const SIGN_IN = "/sign-in";

function sessionIsGone(error: { name?: string; status?: number } | null): boolean {
  if (!error || error.name === "AuthSessionMissingError") return true;
  const status = error.status ?? 0;
  return status >= 400 && status < 500 && status !== 429;
}

export async function proxy(request: NextRequest) {
  const onSignIn = request.nextUrl.pathname === SIGN_IN;
  const toSignIn = () => NextResponse.redirect(new URL(SIGN_IN, request.url), 303);

  const url = process.env.ADMIN_SUPABASE_URL?.trim();
  const key = process.env.ADMIN_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return onSignIn ? NextResponse.next() : toSignIn();

  const sessionCookies = request.cookies
    .getAll()
    .map((cookie) => cookie.name)
    .filter((name) => SESSION_COOKIE.test(name));
  if (sessionCookies.length === 0) return onSignIn ? NextResponse.next() : toSignIn();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    // A provider that never answers must not hold every page open (10 seconds).
    global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(10_000) }) },
    cookieOptions: { name: "sb-tronic-admin-auth-token", sameSite: "lax", secure: process.env.NODE_ENV === "production", httpOnly: true },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (data.user) return response;
  if (!sessionIsGone(error)) return response;

  // The session has ended: drop its cookies for this request and the browser.
  for (const name of sessionCookies) request.cookies.delete(name);
  const next = onSignIn ? NextResponse.next({ request }) : toSignIn();
  for (const cookie of response.cookies.getAll()) next.cookies.set(cookie);
  for (const name of sessionCookies) next.cookies.set(name, "", { path: "/", maxAge: 0 });
  return next;
}

export const config = {
  // Everything except Next.js internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|brand/).*)"],
};
