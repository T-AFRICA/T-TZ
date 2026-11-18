import type { MobileMoneyProviderId } from "@tronic/country-config";
import type { GatewayPaymentUpdate, OnlinePaymentMethod, PaymentStatus } from "./types";

/**
 * What every payment gateway adapter provides. The checkout, the payment
 * service and the database never talk to a gateway directly, so changing
 * the gateway means writing one adapter, not rebuilding checkout.
 *
 * An adapter:
 *   * keeps its credentials server-side (read from server environment
 *     variables, never NEXT_PUBLIC_);
 *   * uses the gateway's sandbox until production use is approved;
 *   * passes TRONIC's payment reference and idempotency key to the gateway,
 *     so a retried request cannot charge twice;
 *   * verifies every webhook with the gateway's own signature scheme
 *     before returning it; an unverified webhook is never returned as an
 *     event;
 *   * returns short codes, never raw gateway payloads, card data or PINs.
 *
 * No adapter exists yet: TRONIC has not chosen a gateway.
 */
export interface PaymentGateway {
  /** Stable id stored with each payment, e.g. "selcom" (lowercase, digits, underscores). */
  readonly id: string;
  readonly methods: readonly OnlinePaymentMethod[];

  initiate(request: GatewayInitiateRequest, signal: AbortSignal): Promise<GatewayInitiateResult>;

  /** The gateway's current view of a payment, for reconciliation. */
  fetchStatus(lookup: { reference: string; gatewayReference: string | null }, signal: AbortSignal): Promise<GatewayStatusResult>;

  /** Verifies a webhook's signature and reads it. The raw body is exactly the bytes received. */
  verifyWebhook(request: { headers: Headers; rawBody: string }): Promise<GatewayWebhookResult>;
}

export interface GatewayInitiateRequest {
  reference: string;
  idempotencyKey: string;
  method: OnlinePaymentMethod;
  amountMinor: number;
  currency: string;
  /** Mobile money: the wallet and the +255 number that receives the prompt. */
  walletProvider: MobileMoneyProviderId | null;
  payerPhone: string | null;
  /** Card: where the hosted page sends the customer back to. */
  returnUrl: string | null;
  description: string;
}

export type GatewayInitiateResult =
  /** The gateway took the request: a prompt was sent, or a hosted page is ready. */
  | {
      kind: "accepted";
      status: Extract<PaymentStatus, "pending" | "processing">;
      gatewayReference: string | null;
      /** Card: the gateway's hosted payment page. */
      redirectUrl: string | null;
    }
  /** The gateway refused it (e.g. unsupported wallet, invalid number). Nothing was charged. */
  | { kind: "declined"; failureCode: string };

export type GatewayStatusResult =
  | { found: false }
  | ({ found: true } & Omit<GatewayPaymentUpdate, "reference">);

export type GatewayWebhookResult =
  | { ok: true; update: GatewayPaymentUpdate }
  /** Not from the gateway, or not readable: nothing may be changed. */
  | { ok: false; reason: "signature" | "malformed" | "ignored" };
