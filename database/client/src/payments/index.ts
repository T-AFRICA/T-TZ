import type {
  ApplyUpdateResult,
  PaymentRecord,
  PaymentStatus,
  PaymentStore,
  PaymentWithOrder,
  StartPaymentResult,
} from "@tronic/payments";
import { PAYMENT_STATUSES } from "@tronic/payments";
import type { CountryCode } from "@tronic/types";
import { withServiceAccess } from "../country-admin/index";
import type { Db, Row } from "../db";

/**
 * The payment records of migration 0007, for the server's payment service
 * (@tronic/payments). Every call runs the database function as
 * service_role; the rules live in those functions.
 */
type Json = Record<string, unknown>;

async function call(db: Db, sql: string, params: readonly unknown[]): Promise<unknown> {
  const [row] = await withServiceAccess(db, (tx) => tx.query<Row>(sql, params));
  const value = row?.result;
  return typeof value === "string" ? (JSON.parse(value) as unknown) : value;
}

function object(value: unknown): Json {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Json;
  throw new Error("Unexpected payment function result");
}

const text = (value: unknown): string | null => (typeof value === "string" ? value : null);
const iso = (value: unknown): string => new Date(String(value)).toISOString();

function amount(value: unknown): number {
  const n = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof n !== "number" || !Number.isSafeInteger(n) || n < 0) throw new Error("Unexpected payment amount");
  return n;
}

function status(value: unknown): PaymentStatus {
  if (typeof value === "string" && (PAYMENT_STATUSES as readonly string[]).includes(value)) return value as PaymentStatus;
  throw new Error("Unexpected payment status");
}

function record(value: unknown): PaymentRecord {
  const p = object(value);
  const method = p.method;
  if (method !== "mobile_money" && method !== "card" && method !== "bank_transfer") throw new Error("Unexpected payment method");
  return {
    reference: String(p.reference),
    status: status(p.status),
    method,
    gateway: String(p.gateway),
    walletProvider: text(p.wallet_provider),
    gatewayReference: text(p.gateway_reference),
    amountMinor: amount(p.amount_minor),
    currency: String(p.currency),
    expiresAt: iso(p.expires_at),
    createdAt: iso(p.created_at),
    completedAt: p.completed_at ? iso(p.completed_at) : null,
  };
}

export function databasePaymentStore(db: Db): PaymentStore {
  return {
    async start(input) {
      const result = object(
        await call(db, `select payment_start($1, $2, $3, $4, $5, $6, $7, $8) as result`, [
          input.country,
          input.orderNumber,
          input.method,
          input.gateway,
          input.walletProvider,
          input.payerPhone,
          input.idempotencyKey,
          input.expiresAt.toISOString(),
        ]),
      );
      if (result.ok === true) return { ok: true, replayed: result.replayed === true, payment: record(result.payment) };
      if (result.code === "payment_in_progress") return { ok: false, code: "payment_in_progress", payment: record(result.payment) };
      return { ok: false, code: String(result.code) } as StartPaymentResult;
    },

    async applyUpdate(update) {
      const result = object(
        await call(db, `select payment_apply_update($1, $2, $3, $4, $5, $6, $7, $8, $9) as result`, [
          update.reference,
          update.gateway,
          update.source,
          update.eventId,
          update.status,
          update.gatewayReference,
          update.amountMinor,
          update.currency,
          update.failureCode,
        ]),
      );
      if (result.ok === true) {
        return {
          ok: true,
          changed: result.changed === true,
          replayed: result.replayed === true,
          payment: record(result.payment),
          orderStatus: String(result.order_status),
          orderPaymentStatus: String(result.order_payment_status),
          notice: text(result.notice),
        };
      }
      if (result.code === "invalid_request" || result.code === "not_found") return { ok: false, code: result.code };
      return { ok: false, code: String(result.code), status: String(result.status) } as ApplyUpdateResult;
    },

    async expire(reference) {
      const result = object(await call(db, `select payment_expire($1) as result`, [reference]));
      if (result.ok !== true) return { ok: false, code: "not_found" };
      return { ok: true, changed: result.changed === true, payment: record(result.payment) };
    },

    async find(reference): Promise<PaymentWithOrder | null> {
      const result = await call(db, `select payment_get($1) as result`, [reference]);
      if (result === null || result === undefined) return null;
      const p = object(result);
      return { ...record(p), orderNumber: String(p.order_number), country: String(p.country) as CountryCode };
    },

    async listDue(country, limit) {
      const result = await call(db, `select payment_list_due($1, $2) as result`, [country, limit]);
      return Array.isArray(result) ? result.map(String) : [];
    },
  };
}
