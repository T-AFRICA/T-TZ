import { headers } from "next/headers";
import { clientKey, createRateLimiter, type RateLimiter } from "@/features/search/rate-limit";

/**
 * Attempt limits for the forms that can be used to guess something: a
 * password (sign-in), an order's phone or email (Track Order), or to make
 * the site send email (sign-up, password reset).
 *
 * Each kind counts twice: per target (the email address, or the order
 * number) and per client address. The target count is what slows guessing
 * from many addresses; the address count is a high ceiling, because many
 * customers share one address behind a mobile network.
 *
 * Like the search limiter this is in memory, so each server instance counts
 * on its own and counts reset on a cold start. It slows an attacker down;
 * it is not a global quota. A shared limiter (an edge or WAF rule, or a
 * hosted store) and Supabase Auth's own limits and CAPTCHA are still needed
 * and are listed in docs/security/SECURITY_CHECKLIST.md.
 */
const WINDOW_MS = 10 * 60_000;

const LIMITS = {
  signIn: { perTarget: 20, perClient: 100 },
  signUp: { perTarget: 5, perClient: 30 },
  passwordReset: { perTarget: 3, perClient: 30 },
  trackOrder: { perTarget: 20, perClient: 100 },
} as const;

export type AttemptKind = keyof typeof LIMITS;

export interface Throttle {
  /** Records one attempt; false when the target or the client is over its limit. */
  allow(kind: AttemptKind, target: string, client: string, now?: number): boolean;
}

export function createThrottle(windowMs: number = WINDOW_MS): Throttle {
  const limiters = new Map<string, RateLimiter>();
  const limiter = (name: string, limit: number): RateLimiter => {
    let found = limiters.get(name);
    if (!found) {
      found = createRateLimiter({ limit, windowMs });
      limiters.set(name, found);
    }
    return found;
  };
  return {
    allow(kind, target, client, now) {
      const limits = LIMITS[kind];
      // Both are counted on every attempt, whichever refuses.
      const targetOk = limiter(`${kind}:target`, limits.perTarget).allow(target.trim().toLowerCase(), now);
      const clientOk = limiter(`${kind}:client`, limits.perClient).allow(client, now);
      return targetOk && clientOk;
    },
  };
}

const throttle = createThrottle();

/** For server actions: counts this request's attempt at `target`. */
export async function allowAttempt(kind: AttemptKind, target: string): Promise<boolean> {
  return throttle.allow(kind, target, clientKey(await headers()));
}
