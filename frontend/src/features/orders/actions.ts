"use server";

import { trackOrder } from "@tronic/database";
import { normalizeTzPhone } from "@/features/checkout/validation";
import { getDb, ordersEnabled } from "@/features/data/source";
import { ORDER_NUMBER_PATTERN } from "./status";

/**
 * Track Order's POST handler (server action). The order number and the
 * checkout email or phone arrive in the POST body, with or without
 * JavaScript, and the answer goes back in the response: neither ever
 * appears in a URL, a log or browser history.
 */
export type TrackOrderState =
  | { status: "idle" }
  | { status: "unavailable" }
  | { status: "invalid"; fieldErrors: { orderNumber?: string; contact?: string } }
  | { status: "not_found" }
  | {
      status: "found";
      order: { orderNumber: string; status: string; createdAt: string; totalMinor: number; currency: string; itemCount: number };
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
  if (contactRaw.length < 5 || contactRaw.length > 254) fieldErrors.contact = "Enter the phone number or email used at checkout.";
  if (fieldErrors.orderNumber || fieldErrors.contact) return { status: "invalid", fieldErrors };

  // Orders store the phone as +255…; accept it as typed at checkout too.
  const contact = contactRaw.includes("@") ? contactRaw : (normalizeTzPhone(contactRaw) ?? contactRaw);
  const found = await trackOrder(getDb(), orderNumber, contact);
  if (!found.found) return { status: "not_found" };
  const { orderNumber: number, status, createdAt, totalMinor, currency, itemCount } = found;
  return { status: "found", order: { orderNumber: number, status, createdAt, totalMinor, currency, itemCount } };
}
