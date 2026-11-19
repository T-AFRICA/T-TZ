/**
 * Where a customer goes after signing in or registering. Shared by the
 * server (actions, the email-link route) and the forms, so it imports
 * nothing server-only. Only same-site paths are followed.
 */

/** Only same-site paths are followed after sign-in or an email link. */
export function safeNextPath(value: unknown, fallback = "/account"): string {
  return typeof value === "string" && /^\/(?!\/)[\w\-./?=&%]*$/.test(value) && !value.startsWith("/\\") ? value : fallback;
}

/** The `next` a page was opened with, or null when there is none (or it is not a safe path, or it is the account). */
export function readNext(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const next = safeNextPath(raw, "");
  return next && next !== "/account" ? next : null;
}

/** `path` with `?next=` when there is somewhere to go back to. */
export function withNext(path: string, next: string | null): string {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}

/** True when the customer was sent here from checkout. */
export function fromCheckout(next: string | null): boolean {
  return next === "/checkout" || (next?.startsWith("/checkout?") ?? false);
}

/** Owner decision 2026-11-19: no order without an account. Shown on sign-in and registration when checkout sent the customer. */
export const CHECKOUT_SIGN_IN_NOTICE = "Sign in or create an account to place your order. Your cart is saved, and you come straight back to checkout.";
