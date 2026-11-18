import type { DeliveryFailureReason } from "@tronic/api-contracts";

/** Display text for deliveries. The country decides what a delivery may do. */

export const FAILURE_REASON_LABEL: Record<DeliveryFailureReason, string> = {
  customer_unreachable: "Customer did not answer the phone",
  customer_absent: "Nobody at the address",
  address_not_found: "Address not found",
  customer_refused: "Customer refused the order",
  other: "Other reason",
};

/** What the rider does next, by order status. */
export const RIDER_STEP: Partial<Record<string, { action: "pickup" | "start"; label: string; description: string }>> = {
  packed: { action: "pickup", label: "I have picked it up", description: "The customer sees that the order has left TRONIC." },
  dispatched: { action: "start", label: "Start the delivery", description: "The customer sees that the order is on its way and can see their delivery code." },
};

/** A Google Maps search for an address, opened by the rider's own tap. */
export function mapsSearchUrl(parts: readonly (string | null)[]): string | null {
  const query = parts.filter(Boolean).join(", ");
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${query}, Tanzania`)}` : null;
}
