/**
 * Order tracking timeline, built only from what the order record says
 * (migration 0004: one status, a payment status, the delivery method and
 * the order date). There is no status-history table yet, so:
 *   - the only timestamp shown is the order date (step one); later steps
 *     carry no time until fulfilment records one;
 *   - nothing here is live or estimated: no courier, no delivery window.
 * Cancellation and payment problems are exceptions shown beside the
 * timeline, never completed steps.
 */

export type StepState = "completed" | "current" | "upcoming";

export interface TrackingStep {
  key: string;
  title: string;
  description: string;
  state: StepState;
  /** ISO timestamp when the record has one; null otherwise (never invented). */
  at: string | null;
}

export interface TrackingException {
  key: "cancelled" | "payment_failed" | "refunded";
  title: string;
  description: string;
}

export interface OrderTracking {
  steps: TrackingStep[];
  /** Title of the step the order is at now. */
  currentTitle: string;
  exceptions: TrackingException[];
  /** True once the last step is done. */
  finished: boolean;
}

export interface TrackableOrder {
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  deliveryMethod: string;
  createdAt: string;
}

interface StepDefinition {
  key: string;
  title: string;
  description: string;
  /** Order statuses at which this step is the current one. */
  statuses: readonly string[];
}

const HOME_STEPS: readonly StepDefinition[] = [
  { key: "placed", title: "Order placed", description: "We have received your order.", statuses: ["pending_payment"] },
  { key: "confirmed", title: "Order confirmed", description: "Your order has been confirmed.", statuses: ["confirmed"] },
  { key: "processing", title: "Processing", description: "We are preparing your items.", statuses: ["processing"] },
  { key: "packed", title: "Packed", description: "Your order is packed and ready for dispatch.", statuses: ["packed"] },
  { key: "dispatched", title: "Dispatched", description: "Your order has left our store.", statuses: ["dispatched"] },
  { key: "in_transit", title: "In transit", description: "Your order is on its way to you.", statuses: ["in_transit"] },
  { key: "delivered", title: "Delivered", description: "Your order has been delivered.", statuses: ["delivered"] },
];

/** Pickup orders are collected, not shipped: no dispatch or transit steps. */
const PICKUP_STEPS: readonly StepDefinition[] = [
  HOME_STEPS[0]!,
  HOME_STEPS[1]!,
  HOME_STEPS[2]!,
  { key: "ready", title: "Ready for pickup", description: "Your order is packed and ready to collect.", statuses: ["packed", "dispatched", "in_transit"] },
  { key: "collected", title: "Collected", description: "Your order has been collected.", statuses: ["delivered"] },
];

export function buildTracking(order: TrackableOrder): OrderTracking {
  const definitions = order.deliveryMethod === "pickup" ? PICKUP_STEPS : HOME_STEPS;
  const cancelled = order.status === "cancelled";
  const currentIndex = definitions.findIndex((step) => step.statuses.includes(order.status));
  const lastIndex = definitions.length - 1;
  const finished = !cancelled && currentIndex === lastIndex;

  const steps: TrackingStep[] = definitions.map((step, index) => {
    let state: StepState;
    if (cancelled || currentIndex < 0) {
      // A cancelled order (or a status this timeline does not know) shows
      // only what is certain: the order was placed.
      state = index === 0 ? "completed" : "upcoming";
    } else if (index < currentIndex || finished) {
      state = "completed";
    } else if (index === currentIndex) {
      state = "current";
    } else {
      state = "upcoming";
    }
    return {
      key: step.key,
      title: step.title,
      description: step.description,
      state,
      at: index === 0 ? order.createdAt : null,
    };
  });

  const exceptions: TrackingException[] = [];
  if (cancelled) {
    exceptions.push({ key: "cancelled", title: "Order cancelled", description: "This order was cancelled and will not be delivered." });
  }
  if (order.paymentStatus === "failed") {
    exceptions.push({ key: "payment_failed", title: "Payment failed", description: "The payment for this order did not go through." });
  }
  if (order.paymentStatus === "refunded") {
    exceptions.push({ key: "refunded", title: "Refunded", description: "The payment for this order was refunded." });
  }

  const current = steps.find((step) => step.state === "current");
  const currentTitle = cancelled ? "Cancelled" : finished ? steps[lastIndex]!.title : (current?.title ?? steps[0]!.title);
  return { steps, currentTitle, exceptions, finished };
}

/** Statuses that count as "in progress" for the dashboard and the tracking page. */
export const ACTIVE_STATUSES = ["pending_payment", "confirmed", "processing", "packed", "dispatched", "in_transit"] as const;
