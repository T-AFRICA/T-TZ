"use server";

import { ACTIVE_COUNTRY, payOnDeliveryRefusal } from "@tronic/country-config";
import { placeCodOrder, type Access, type LineProblem } from "@tronic/database";
import { currentUser } from "@/features/auth/server";
import { parseCart } from "@/features/cart/store";
import { getCatalog, getDb, ordersEnabled } from "@/features/data/source";
import { PAYMENT_POLICY, type DeliveryMethodId } from "./config";
import { MAX_CHECKOUT_LINES, quoteCheckout, type CheckoutQuote } from "./quote";
import { normalizeTzPhone, readCheckoutForm, validateCheckout, type CheckoutErrors } from "./validation";

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
  | { ok: false; reason: "unavailable" | "conflict" | "sign_in_required" }
  | { ok: false; reason: "invalid"; fieldErrors: CheckoutErrors }
  | { ok: false; reason: "price_changed"; totalMinor: number }
  | { ok: false; reason: "lines_unavailable"; problems: LineProblem[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Places a Cash on Delivery order (POST, server action). The browser sends
 * the lines, the form and the total it showed; this re-validates the form,
 * then the database reprices every line, checks and reserves stock and
 * saves the order in one transaction (place_cod_order). The idempotency
 * key makes a retried or double-clicked submit return the same order.
 * The customer's identity comes from the verified session only. Owner
 * decision 2026-11-19: no order without an account, so without a session
 * nothing is saved and the answer is "sign_in_required" (the database
 * refuses guests too, migration 0015). The page shows a confirmation only
 * after this returns ok, i.e. after the order is saved.
 */
export async function placeOrderAction(input: {
  idempotencyKey: unknown;
  lines: unknown;
  form: unknown;
  expectedTotalMinor: unknown;
}): Promise<PlaceOrderResponse> {
  if (!ordersEnabled()) return { ok: false, reason: "unavailable" };
  const user = await currentUser();
  if (!user) return { ok: false, reason: "sign_in_required" };

  const form = readCheckoutForm(input.form);
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

  // The country's cash-on-delivery limit, when TRONIC sets one, is checked
  // against the server's own price, never the total the browser sent.
  if (PAYMENT_POLICY.payOnDelivery.maxTotalMinor !== null) {
    const quote = await quoteCheckout(lines, "home", await getCatalog({ fresh: true }));
    if (payOnDeliveryRefusal(PAYMENT_POLICY, form.region, quote.totalMinor) !== null) {
      return { ok: false, reason: "invalid", fieldErrors: { paymentMethod: "Cash on delivery isn't available for an order of this amount. Choose another payment method." } };
    }
  }

  const access: Access = { role: "authenticated", userId: user.id };
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
