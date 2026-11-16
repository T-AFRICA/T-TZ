import "server-only";

/**
 * Best-effort fixed-window limiter for sign-in and second-factor attempts.
 * In memory, so each server instance counts on its own: it slows one client
 * hammering one instance and is not a global quota. Supabase Auth applies
 * its own limits behind it. A shared limiter is a release-gate item.
 */
const windows = new Map<string, { start: number; count: number }>();
const MAX_KEYS = 5_000;

export function allowAttempt(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const current = windows.get(key);
  if (!current || now - current.start >= windowMs) {
    if (!current && windows.size >= MAX_KEYS) {
      for (const [k, w] of windows) if (now - w.start >= windowMs) windows.delete(k);
      const oldest = windows.keys().next().value;
      if (windows.size >= MAX_KEYS && oldest !== undefined) windows.delete(oldest);
    }
    windows.set(key, { start: now, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= limit;
}

/** Client key from the hosting proxy's header (first hop), or a shared bucket when absent. */
export function clientKey(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || "unknown";
}
