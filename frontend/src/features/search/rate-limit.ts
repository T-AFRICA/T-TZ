/**
 * Best-effort fixed-window rate limiter for the public search route.
 *
 * In-memory, so each server instance counts on its own and counts reset on
 * a cold start: it blunts a single client hammering one instance, it is not
 * a global quota. A shared limiter (an edge/WAF rule or a hosted store) is
 * a release-gate item once the live catalogue is behind the route; nothing
 * paid is introduced here.
 */
export interface RateLimiter {
  /** Records one request for `key`; false when the key is over its limit. */
  allow(key: string, now?: number): boolean;
}

export function createRateLimiter({
  limit,
  windowMs,
  maxKeys = 5_000,
}: {
  limit: number;
  windowMs: number;
  /** Upper bound on tracked keys so memory cannot grow without limit. */
  maxKeys?: number;
}): RateLimiter {
  const windows = new Map<string, { start: number; count: number }>();

  return {
    allow(key, now = Date.now()) {
      const current = windows.get(key);
      if (!current || now - current.start >= windowMs) {
        if (!current && windows.size >= maxKeys) {
          for (const [k, w] of windows) {
            if (now - w.start >= windowMs) windows.delete(k);
          }
          if (windows.size >= maxKeys) {
            // Still full of live windows: drop the oldest entry.
            const oldest = windows.keys().next().value;
            if (oldest !== undefined) windows.delete(oldest);
          }
        }
        windows.set(key, { start: now, count: 1 });
        return true;
      }
      current.count += 1;
      return current.count <= limit;
    },
  };
}

/** Client key from the proxy header (first hop), or a shared bucket when absent. */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}
