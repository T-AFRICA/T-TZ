import { toSafeInteger, withAccess, type Access, type Db, type Row } from "./db";

/**
 * A customer's notifications (migration 0023): what happened to their own
 * orders. The rows are written by the database when the event happens;
 * these functions only read them and mark them read, as the signed-in
 * customer, so Row Level Security decides whose rows they are.
 */

type Authenticated = Extract<Access, { role: "authenticated" }>;

export const CUSTOMER_NOTIFICATION_KINDS = [
  "order_placed",
  "confirmed",
  "processing",
  "packed",
  "dispatched",
  "in_transit",
  "delivered",
  "cancelled",
  "delivery_attempt",
  "payment_received",
  "payment_failed",
  "refunded",
] as const;

export type CustomerNotificationKind = (typeof CUSTOMER_NOTIFICATION_KINDS)[number];

export interface CustomerNotificationRow {
  id: number;
  kind: CustomerNotificationKind;
  orderNumber: string;
  createdAt: string;
  readAt: string | null;
}

/** How many notifications a page shows: the newest ones. */
export const CUSTOMER_NOTIFICATION_LIMIT = 50;

const isKind = (value: unknown): value is CustomerNotificationKind =>
  typeof value === "string" && (CUSTOMER_NOTIFICATION_KINDS as readonly string[]).includes(value);

/** The customer's newest notifications, newest first. A kind this code does not know is left out. */
export async function listCustomerNotifications(db: Db, access: Authenticated): Promise<CustomerNotificationRow[]> {
  const rows = await withAccess(db, access, (tx) =>
    tx.query<Row>(
      `select n.id, n.kind, n.created_at, n.read_at, o.order_number
         from customer_notifications n
         join orders o on o.id = n.order_id
        order by n.id desc
        limit $1`,
      [CUSTOMER_NOTIFICATION_LIMIT],
    ),
  );
  return rows.flatMap((row) =>
    isKind(row.kind)
      ? [
          {
            id: toSafeInteger(row.id, "customer_notifications.id"),
            kind: row.kind,
            orderNumber: String(row.order_number),
            createdAt: new Date(String(row.created_at)).toISOString(),
            readAt: row.read_at === null || row.read_at === undefined ? null : new Date(String(row.read_at)).toISOString(),
          },
        ]
      : [],
  );
}

/** How many of the customer's notifications are unread. */
export async function countUnreadCustomerNotifications(db: Db, access: Authenticated): Promise<number> {
  const [row] = await withAccess(db, access, (tx) =>
    tx.query<Row>(`select count(*) as unread from customer_notifications where read_at is null`),
  );
  return toSafeInteger(row?.unread ?? 0, "customer_notifications unread");
}

/** Marks one of the customer's notifications read, or all of them (null). Returns how many changed. */
export async function markCustomerNotificationsRead(db: Db, access: Authenticated, id: number | null): Promise<number> {
  if (id !== null && (!Number.isSafeInteger(id) || id < 1)) return 0;
  const [row] = await withAccess(db, access, (tx) =>
    tx.query<Row>(`select customer_mark_notifications_read($1::bigint) as changed`, [id]),
  );
  return toSafeInteger(row?.changed ?? 0, "customer_mark_notifications_read");
}
