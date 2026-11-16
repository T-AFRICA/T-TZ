import { ORDER_STATUSES, type OrderStatus } from "@tronic/api-contracts";

/** Display text for order values that come from a country. Nothing here decides what an order may do: the country does. */

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Awaiting confirmation",
  confirmed: "Confirmed",
  processing: "Processing",
  packed: "Packed",
  dispatched: "Dispatched",
  in_transit: "In transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const ORDER_STATUS_TONE: Record<OrderStatus, "ok" | "neutral" | "warn" | "danger" | "info"> = {
  pending_payment: "warn",
  confirmed: "info",
  processing: "info",
  packed: "info",
  dispatched: "info",
  in_transit: "info",
  delivered: "ok",
  cancelled: "danger",
};

/** The button that moves an order to a status. */
export const ORDER_STEP_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Mark as awaiting confirmation",
  confirmed: "Confirm order",
  processing: "Start processing",
  packed: "Mark as packed",
  dispatched: "Mark as dispatched",
  in_transit: "Mark as in transit",
  delivered: "Mark as delivered",
  cancelled: "Cancel order",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = { pending: "Payment pending", paid: "Paid", failed: "Payment failed", refunded: "Refunded" };
const PAYMENT_METHOD_LABEL: Record<string, string> = { pay_on_delivery: "Cash on Delivery" };
const DELIVERY_METHOD_LABEL: Record<string, string> = { home: "Home delivery", pickup: "Store pickup" };

export const paymentStatusLabel = (value: string) => PAYMENT_STATUS_LABEL[value] ?? value;
export const paymentMethodLabel = (value: string) => PAYMENT_METHOD_LABEL[value] ?? value;
export const deliveryMethodLabel = (value: string) => DELIVERY_METHOD_LABEL[value] ?? value;

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

/**
 * An amount stored in a currency's minor units, shown in that currency:
 * 2800000 with TZS (exponent 2) is "TZS 28,000". The currency and its
 * exponent come from the country with the amount; nothing is converted.
 */
export function formatMinor(minor: number, currency: string, exponent: number): string {
  const major = minor / 10 ** exponent;
  const whole = Number.isInteger(major);
  const number = new Intl.NumberFormat("en-GB", { minimumFractionDigits: whole ? 0 : exponent, maximumFractionDigits: exponent }).format(major);
  return `${currency} ${number}`;
}
