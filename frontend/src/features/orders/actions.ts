"use server";

import { trackOrder } from "@tronic/database";
import { DEFAULT_DIAL_CODE, normalizeWhatsApp } from "@/features/checkout/phone";
import { getDb, ordersEnabled } from "@/features/data/source";
import { allowAttempt } from "@/features/security/throttle";
import { ORDER_NUMBER_PATTERN } from "./status";

/**
 * Track Order's POST handler (server action). The order number and the
 * checkout email or phone arrive in the POST body, with or without
 * JavaScript, and the answer goes back in the response: neither ever
 * appears in a URL, a log or browser history.
 *
 * The answer is the order's status, total and date. It never includes the
 * delivery code: the rider is shown the order number and the customer's
 * phone, so that pair must not be enough to read the code that proves the
 * rider met the customer. The code is on the order's page in the signed-in
 * account (security audit 2026-11-21, F-01).
 */
export type TrackOrderState =
  | { status: "idle" }
  | { status: "unavailable" }
  | { status: "invalid"; fieldErrors: { orderNumber?: string; contact?: string } }
  | { status: "not_found" }
  /** Too many tries for this order or from this client; nothing was looked up. */
  | { status: "rate_limited" }
  | {
      status: "found";
      order: { orderNumber: string; status: string; createdAt: string; totalMinor: number; currency: string; itemCount: number };
      /** True while the order is on its way: the customer's code is waiting in their account. */
      codeInAccount: boolean;
    };

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function trackOrderAction(_previous: TrackOrderState, form: FormData): Promise<TrackOrderState> {
  if (!ordersEnabled()) return { status: "unavailable" };
  const orderNumber = text(form, "orderNumber");
  const contactRaw = text(form, "contact");
  const fieldErrors: { orderNumber?: string; contact?: string } = {};
  if (!ORDER_NUMBER_PATTERN.test(orderNumber)) fieldErrors.orderNumber = "Enter the order number from your confirmation.";
  if (contactRaw.length < 5 || contactRaw.length > 254) fieldErrors.contact = "Enter the WhatsApp number or email used at checkout.";
  if (fieldErrors.orderNumber || fieldErrors.contact) return { status: "invalid", fieldErrors };
  // The phone or email is the only secret here; without a limit it can be guessed.
  if (!(await allowAttempt("trackOrder", orderNumber))) return { status: "rate_limited" };

  // Orders store the number as +<country code><number>; accept it as typed at checkout too: with a plus sign
  // and spaces for any country, or the Tanzanian way (0712 345 678).
  const contact = contactRaw.includes("@") ? contactRaw : (normalizeWhatsApp(contactRaw, DEFAULT_DIAL_CODE) ?? contactRaw);
  const found = await trackOrder(getDb(), orderNumber, contact);
  if (!found.found) return { status: "not_found" };
  const { orderNumber: number, status, createdAt, totalMinor, currency, itemCount } = found;
  const codeInAccount = status === "dispatched" || status === "in_transit";
  return { status: "found", order: { orderNumber: number, status, createdAt, totalMinor, currency, itemCount }, codeInAccount };
}
