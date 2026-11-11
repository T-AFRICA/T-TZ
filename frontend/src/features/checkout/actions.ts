"use server";

import { ACTIVE_COUNTRY } from "@tronic/country-config";
import { ANON, placeCodOrder, type Access, type LineProblem } from "@tronic/database";
import { currentUser } from "@/features/auth/server";
import { parseCart } from "@/features/cart/store";
import { getCatalog, getDb, ordersEnabled } from "@/features/data/source";
import type { DeliveryMethodId } from "./config";
import { MAX_CHECKOUT_LINES, quoteCheckout, type CheckoutQuote } from "./quote";
import { EMPTY_CHECKOUT_FORM, normalizeTzPhone, validateCheckout, type CheckoutErrors, type CheckoutForm } from "./validation";

/**
 * Server action: prices the checkout lines the browser holds (cart or Buy
 * Now). Input is untrusted and re-validated inside quoteCheckout; the
 * response carries catalogue prices only. No order is created here.
 */
export async function getCheckoutQuote(lines: unknown, deliveryMethod: unknown): Promise<CheckoutQuote> {
  const method: DeliveryMethodId = deliveryMethod === "pickup" ? "pickup" : "home";
  return quoteCheckout(lines, method, await getCatalog({ fresh: true }));
}

export type PlaceOrderResponse =
  | { ok: true; orderNumber: string; totalMinor: number; currency: string; itemCount: number }
  | { ok: false; reason: "unavailable" | "conflict" }
  | { ok: false; reason: "invalid"; fieldErrors: CheckoutErrors }
  | { ok: false; reason: "price_changed"; totalMinor: number }
  | { ok: false; reason: "lines_unavailable"; problems: LineProblem[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Copies only the known checkout fields, as strings, from untrusted input. */
function readForm(raw: unknown): CheckoutForm {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const form = { ...EMPTY_CHECKOUT_FORM };
  for (const key of Object.keys(form) as (keyof CheckoutForm)[]) {
    const value = source[key];
    if (typeof value === "string") (form as Record<string, string>)[key] = value;
  }
  return form;
}

/**
 * Places a Cash on Delivery order (POST, server action). The browser sends
 * the lines, the form and the total it showed; this re-validates the form,
 * then the database reprices every line, checks and reserves stock and
 * saves the order in one transaction (place_cod_order). The idempotency
 * key makes a retried or double-clicked submit return the same order.
 * The customer's identity comes from the verified session only; without
 * one the order is a guest order. The page shows a confirmation only after
 * this returns ok, i.e. after the order is saved.
 */
export async function placeOrderAction(input: {
  idempotencyKey: unknown;
  lines: unknown;
  form: unknown;
  expectedTotalMinor: unknown;
}): Promise<PlaceOrderResponse> {
  if (!ordersEnabled()) return { ok: false, reason: "unavailable" };

  const form = readForm(input.form);
  const fieldErrors = validateCheckout(form);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, reason: "invalid", fieldErrors };
  const phone = normalizeTzPhone(form.phone);
  const lines = parseCart(input.lines).slice(0, MAX_CHECKOUT_LINES);
  if (
    form.paymentMethod !== "pay_on_delivery" ||
    form.deliveryMethod !== "home" ||
    !phone ||
    lines.length === 0 ||
    typeof input.idempotencyKey !== "string" ||
    !UUID.test(input.idempotencyKey)
  ) {
    return { ok: false, reason: "invalid", fieldErrors: {} };
  }
  const expected = input.expectedTotalMinor;
  const expectedTotalMinor = typeof expected === "number" && Number.isSafeInteger(expected) && expected >= 0 ? expected : null;

  const user = await currentUser();
  const access: Access = user ? { role: "authenticated", userId: user.id } : ANON;
  const result = await placeCodOrder(getDb(), access, {
    idempotencyKey: input.idempotencyKey,
    country: ACTIVE_COUNTRY.code,
    contact: { name: form.fullName.trim(), email: form.email.trim(), phone },
    delivery: {
      method: "home",
      region: form.region,
      district: form.district.trim(),
      ward: form.ward.trim(),
      street: form.street.trim(),
      extra: form.addressExtra.trim(),
      notes: form.instructions.trim(),
    },
    lines: lines.map((line) => ({ product: line.productId, color: line.color, variant: line.variant, quantity: line.quantity })),
    expectedTotalMinor,
  });

  if (result.ok) {
    return { ok: true, orderNumber: result.orderNumber, totalMinor: result.totalMinor, currency: result.currency, itemCount: result.itemCount };
  }
  switch (result.code) {
    case "price_changed":
      return { ok: false, reason: "price_changed", totalMinor: result.totalMinor };
    case "lines_unavailable":
      return { ok: false, reason: "lines_unavailable", problems: result.problems };
    case "idempotency_conflict":
      return { ok: false, reason: "conflict" };
    default:
      return { ok: false, reason: "invalid", fieldErrors: {} };
  }
}
