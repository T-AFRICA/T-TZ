"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { SESSION_HINT_COOKIE } from "./cookies";

/**
 * A hint, for labels and links only, that this browser has a customer
 * session: the header says "Account" and links to /account instead of
 * "Login". It decides nothing. Every account page still verifies the
 * session with Supabase Auth on the server, so a stale or forged hint only
 * leads to the sign-in page.
 *
 * The session cookies themselves are HttpOnly, so the page cannot see
 * them. The server keeps a separate cookie beside them (cookies.ts) that
 * holds no token: only "1" while a session cookie is stored.
 */
const HINT = new RegExp(`(?:^|;\\s*)${SESSION_HINT_COOKIE}=1(?:;|$)`);

export function hasSignedInHint(cookies: string): boolean {
  return HINT.test(cookies);
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("focus", onChange);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.removeEventListener("focus", onChange);
    document.removeEventListener("visibilitychange", onChange);
  };
}

/** True while the hint cookie is present. Always false on the server and until hydration. */
export function useSignedInHint(): boolean {
  // Signing in and out both end in a navigation; re-read the cookie then.
  usePathname();
  return useSyncExternalStore(
    subscribe,
    () => hasSignedInHint(document.cookie),
    () => false,
  );
}
