import {
  DELIVERY_PROOF_MAX_BYTES,
  type DeliveryAction,
  type DeliveryAssignResult,
  type DeliveryFailureReason,
  type DeliveryInfoResponse,
  type DeliveryProofKind,
  type DeliveryProofResponse,
  type OrderStatus,
  type RiderDeliveries,
  type RiderFigures,
  type RiderLocation,
  type RiderLocationResult,
  type RiderDeliveryList,
  type RiderDeliveryResponse,
  type RiderDeliveryUpdate,
  type RiderDeliveryUpdateResult,
} from "@tronic/api-contracts";
import type { Db, Row } from "../db";

/**
 * Deliveries by TRONIC's riders (migration 0008), for the country admin
 * API. The rider is always the administrator of the verified request,
 * passed in by the caller; nothing here reads a rider from the request body.
 */

type Json = Record<string, unknown>;
type ServiceAccess = <T>(db: Db, fn: (tx: Db) => Promise<T>) => Promise<T>;

const iso = (value: unknown): string => new Date(String(value)).toISOString();
const isoOrNull = (value: unknown): string | null => (value === null || value === undefined ? null : iso(value));
const text = (value: unknown): string | null => (typeof value === "string" ? value : null);
const int = (value: unknown): number => {
  const n = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof n !== "number" || !Number.isSafeInteger(n) || n < 0) throw new Error("Unexpected database value: expected a non-negative integer");
  return n;
};
const list = (value: unknown): Json[] => (Array.isArray(value) ? (value as Json[]) : []);

function parse(value: unknown): unknown {
  return typeof value === "string" ? (JSON.parse(value) as unknown) : value;
}

