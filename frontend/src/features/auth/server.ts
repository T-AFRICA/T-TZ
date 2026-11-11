import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";

/**
 * Supabase Auth on the server. The browser never talks to Supabase: the
 * forms post to server actions, which call Supabase here and keep the
 * session in httpOnly cookies managed by @supabase/ssr.
 *
 * Configuration (server-only environment variables):
 *   SUPABASE_URL       the project URL
 *   SUPABASE_ANON_KEY  the project's anon (publishable) key
 *   WEB_ORIGIN         this site's origin, for the links in auth emails
 * Without SUPABASE_URL and SUPABASE_ANON_KEY auth is off: the account forms
 * render with submission disabled and every action refuses.
 */
export function authConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_ANON_KEY?.trim());
}

export function siteOrigin(): string {
  return (process.env.WEB_ORIGIN?.trim() || "http://localhost:3000").replace(/\/+$/, "");
}

/** A Supabase client bound to this request's cookies (server components, actions, route handlers). */
export async function supabaseServer() {
  if (!authConfigured()) throw new Error("Supabase Auth is not configured");
  const store = await cookies();
  return createServerClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_ANON_KEY as string, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Server components cannot set cookies; the proxy refreshes them.
        }
      },
    },
  });
}

export interface SessionUser {
  id: string;
  email: string | null;
  fullName: string | null;
  phone: string | null;
}

/**
 * The signed-in customer, verified with Supabase Auth (getUser checks the
 * token with the Auth server; a cookie alone is never trusted), or null.
 */
export async function currentUser(): Promise<SessionUser | null> {
  // Always per request: a page that asks who is signed in must never be
  // prerendered with the answer from build time.
  await connection();
  if (!authConfigured()) return null;
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const meta = data.user.user_metadata as Record<string, unknown> | undefined;
  return {
    id: data.user.id,
    email: data.user.email ?? null,
    fullName: typeof meta?.full_name === "string" ? meta.full_name : null,
    phone: typeof meta?.phone === "string" ? meta.phone : null,
  };
}

/** Only same-site paths are followed after sign-in or an email link. */
export function safeNextPath(value: unknown, fallback = "/account"): string {
  return typeof value === "string" && /^\/(?!\/)[\w\-./?=&%]*$/.test(value) && !value.startsWith("/\\") ? value : fallback;
}

/**
 * authConfigured() read at request time. Account pages use this so the
 * forms follow the server's current configuration instead of the value
 * baked in at build time.
 */
export async function authEnabledForRequest(): Promise<boolean> {
  await connection();
  return authConfigured();
}
