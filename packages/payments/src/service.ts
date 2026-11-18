import { isMethodOffered, offeredMobileMoneyProviders, type CountryPaymentPolicy, type MobileMoneyProviderId } from "@tronic/country-config";
import type { PaymentGateway } from "./gateway";
import type { ApplyUpdateResult, PaymentStore } from "./store";
import { ACTIVE_PAYMENT_STATUSES, type OnlinePaymentMethod, type PaymentRecord } from "./types";

/**
 * The server's payment service: the only code that starts payments and
 * applies gateway answers. It runs on the server with the country's own
 * policy; the browser can ask it to start a payment for an order, never
 * to mark one paid.
 *
 *   startPayment   order (already placed) -> payment record -> gateway
 *   handleWebhook  signed gateway webhook -> verified update -> record
 *   reconcile      payment past its time or answer lost -> gateway status
 *                  check -> record (or expiry, when the gateway has none)
 */
export interface PaymentServiceOptions {
  policy: CountryPaymentPolicy;
  gateway: PaymentGateway;
  store: PaymentStore;
  /** Milliseconds a gateway call may take. */
  timeoutMs?: number;
  now?: () => Date;
}

export type StartPaymentOutcome =
  /** The customer approves on their phone, or waits for the bank transfer to be matched. */
  | { ok: true; next: "await_confirmation"; payment: PaymentRecord }
  /** Card: continue on the gateway's hosted page. */
  | { ok: true; next: "redirect"; url: string; payment: PaymentRecord }
  /** The gateway's answer was lost. Nothing is repeated; a status check settles it. */
  | { ok: true; next: "unknown"; payment: PaymentRecord }
  | { ok: false; reason: "declined"; failureCode: string; payment: PaymentRecord }
  | { ok: false; reason: "payment_in_progress"; payment: PaymentRecord }
  | { ok: false; reason: "method_unavailable" | "wallet_unavailable" | "not_found" | "not_payable" | "already_paid" | "invalid" };

export interface WebhookOutcome {
  /** HTTP status for the gateway: 2xx stops its retries. */
  httpStatus: 200 | 401 | 404 | 422 | 400;
  result: ApplyUpdateResult | null;
}

