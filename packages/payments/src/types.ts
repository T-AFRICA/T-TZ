import type { CountryCode } from "@tronic/types";

/** Lifecycle of one payment (migration 0007). Separate from the order's fulfilment status. */
export type PaymentStatus =
  | "not_initiated"
  | "pending"
  | "processing"
  | "successful"
  | "failed"
  | "cancelled"
  | "expired"
  | "refunded";

export const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  "not_initiated",
  "pending",
  "processing",
  "successful",
  "failed",
  "cancelled",
  "expired",
  "refunded",
];

/** Still waiting for the gateway: the order cannot get a second payment meanwhile. */
export const ACTIVE_PAYMENT_STATUSES: readonly PaymentStatus[] = ["not_initiated", "pending", "processing"];

export type OnlinePaymentMethod = "mobile_money" | "card" | "bank_transfer";

/** A payment as the database returns it. */
export interface PaymentRecord {
  reference: string;
  status: PaymentStatus;
  method: OnlinePaymentMethod;
  gateway: string;
  walletProvider: string | null;
  gatewayReference: string | null;
  amountMinor: number;
  currency: string;
  expiresAt: string;
  createdAt: string;
  completedAt: string | null;
}

export interface PaymentWithOrder extends PaymentRecord {
  orderNumber: string;
  country: CountryCode;
}

/** Where a gateway answer came from. Only these may change a payment. */
export type PaymentUpdateSource = "gateway_response" | "status_check" | "webhook";

/** What a gateway said about a payment, after the server verified it came from the gateway. */
export interface GatewayPaymentUpdate {
  reference: string;
  status: Exclude<PaymentStatus, "not_initiated">;
  /** The gateway's own event id, when it has one: an event is applied once. */
  eventId: string | null;
  gatewayReference: string | null;
  /** Required for successful and refunded: checked against the payment. */
  amountMinor: number | null;
  currency: string | null;
  /** A short code such as "insufficient_funds"; never a raw gateway message. */
  failureCode: string | null;
}
