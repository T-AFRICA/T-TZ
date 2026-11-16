import "server-only";

/**
 * Configuration of the Central Admin server. Every value is a server-only
 * environment variable of the admin deployment; none is NEXT_PUBLIC_ and
 * none reaches the browser. The names differ from the storefront's on
 * purpose, so a country's settings can never be picked up by mistake.
 *
 *   ADMIN_SUPABASE_URL        the Central Admin Supabase project URL
 *   ADMIN_SUPABASE_ANON_KEY   that project's anon (publishable) key
 *   ADMIN_DATABASE_URL        that project's pooled connection string
 *   COUNTRY_API_SIGNING_KEY     PKCS#8 P-256 private key that signs requests to country APIs
 *   COUNTRY_API_SIGNING_KEY_ID  the name the countries know that key by
 *
 * Without the first three the application is "not connected": it shows a
 * notice and refuses every sign-in and every action.
 */
export function adminConfigured(): boolean {
  return Boolean(
    process.env.ADMIN_SUPABASE_URL?.trim() && process.env.ADMIN_SUPABASE_ANON_KEY?.trim() && process.env.ADMIN_DATABASE_URL?.trim(),
  );
}

export function supabaseSettings(): { url: string; anonKey: string } {
  const url = process.env.ADMIN_SUPABASE_URL?.trim();
  const anonKey = process.env.ADMIN_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) throw new Error("The Central Admin account service is not configured");
  return { url, anonKey };
}

/** How long a call to the account service may take before it counts as unanswered. */
export const ACCOUNT_SERVICE_TIMEOUT_MS = 10_000;

/**
 * fetch with that limit, for the Supabase client. Without it a provider that
 * accepts a connection and never answers would hold a page or an action open
 * for good; with it the call fails and the caller treats the session as
 * unverified (pages) or reports that it could not be completed (actions).
 */
export const fetchWithTimeout: typeof fetch = (input, init) =>
  fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(ACCOUNT_SERVICE_TIMEOUT_MS) });

export function databaseUrl(): string {
  const url = process.env.ADMIN_DATABASE_URL?.trim();
  if (!url) throw new Error("The Central Admin database is not configured");
  return url;
}

/** The signing key for country API requests, or null while none is configured. */
export function countryApiSigningKey(): { privateKeyPem: string; keyId: string } | null {
  const privateKeyPem = process.env.COUNTRY_API_SIGNING_KEY?.replace(/\\n/g, "\n").trim();
  const keyId = process.env.COUNTRY_API_SIGNING_KEY_ID?.trim();
  return privateKeyPem && keyId ? { privateKeyPem, keyId } : null;
}