function object(value: unknown): Json | null {
  const parsed = parse(value);
  if (parsed === null || parsed === undefined) return null;
  if (typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Json;
  throw new Error("Unexpected database function result");
}

async function call(withServiceAccess: ServiceAccess, db: Db, sql: string, params: readonly unknown[]): Promise<unknown> {
  const [row] = await withServiceAccess(db, (tx) => tx.query<Row>(sql, params));
  return row?.result;
}

/** Decodes a base64 proof image; null when it is not valid base64 or too large. */
function decodeImage(data: string): Buffer | null {
  const bytes = Buffer.from(data, "base64");
  if (bytes.length === 0 || bytes.length > DELIVERY_PROOF_MAX_BYTES || bytes.toString("base64").replace(/=+$/, "") !== data.replace(/=+$/, "")) return null;
  return bytes;
}

export function deliveryFunctions(withServiceAccess: ServiceAccess) {
  return {
    async riderFigures(db: Db, country: string): Promise<RiderFigures> {
      const [figures, money] = await Promise.all([
        call(withServiceAccess, db, `select admin_rider_figures($1::char(2)) as result`, [country]),
        call(withServiceAccess, db, `select jsonb_build_object('currency', c.currency, 'exponent', cur.exponent) as result from countries c join currencies cur on cur.code = c.currency where c.code = $1`, [country]),
      ]);
      const byRider = object(figures) ?? {};
      const currency = object(money) ?? {};
      return {
        ok: true,
        currency: String(currency.currency),
        currencyExponent: int(currency.exponent),
        riders: Object.fromEntries(
          Object.entries(byRider).map(([riderId, raw]) => {
            const f = (object(raw) ?? {}) as Json;
            return [
              riderId,
              {
                open: int(f.open),
                onTheWay: int(f.on_the_way),
                deliveredToday: int(f.delivered_today),
                delivered7Days: int(f.delivered_7_days),
                delivered30Days: int(f.delivered_30_days),
                failed7Days: int(f.failed_7_days),
                cashTodayMinor: int(f.cash_today_minor),
                lastDeliveredAt: isoOrNull(f.last_delivered_at),
              },
            ];
          }),
        ),
      };
    },

    async riderDeliveries(db: Db, country: string, riderId: string): Promise<RiderDeliveries> {
      const r = object(await call(withServiceAccess, db, `select admin_rider_deliveries($1::char(2), $2::uuid, $3) as result`, [country, riderId, 50])) ?? {};
      return {
        ok: true,
        currency: String(r.currency),
        currencyExponent: int(r.currency_exponent),
        deliveries: list(r.deliveries).map((d) => ({
          orderNumber: String(d.order_number),
          status: String(d.status) as OrderStatus,
          contactName: String(d.contact_name),
          district: text(d.district),
          region: text(d.region),
          paymentMethod: String(d.payment_method),
          totalMinor: int(d.total_minor),
          cashCollectedMinor: d.cash_collected_minor === null || d.cash_collected_minor === undefined ? null : int(d.cash_collected_minor),
          assignedAt: iso(d.assigned_at),
          deliveredAt: isoOrNull(d.delivered_at),
        })),
        attempts: list(r.attempts).map((a) => ({
          orderNumber: String(a.order_number),
          reason: String(a.reason) as DeliveryFailureReason,
          note: text(a.note),
          createdAt: iso(a.created_at),
        })),
      };
    },

    async assign(
      db: Db,
      country: string,
      orderNumber: string,
      rider: { riderId: string; riderName: string; riderPhone?: string | undefined },
      actorId: string,
    ): Promise<DeliveryAssignResult> {
      // With the rider's phone once migration 0012 is in; without it before, so assigning keeps working.
      const [has] = await withServiceAccess(db, (tx) =>
        tx.query<Row>(`select to_regprocedure('public.admin_assign_delivery(character,text,uuid,text,uuid,text)') is not null as ok`),
      );
      const withPhone = has?.ok === true;
      const result = object(
        await call(
          withServiceAccess,
          db,
          withPhone
            ? `select admin_assign_delivery($1::char(2), $2, $3::uuid, $4, $5::uuid, $6) as result`
            : `select admin_assign_delivery($1::char(2), $2, $3::uuid, $4, $5::uuid) as result`,
          withPhone
            ? [country, orderNumber, rider.riderId, rider.riderName, actorId, rider.riderPhone ?? null]
            : [country, orderNumber, rider.riderId, rider.riderName, actorId],
        ),
      );
      if (!result) throw new Error("admin_assign_delivery returned nothing");
      if (result.ok === true) return { ok: true, riderId: String(result.rider_id), riderName: String(result.rider_name) };
      const code = result.code === "not_found" || result.code === "not_assignable" ? result.code : "invalid_request";
      return { ok: false, code, ...(typeof result.status === "string" ? { status: result.status as OrderStatus } : {}) };
    },

    async info(db: Db, country: string, orderNumber: string): Promise<DeliveryInfoResponse> {
      const exists = await withServiceAccess(db, (tx) =>
        tx.query<Row>(`select 1 from orders where country_code = $1 and order_number = $2`, [country, orderNumber]),
      );
      if (exists.length === 0) return { ok: false, code: "not_found" };
      const d = object(await call(withServiceAccess, db, `select admin_get_delivery($1::char(2), $2) as result`, [country, orderNumber]));
      if (!d) return { ok: true, delivery: null };
      return {
        ok: true,
        delivery: {
          riderId: String(d.rider_id),
          riderName: String(d.rider_name),
          assignedAt: iso(d.assigned_at),
          deliveredAt: isoOrNull(d.delivered_at),
          cashCollectedMinor: d.cash_collected_minor === null || d.cash_collected_minor === undefined ? null : int(d.cash_collected_minor),
          codeLocked: d.code_locked === true,
          proofs: list(d.proofs).map((kind) => String(kind) as DeliveryProofKind),
          attempts: list(d.attempts).map((a) => ({
            reason: String(a.reason) as DeliveryFailureReason,
            note: text(a.note),
            actorId: String(a.actor_id),
            createdAt: iso(a.created_at),
          })),
        },
      };
    },

    async proof(db: Db, country: string, orderNumber: string, kind: DeliveryProofKind): Promise<DeliveryProofResponse> {
      const p = object(await call(withServiceAccess, db, `select admin_get_delivery_proof($1::char(2), $2, $3) as result`, [country, orderNumber, kind]));
      if (!p) return { ok: false, code: "not_found" };
      return {
        ok: true,
        proof: {
          contentType: String(p.content_type) as "image/jpeg" | "image/png" | "image/webp",
          data: String(p.data).replace(/\s+/g, ""),
          createdAt: iso(p.created_at),
        },
      };
    },

    async reportLocation(db: Db, country: string, orderNumber: string, riderId: string, location: RiderLocation): Promise<RiderLocationResult> {
      const r = object(
        await call(withServiceAccess, db, `select rider_report_location($1::char(2), $2, $3::uuid, $4, $5, $6) as result`, [
          country,
          orderNumber,
          riderId,
          location.lat,
          location.lng,
          location.accuracy ?? null,
        ]),
      );
      if (!r) throw new Error("rider_report_location returned nothing");
      if (r.ok === true) return { ok: true, saved: r.saved === true };
      const code = r.code === "not_found" || r.code === "not_on_the_way" ? r.code : "invalid_request";
      return { ok: false, code };
    },

    async listForRider(db: Db, country: string, riderId: string): Promise<RiderDeliveryList> {
      const rows = parse(await call(withServiceAccess, db, `select rider_list_deliveries($1::char(2), $2::uuid) as result`, [country, riderId]));
      return {
        ok: true,
        deliveries: list(rows).map((d) => ({
          orderNumber: String(d.order_number),
          status: String(d.status) as OrderStatus,
          contactName: String(d.contact_name),
          region: text(d.region),
          district: text(d.district),
          ward: text(d.ward),
          street: text(d.street),
          paymentMethod: String(d.payment_method),
          paymentStatus: String(d.payment_status),
          totalMinor: int(d.total_minor),
          currency: String(d.currency),
          currencyExponent: int(d.currency_exponent),
          itemCount: int(d.item_count),
          assignedAt: iso(d.assigned_at),
        })),
      };
    },

    async getForRider(db: Db, country: string, orderNumber: string, riderId: string): Promise<RiderDeliveryResponse> {
      const d = object(await call(withServiceAccess, db, `select rider_get_delivery($1::char(2), $2, $3::uuid) as result`, [country, orderNumber, riderId]));
      if (!d) return { ok: false, code: "not_found" };
      const contact = (object(d.contact) ?? {}) as Json;
      const delivery = (object(d.delivery) ?? {}) as Json;
      return {
        ok: true,
        delivery: {
          orderNumber: String(d.order_number),
          status: String(d.status) as OrderStatus,
          contact: { name: String(contact.name), phone: String(contact.phone) },
          delivery: {
            region: text(delivery.region),
            district: text(delivery.district),
            ward: text(delivery.ward),
            street: text(delivery.street),
            extra: text(delivery.extra),
            notes: text(delivery.notes),
          },
          paymentMethod: String(d.payment_method),
          paymentStatus: String(d.payment_status),
          totalMinor: int(d.total_minor),
          currency: String(d.currency),
          currencyExponent: int(d.currency_exponent),
          cashToCollectMinor: int(d.cash_to_collect_minor),
          lines: list(d.lines).map((l) => ({
            name: String(l.name),
            sku: String(l.sku),
            color: text(l.color),
            variant: text(l.variant),
            quantity: int(l.quantity),
          })),
          assignedAt: iso(d.assigned_at),
          deliveredAt: isoOrNull(d.delivered_at),
          codeLockedUntil: isoOrNull(d.code_locked_until),
          attempts: list(d.attempts).map((a) => ({ reason: String(a.reason) as DeliveryFailureReason, note: text(a.note), createdAt: iso(a.created_at) })),
        },
      };
    },

    async updateForRider(
      db: Db,
      country: string,
      orderNumber: string,
      riderId: string,
      action: DeliveryAction,
      update: RiderDeliveryUpdate,
      requestId: string,
    ): Promise<RiderDeliveryUpdateResult> {
      const photo = update.photo ? decodeImage(update.photo.data) : null;
      const signature = update.signature ? decodeImage(update.signature.data) : null;
      if ((update.photo && !photo) || (update.signature && !signature)) return { ok: false, code: "invalid_request" };
      const result = object(
        await call(
          withServiceAccess,
          db,
          `select rider_update_delivery($1::char(2), $2, $3::uuid, $4, $5::uuid, $6, $7, $8, $9, $10, $11, $12, $13) as result`,
          [
            country,
            orderNumber,
            riderId,
            action,
            requestId,
            update.code ?? null,
            update.cashCollectedMinor ?? null,
            photo,
            update.photo?.contentType ?? null,
            signature,
            update.signature?.contentType ?? null,
            update.reason ?? null,
            update.note ?? null,
          ],
        ),
      );
      if (!result) throw new Error("rider_update_delivery returned nothing");
      if (result.ok === true) {
        return { ok: true, replayed: result.replayed === true, status: String(result.status) as OrderStatus, paymentStatus: String(result.payment_status) };
      }
      const known = ["not_found", "invalid_request", "wrong_step", "wrong_code", "code_locked", "proof_missing", "cash_mismatch"] as const;
      const code = (known as readonly unknown[]).includes(result.code) ? (result.code as (typeof known)[number]) : "invalid_request";
      return {
        ok: false,
        code,
        ...(typeof result.status === "string" ? { status: result.status as OrderStatus } : {}),
        ...(result.attempts_left !== undefined ? { attemptsLeft: int(result.attempts_left) } : {}),
        ...(result.locked_until ? { lockedUntil: iso(result.locked_until) } : {}),
      };
    },
  };
}
