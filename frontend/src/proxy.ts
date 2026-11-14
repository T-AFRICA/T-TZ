import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Customer sessions (Supabase Auth via @supabase/ssr), on the account pages
 * and on the sign-in and register pages.
 *
 * - Account pages: the session cookies are refreshed and signed-out
 *   visitors go to /login. The account pages check the user again on the
 *   server, so this is a convenience, not the only guard.
 * - Sign-in and register pages: a signed-in customer goes to /account.
 *   Without a session cookie nothing is asked of the Auth server.
 * - A session that has ended somewhere else (signed out on another device,
 *   expired, revoked) leaves its cookie behind in this browser. When the
 *   Auth server says the session is not valid, the cookie is removed here,
 *   where a response can still set cookies; otherwise every later page
 *   would ask about the same dead session again. A cookie is kept when the
 *   Auth server could not be reached: that says nothing about the session.
 *
 * Other routes are untouched.
 */
const SESSION_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;

function sessionCookieNames(request: NextRequest): string[] {
  return request.cookies
    .getAll()
    .map((cookie) => cookie.name)
    .filter((name) => SESSION_COOKIE.test(name));
}

/** True when the Auth server answered that there is no valid session (not when it gave no answer). */
function sessionIsGone(error: { name?: string; status?: number } | null): boolean {
  if (!error || error.name === "AuthSessionMissingError") return true;
  const status = error.status ?? 0;
  return status >= 400 && status < 500 && status !== 429;
}

/** Copies cookies the session client set (a refreshed token, or its own clean-up) onto another response. */
function carryCookies(from: NextResponse, to: NextResponse): NextResponse {
  for (const cookie of from.cookies.getAll()) to.cookies.set(cookie);
  return to;
}

function expireCookies(response: NextResponse, names: readonly string[]): NextResponse {
  for (const name of names) response.cookies.set(name, "", { path: "/", maxAge: 0 });
  return response;
}

export async function proxy(request: NextRequest) {
  const accountPage = request.nextUrl.pathname === "/account" || request.nextUrl.pathname.startsWith("/account/");
  const toLogin = () => NextResponse.redirect(new URL("/login", request.url), 303);

  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return accountPage ? toLogin() : NextResponse.next();

  const sessionCookies = sessionCookieNames(request);
  if (!accountPage && sessionCookies.length === 0) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
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

  if (data.user) {
    if (accountPage) return response;
    return carryCookies(response, NextResponse.redirect(new URL("/account", request.url), 303));
  }

  const gone = sessionIsGone(error);
  if (accountPage) {
    const redirect = carryCookies(response, toLogin());
    return gone ? expireCookies(redirect, sessionCookies) : redirect;
  }
  if (!gone) return response;
  // The sign-in or register page, with the cookie of a session that has
  // ended: show the form, and drop the cookie for this request and the browser.
  for (const name of sessionCookies) request.cookies.delete(name);
  return expireCookies(carryCookies(response, NextResponse.next({ request })), sessionCookies);
}

export const config = {
  matcher: ["/account/:path*", "/login/:path*", "/register"],
};
