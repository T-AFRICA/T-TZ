import {
  countCustomerOrdersByStatus,
  countUnreadCustomerNotifications,
  getCustomerOrder,
  getCustomerTracking,
  getDeliveryCode,
  setDeliveryPoint,
  type CustomerTracking,
  type DeliveryPointResult,
  listCustomerNotifications,
  listCustomerOrderPage,
  markCustomerNotificationsRead,
  type CustomerNotificationKind,
  type CustomerOrderDetail,
  type CustomerOrderPage,
  type CustomerOrderQuery,
  type CustomerOrderSummary,
} from "@tronic/database";
import { ACTIVE_COUNTRY } from "@tronic/country-config";
import type { SessionUser } from "@/features/auth/server";
import { getCatalog, getDb, ordersEnabled } from "@/features/data/source";
import { avatarUrl } from "./avatar";
import { NOTIFICATION_TEXT, notificationsMissing } from "./notifications";
import { ACTIVE_STATUSES, buildTracking, type OrderTracking, type TrackableOrder } from "./tracking";

/**
 * Typed services of the customer portal (server-only). Each method answers
 * for the signed-in customer and nobody else: database reads run as the
 * authenticated role with that customer's id, so Row Level Security filters
 * them (database/migrations/0004).
 *
 * A module whose backend does not exist yet answers `not_connected` with
 * what it is waiting for; the UI shows that honestly instead of sample
 * records. See docs/CUSTOMER-PORTAL.md for the integration plan.
 */
export type ServiceResult<T> = { status: "ok"; data: T } | { status: "not_connected"; waitingFor: string };

export interface CustomerProfile {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  /** The customer's optional photo, served only to them; null without one. */
  photoUrl: string | null;
  /** The storefront's country (one deployment per country). */
  country: string;
}

export interface OrderCounts {
  total: number;
  /** Placed but not yet delivered or cancelled. */
  inProgress: number;
  delivered: number;
  cancelled: number;
}

/** A payment as far as the order record knows it (no provider yet). */
export interface PaymentRecord {
  orderNumber: string;
  /** The order date: Pay on Delivery has no separate payment timestamp yet. */
  orderedAt: string;
  method: string;
  status: string;
  amountMinor: number;
  currency: string;
  /** Set by a payment provider; none is connected, so always null for now. */
  transactionReference: string | null;
}

export interface SavedAddress {
  id: string;
  recipientName: string;
  phone: string;
  region: string;
  district: string;
  ward: string;
  street: string;
  instructions: string | null;
  isDefault: boolean;
}

export interface InvoiceRecord {
  invoiceNumber: string;
  orderNumber: string;
  issuedAt: string;
  totalMinor: number;
  currency: string;
  /** A signed, short-lived link from the document service. */
  downloadUrl: string | null;
}