export function createPaymentService(options: PaymentServiceOptions) {
  const { policy, gateway, store } = options;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const now = options.now ?? (() => new Date());

  function gatewayFor(method: OnlinePaymentMethod): boolean {
    return policy.gateway === gateway.id && gateway.methods.includes(method) && isMethodOffered(policy, method);
  }

  return {
    async startPayment(input: {
      orderNumber: string;
      method: OnlinePaymentMethod;
      walletProvider: MobileMoneyProviderId | null;
      payerPhone: string | null;
      idempotencyKey: string;
      returnUrl: string | null;
    }): Promise<StartPaymentOutcome> {
      if (!gatewayFor(input.method)) return { ok: false, reason: "method_unavailable" };
      if (input.method === "mobile_money") {
        const wallet = offeredMobileMoneyProviders(policy).find((provider) => provider.id === input.walletProvider);
        if (!wallet || !input.payerPhone) return { ok: false, reason: "wallet_unavailable" };
      }

      const started = await store.start({
        country: policy.country,
        orderNumber: input.orderNumber,
        method: input.method,
        gateway: gateway.id,
        walletProvider: input.method === "mobile_money" ? input.walletProvider : null,
        payerPhone: input.method === "mobile_money" ? input.payerPhone : null,
        idempotencyKey: input.idempotencyKey,
        expiresAt: new Date(now().getTime() + policy.pendingPaymentMinutes * 60_000),
      });
      if (!started.ok) {
        if (started.code === "payment_in_progress") return { ok: false, reason: "payment_in_progress", payment: started.payment };
        if (started.code === "not_found" || started.code === "not_payable" || started.code === "already_paid") {
          return { ok: false, reason: started.code };
        }
        return { ok: false, reason: "invalid" };
      }
      // A repeated request after the gateway already answered: never ask it twice.
      if (started.replayed && started.payment.status !== "not_initiated") {
        return { ok: true, next: "await_confirmation", payment: started.payment };
      }

      let answer;
      try {
        answer = await gateway.initiate(
          {
            reference: started.payment.reference,
            idempotencyKey: input.idempotencyKey,
            method: input.method,
            amountMinor: started.payment.amountMinor,
            currency: started.payment.currency,
            walletProvider: input.method === "mobile_money" ? input.walletProvider : null,
            payerPhone: input.method === "mobile_money" ? input.payerPhone : null,
            returnUrl: input.returnUrl,
            description: `TRONIC order ${input.orderNumber}`,
          },
          AbortSignal.timeout(timeoutMs),
        );
      } catch {
        // A timeout is not a failure: the payment stays open until a status check settles it.
        return { ok: true, next: "unknown", payment: started.payment };
      }

      const applied = await store.applyUpdate({
        gateway: gateway.id,
        source: "gateway_response",
        reference: started.payment.reference,
        eventId: null,
        status: answer.kind === "accepted" ? answer.status : "failed",
        gatewayReference: answer.kind === "accepted" ? answer.gatewayReference : null,
        amountMinor: null,
        currency: null,
        failureCode: answer.kind === "declined" ? answer.failureCode : null,
      });
      const payment = applied.ok ? applied.payment : started.payment;
      if (answer.kind === "declined") return { ok: false, reason: "declined", failureCode: answer.failureCode, payment };
      if (answer.redirectUrl) return { ok: true, next: "redirect", url: answer.redirectUrl, payment };
      return { ok: true, next: "await_confirmation", payment };
    },

    async handleWebhook(request: { headers: Headers; rawBody: string }): Promise<WebhookOutcome> {
      const verified = await gateway.verifyWebhook(request);
      if (!verified.ok) {
        return { httpStatus: verified.reason === "signature" ? 401 : verified.reason === "ignored" ? 200 : 400, result: null };
      }
      const result = await store.applyUpdate({ ...verified.update, gateway: gateway.id, source: "webhook" });
      if (result.ok) return { httpStatus: 200, result };
      if (result.code === "not_found") return { httpStatus: 404, result };
      if (result.code === "invalid_request") return { httpStatus: 400, result };
      // Recorded as rejected; the gateway should not keep sending it.
      return { httpStatus: 422, result };
    },

    async reconcile(reference: string): Promise<{ outcome: "settled" | "expired" | "still_waiting" | "unknown" | "not_found" | "done"; payment: PaymentRecord | null }> {
      const payment = await store.find(reference);
      if (!payment) return { outcome: "not_found", payment: null };
      if (!ACTIVE_PAYMENT_STATUSES.includes(payment.status)) return { outcome: "done", payment };

      let status;
      try {
        status = await gateway.fetchStatus(
          { reference: payment.reference, gatewayReference: payment.gatewayReference },
          AbortSignal.timeout(timeoutMs),
        );
      } catch {
        return { outcome: "unknown", payment };
      }

      if (!status.found) {
        if (new Date(payment.expiresAt).getTime() > now().getTime()) return { outcome: "still_waiting", payment };
        const expired = await store.expire(reference);
        return { outcome: expired.ok && expired.changed ? "expired" : "done", payment: expired.ok ? expired.payment : payment };
      }
      const { found: _found, ...update } = status;
      const applied = await store.applyUpdate({ ...update, reference, gateway: gateway.id, source: "status_check" });
      if (!applied.ok) return { outcome: "unknown", payment };
      return { outcome: ACTIVE_PAYMENT_STATUSES.includes(applied.payment.status) ? "still_waiting" : "settled", payment: applied.payment };
    },

    /** Checks every overdue payment of the country, oldest first (for a scheduled job). */
    async reconcileDue(limit = 50) {
      const references = await store.listDue(policy.country, limit);
      const results = [];
      for (const reference of references) results.push({ reference, ...(await this.reconcile(reference)) });
      return results;
    },
  };
}

export type PaymentService = ReturnType<typeof createPaymentService>;
