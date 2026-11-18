import type { CountryCode } from "@tronic/types";
import type { GatewayPaymentUpdate, OnlinePaymentMethod, PaymentRecord, PaymentUpdateSource, PaymentWithOrder } from "./types";

/**
 * The payment records the service reads and writes. Implemented over the
 * database functions of migration 0007 (@tronic/database/payments), which
 * hold the rules: amounts come from the order, one payment in progress per
 * order, allowed status changes, replay protection.
 */
export interface PaymentStore {
  start(input: StartPaymentInput): Promise<StartPaymentResult>;
  applyUpdate(update: GatewayPaymentUpdate & { gateway: string; source: PaymentUpdateSource }): Promise<ApplyUpdateResult>;
  expire(reference: string): Promise<{ ok: true; changed: boolean; payment: PaymentRecord } | { ok: false; code: "not_found" }>;
  find(reference: string): Promise<PaymentWithOrder | null>;
  listDue(country: CountryCode, limit: number): Promise<string[]>;
}

export interface StartPaymentInput {
  country: CountryCode;
  orderNumber: string;
  method: OnlinePaymentMethod;
  gateway: string;
  walletProvider: string | null;
  payerPhone: string | null;
  idempotencyKey: string;
  expiresAt: Date;
}

export type StartPaymentResult =
  | { ok: true; replayed: boolean; payment: PaymentRecord }
  | { ok: false; code: "payment_in_progress"; payment: PaymentRecord }
  | { ok: false; code: "invalid_request" | "not_found" | "idempotency_conflict" | "method_mismatch" | "not_payable" | "already_paid" };

export type ApplyUpdateRefusal =
  | "gateway_mismatch"
  | "amount_mismatch"
  | "amount_missing"
  | "reference_mismatch"
  | "invalid_transition";

export type ApplyUpdateResult =
  | {
      ok: true;
      changed: boolean;
      replayed: boolean;
      payment: PaymentRecord;
      orderStatus: string;
      orderPaymentStatus: string;
      /** "order_cancelled_refund_needed" when a cancelled order was paid. */
      notice: string | null;
    }
  | { ok: false; code: "invalid_request" | "not_found" }
  | { ok: false; code: ApplyUpdateRefusal; status: string };
