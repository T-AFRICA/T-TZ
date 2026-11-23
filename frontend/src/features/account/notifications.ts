import type { CustomerNotificationKind } from "@tronic/database";

/**
 * What a customer reads for each kind of notification (migration 0023).
 * The database stores what happened and to which order; the wording lives
 * here, so it can change, or be translated, without touching stored rows.
 * Nothing in a notification is a promise the order record does not make.
 */
export const NOTIFICATION_TEXT: Record<CustomerNotificationKind, { title: string; body: string }> = {
  order_placed: { title: "Order received", body: "We have your order and will confirm it shortly." },
  confirmed: { title: "Order confirmed", body: "Your order is confirmed and will be prepared." },
  processing: { title: "Order being prepared", body: "We are getting your items ready." },
  packed: { title: "Order packed", body: "Your order is packed and waiting for the rider." },
  dispatched: { title: "Order picked up", body: "A rider has collected your order." },
  in_transit: { title: "Out for delivery", body: "Your order is on its way. Your delivery code is on the order page: give it to the rider." },
  delivered: { title: "Order delivered", body: "Your order was delivered. Thank you for shopping with TRONIC." },
  cancelled: { title: "Order cancelled", body: "This order was cancelled." },
  delivery_attempt: { title: "Delivery attempt not completed", body: "The rider could not hand over your order. It is still with the rider: please keep your phone on." },
  payment_received: { title: "Payment received", body: "We received the payment for this order." },
  payment_failed: { title: "Payment not completed", body: "The payment for this order was not completed." },
  refunded: { title: "Payment refunded", body: "The payment for this order was refunded." },
};

/** The kinds, in the order a customer meets them, for the "what you will be told about" list. */
export const NOTIFICATION_KIND_LABELS: readonly string[] = [
  "Order received",
  "Order confirmed",
  "Order being prepared and packed",
  "Picked up by the rider",
  "Out for delivery",
  "Delivered",
  "Delivery attempt not completed",
  "Cancellation",
];

/** The badge text for an unread count: the number, or "9+" past nine. */
export function unreadBadge(count: number): string | null {
  if (!Number.isFinite(count) || count < 1) return null;
  return count > 9 ? "9+" : String(Math.floor(count));
}

/** True for the errors Postgres raises when migration 0023 has not been applied: a missing table or function. */
export function notificationsMissing(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === "42P01" || code === "42883";
}
