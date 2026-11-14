/** Customer-facing labels for the order statuses of migration 0004. */
export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_payment: "Pending payment",
  confirmed: "Confirmed",
  processing: "Processing",
  packed: "Packed",
  dispatched: "Dispatched",
  in_transit: "In transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** Payment status of an order (orders.payment_status). */
export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Payment pending",
  paid: "Paid",
  failed: "Payment failed",
  refunded: "Refunded",
};

/** Payment methods the checkout offers (orders.payment_method). */
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pay_on_delivery: "Pay on delivery",
};

export const DELIVERY_METHOD_LABELS: Record<string, string> = {
  home: "Home delivery",
  pickup: "Store pickup",
};

export type StatusTone = "neutral" | "progress" | "success" | "danger" | "warning";

export function orderStatusTone(status: string): StatusTone {
  if (status === "delivered") return "success";
  if (status === "cancelled") return "danger";
  if (status === "pending_payment") return "neutral";
  return "progress";
}

export function paymentStatusTone(status: string): StatusTone {
  if (status === "paid") return "success";
  if (status === "failed") return "danger";
  if (status === "refunded") return "warning";
  return "neutral";
}

/** Order numbers as issued by place_cod_order: TZ-YYMMDD-XXXXXXXX. */
export const ORDER_NUMBER_PATTERN = /^[A-Za-z0-9-]{4,40}$/;
