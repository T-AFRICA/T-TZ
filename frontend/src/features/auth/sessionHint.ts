"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

/**
 * A hint, for labels and links only, that this browser has a customer
 * session: the header says "Account" and links to /account instead of
 * "Login". It decides nothing. Every account page still verifies the
 * session with Supabase Auth on the server, so a stale or forged hint only
 * leads to the sign-in page.
 *
 * It looks for the session cookie @supabase/ssr keeps, named
 * "sb-<project>-auth-token" (in numbered parts when long), which is
 * readable by the page by that library's default. Should that cookie
 * become HttpOnly, the hint is simply false: the header says "Login" and
 * the sign-in page still sends a signed-in customer on to their account.
 */
export function hasSessionCookie(cookies: string): boolean {
  return /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=[^;]/.test(cookies);
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("focus", onChange);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.removeEventListener("focus", onChange);
    document.removeEventListener("visibilitychange", onChange);
  };
}

/** True while the session cookie is present. Always false on the server and until hydration. */
export function useSignedInHint(): boolean {
  // Signing in and out both end in a navigation; re-read the cookie then.
  usePathname();
  return useSyncExternalStore(
    subscribe,
    () => hasSessionCookie(document.cookie),
    () => false,
  );
}
