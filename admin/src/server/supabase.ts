import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { fetchWithTimeout, supabaseSettings } from "./config";

/**
 * Supabase Auth of the Central Admin project, on the server. The browser
 * never talks to Supabase: forms post to server actions, which call
 * Supabase here and keep the session in httpOnly cookies managed by
 * @supabase/ssr. There is no sign-up call anywhere in this application.
 */
export async function supabaseServer() {
  const { url, anonKey } = supabaseSettings();
  const store = await cookies();
  return createServerClient(url, anonKey, {
    global: { fetch: fetchWithTimeout },
    cookieOptions: { name: "sb-tronic-admin-auth-token", sameSite: "lax", secure: process.env.NODE_ENV === "production", httpOnly: true },
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

export const ADMIN_SESSION_COOKIE = /^sb-tronic-admin-auth-token(\.\d+)?$/;
