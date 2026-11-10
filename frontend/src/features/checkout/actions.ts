"use server";

import type { DeliveryMethodId } from "./config";
import { quoteCheckout, type CheckoutQuote } from "./quote";

/**
 * Server action: prices the checkout lines the browser holds (cart or Buy
 * Now). Input is untrusted and re-validated inside quoteCheckout; the
 * response carries catalogue prices only. No order is created here.
 */
export async function getCheckoutQuote(lines: unknown, deliveryMethod: unknown): Promise<CheckoutQuote> {
  const method: DeliveryMethodId = deliveryMethod === "pickup" ? "pickup" : "home";
  return quoteCheckout(lines, method);
}