export interface CustomerNotification {
  id: number;
  kind: CustomerNotificationKind;
  orderNumber: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

export interface CustomerSession {
  id: string;
  device: string;
  lastActiveAt: string;
  current: boolean;
}

export interface AccountService {
  getProfile(): CustomerProfile;
  getOrderCounts(): Promise<ServiceResult<OrderCounts>>;
  listOrders(query?: CustomerOrderQuery): Promise<ServiceResult<CustomerOrderPage>>;
  /** null inside `ok` means "no such order for this customer". */
  getOrder(orderNumber: string): Promise<ServiceResult<CustomerOrderDetail | null>>;
  getTracking(order: TrackableOrder, events?: readonly { status: string; at: string }[]): OrderTracking;
  /** Live tracking of one of the customer's orders (migration 0012); null when unavailable. */
  getLiveTracking(orderNumber: string): Promise<CustomerTracking | null>;
  /** Where the customer's own order should go: their phone's position (migration 0013). */
  setDeliveryPoint(orderNumber: string, point: { lat: number; lng: number; accuracy: number | null }): Promise<DeliveryPointResult>;
  /** The code the customer gives the rider, while the order is on its way; null otherwise. */
  getDeliveryCode(order: { orderNumber: string; status: string }): Promise<string | null>;
  listPayments(query?: Pick<CustomerOrderQuery, "page" | "pageSize">): Promise<ServiceResult<{ items: PaymentRecord[]; page: number; pageCount: number; total: number }>>;
  listAddresses(): Promise<ServiceResult<SavedAddress[]>>;
  listInvoices(): Promise<ServiceResult<InvoiceRecord[]>>;
  /** The customer's newest notifications (migration 0023), newest first. */
  listNotifications(): Promise<ServiceResult<CustomerNotification[]>>;
  /** How many are unread; 0 when notifications are not connected. */
  countUnreadNotifications(): Promise<number>;
  /** Marks one of the customer's notifications read, or all of them (null). False when nothing could be saved. */
  markNotificationsRead(id: number | null): Promise<boolean>;
  listSessions(): Promise<ServiceResult<CustomerSession[]>>;
}

const ORDERS_WAITING = "the order database (DATA_SOURCE=database)";
const NOTIFICATIONS_WAITING = "the notifications in the order database (migration 0023_notifications.sql)";

export function createAccountService(user: SessionUser): AccountService {
  const access = { role: "authenticated", userId: user.id } as const;

  async function withOrders<T>(read: () => Promise<T>): Promise<ServiceResult<T>> {
    if (!ordersEnabled()) return { status: "not_connected", waitingFor: ORDERS_WAITING };
    return { status: "ok", data: await read() };
  }

  return {
    getProfile: () => ({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      photoUrl: avatarUrl(user.avatarVersion),
      country: ACTIVE_COUNTRY.name,
    }),

    getOrderCounts: () =>
      withOrders(async () => {
        const counts = await countCustomerOrdersByStatus(getDb(), access);
        const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
        const inProgress = ACTIVE_STATUSES.reduce((sum, status) => sum + (counts[status] ?? 0), 0);
        return { total, inProgress, delivered: counts.delivered ?? 0, cancelled: counts.cancelled ?? 0 };
      }),

    listOrders: (query) => withOrders(() => listCustomerOrderPage(getDb(), access, query)),

    getOrder: (orderNumber) => withOrders(() => getCustomerOrder(getDb(), access, orderNumber)),

    getTracking: (order, events) => buildTracking(order, events),

    getLiveTracking: async (orderNumber) => (ordersEnabled() ? getCustomerTracking(getDb(), access, orderNumber, null) : null),

    setDeliveryPoint: async (orderNumber, point) => (ordersEnabled() ? setDeliveryPoint(getDb(), access, orderNumber, point) : "unavailable"),

    getDeliveryCode: async (order) =>
      ordersEnabled() && (order.status === "dispatched" || order.status === "in_transit")
        ? getDeliveryCode(getDb(), access, order.orderNumber)
        : null,

    listPayments: (query) =>
      withOrders(async () => {
        const page = await listCustomerOrderPage(getDb(), access, query);
        return {
          items: page.items.map((order) => ({
            orderNumber: order.orderNumber,
            orderedAt: order.createdAt,
            method: order.paymentMethod,
            status: order.paymentStatus,
            amountMinor: order.totalMinor,
            currency: order.currency,
            transactionReference: null,
          })),
          page: page.page,
          pageCount: page.pageCount,
          total: page.total,
        };
      }),

    listAddresses: async () => ({ status: "not_connected", waitingFor: "a saved-addresses table and API" }),
    listInvoices: async () => ({ status: "not_connected", waitingFor: "the invoicing workflow (accounting / SAP)" }),
    listNotifications: async () => {
      if (!ordersEnabled()) return { status: "not_connected", waitingFor: ORDERS_WAITING };
      try {
        const rows = await listCustomerNotifications(getDb(), access);
        return { status: "ok", data: rows.map((row) => ({ ...row, ...NOTIFICATION_TEXT[row.kind] })) };
      } catch (error) {
        // A database without migration 0023 says so instead of failing the page.
        if (notificationsMissing(error)) return { status: "not_connected", waitingFor: NOTIFICATIONS_WAITING };
        throw error;
      }
    },

    countUnreadNotifications: async () => {
      if (!ordersEnabled()) return 0;
      try {
        return await countUnreadCustomerNotifications(getDb(), access);
      } catch (error) {
        if (notificationsMissing(error)) return 0;
        throw error;
      }
    },

    markNotificationsRead: async (id) => {
      if (!ordersEnabled()) return false;
      try {
        await markCustomerNotificationsRead(getDb(), access, id);
        return true;
      } catch (error) {
        if (notificationsMissing(error)) return false;
        throw error;
      }
    },
    listSessions: async () => ({ status: "not_connected", waitingFor: "session management in Supabase Auth" }),
  };
}

/** Product photo for each order line, from the catalogue; absent when the product is no longer listed. */
export async function loadLineImages(orders: readonly Pick<CustomerOrderSummary, "lines">[]): Promise<Map<string, string>> {
  const slugs = [...new Set(orders.flatMap((order) => order.lines.map((line) => line.productSlug)))];
  const images = new Map<string, string>();
  if (slugs.length === 0) return images;
  const catalog = await getCatalog();
  const products = await Promise.all(slugs.map((slug) => catalog.getProduct(slug, ACTIVE_COUNTRY.code).catch(() => null)));
  products.forEach((product, index) => {
    if (product) images.set(slugs[index]!, product.image);
  });
  return images;
}
