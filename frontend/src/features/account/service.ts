import {
  countCustomerOrdersByStatus,
  getCustomerOrder,
  listCustomerOrderPage,
  type CustomerOrderDetail,
  type CustomerOrderPage,
  type CustomerOrderQuery,
  type CustomerOrderSummary,
} from "@tronic/database";
import { ACTIVE_COUNTRY } from "@tronic/country-config";
import type { SessionUser } from "@/features/auth/server";
import { getCatalog, getDb, ordersEnabled } from "@/features/data/source";
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
  id: string;
  kind: "order_confirmed" | "payment_confirmed" | "processing" | "dispatched" | "out_for_delivery" | "delivered" | "cancelled" | "refunded";
  orderNumber: string | null;
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
  getTracking(order: TrackableOrder): OrderTracking;
  listPayments(query?: Pick<CustomerOrderQuery, "page" | "pageSize">): Promise<ServiceResult<{ items: PaymentRecord[]; page: number; pageCount: number; total: number }>>;
  listAddresses(): Promise<ServiceResult<SavedAddress[]>>;
  listInvoices(): Promise<ServiceResult<InvoiceRecord[]>>;
  listNotifications(): Promise<ServiceResult<CustomerNotification[]>>;
  listSessions(): Promise<ServiceResult<CustomerSession[]>>;
}

const ORDERS_WAITING = "the order database (DATA_SOURCE=database)";

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

    getTracking: (order) => buildTracking(order),

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
    listNotifications: async () => ({ status: "not_connected", waitingFor: "order status events and a notification service" }),
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
