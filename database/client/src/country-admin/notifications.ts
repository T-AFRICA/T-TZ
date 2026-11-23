import { STAFF_NOTIFICATION_KINDS, type NotificationAudience, type NotificationList, type NotificationSeenResult, type StaffNotificationKind } from "@tronic/api-contracts";
import type { Db, Row } from "../db";

/**
 * Notifications for staff and riders (migration 0023) for the country
 * admin API. The audience comes from the endpoint, whose permission the
 * signed token was checked against; the administrator is the one who
 * signed the request.
 */

type Json = Record<string, unknown>;
type ServiceAccess = <T>(db: Db, fn: (tx: Db) => Promise<T>) => Promise<T>;

const text = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
const int = (value: unknown): number => {
  const n = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : typeof value === "bigint" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isSafeInteger(n) || n < 0) throw new Error("Unexpected database value: expected a non-negative integer");
  return n;
};
const isKind = (value: unknown): value is StaffNotificationKind =>
  typeof value === "string" && (STAFF_NOTIFICATION_KINDS as readonly string[]).includes(value);

function object(value: unknown): Json | null {
  const parsed: unknown = typeof value === "string" ? JSON.parse(value) : value;
  if (parsed === null || parsed === undefined) return null;
  if (typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Json;
  throw new Error("Unexpected database function result");
}

/** How many notifications one audience's list carries. */
export const STAFF_NOTIFICATION_LIMIT = 30;

export function notificationFunctions(withServiceAccess: ServiceAccess) {
  async function call(db: Db, sql: string, params: readonly unknown[]): Promise<Json | null> {
    const [row] = await withServiceAccess(db, (tx) => tx.query<Row>(sql, params));
    return object(row?.result);
  }

  return {
    async list(db: Db, country: string, audience: NotificationAudience, actorId: string): Promise<NotificationList> {
      const r = await call(db, `select admin_list_notifications($1::char(2), $2, $3::uuid, $4::integer) as result`, [
        country,
        audience,
        actorId,
        STAFF_NOTIFICATION_LIMIT,
      ]);
      if (!r) throw new Error("admin_list_notifications returned nothing");
      const items = Array.isArray(r.items) ? (r.items as Json[]) : [];
      return {
        ok: true,
        unread: int(r.unread),
        seenId: int(r.seen_id),
        // A kind this code does not know (a newer database) is left out rather than shown wrongly.
        items: items.flatMap((item) =>
          isKind(item.kind)
            ? [
                {
                  id: int(item.id),
                  kind: item.kind,
                  createdAt: new Date(String(item.created_at)).toISOString(),
                  orderNumber: text(item.order_number),
                  productSlug: text(item.product_slug),
                  productName: text(item.product_name),
                  unread: item.unread === true,
                },
              ]
            : [],
        ),
      };
    },

    async markSeen(db: Db, country: string, audience: NotificationAudience, actorId: string, through: number): Promise<NotificationSeenResult> {
      const r = await call(db, `select admin_mark_notifications_seen($1::char(2), $2, $3::uuid, $4::bigint) as result`, [
        country,
        audience,
        actorId,
        through,
      ]);
      if (r?.ok === true) return { ok: true, seenId: int(r.seen_id) };
      return { ok: false, code: "invalid_request" };
    },
  };
}
