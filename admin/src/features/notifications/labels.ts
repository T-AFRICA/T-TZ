import type { NotificationAudience, StaffNotification, StaffNotificationKind } from "@tronic/api-contracts";
import type { Tone } from "@/components/ui";

/**
 * What an administrator or a rider reads for each kind of notification.
 * The country stores what happened and to which order or product; the
 * wording and the link are chosen here.
 */
export const NOTIFICATION_TITLE: Record<StaffNotificationKind, string> = {
  order_placed: "New order",
  order_cancelled: "Order cancelled",
  order_delivered: "Order delivered",
  delivery_failed: "Delivery attempt failed",
  stock_low: "Low stock",
  stock_out: "Out of stock",
  delivery_assigned: "New delivery",
  delivery_reassigned: "Delivery moved",
  delivery_cancelled: "Delivery cancelled",
};

export const NOTIFICATION_TONE: Record<StaffNotificationKind, Tone> = {
  order_placed: "info",
  order_cancelled: "danger",
  order_delivered: "ok",
  delivery_failed: "warn",
  stock_low: "warn",
  stock_out: "danger",
  delivery_assigned: "info",
  delivery_reassigned: "neutral",
  delivery_cancelled: "danger",
};

export const AUDIENCE_LABEL: Record<NotificationAudience, string> = {
  orders: "Orders",
  inventory: "Stock",
  rider: "My deliveries",
};

export interface DescribedNotification {
  body: string;
  /** Where the notification leads, inside the country's console; null when there is nothing to open. */
  href: string | null;
}

/** The sentence and the link for one notification. `base` is the country's console path ("/c/tz"). */
export function describeNotification(
  item: Pick<StaffNotification, "kind" | "orderNumber" | "productSlug" | "productName">,
  base: string,
): DescribedNotification {
  const order = item.orderNumber ? `Order ${item.orderNumber}` : "An order";
  const orderHref = item.orderNumber ? `${base}/orders/${encodeURIComponent(item.orderNumber)}` : null;
  const product = item.productName ?? "A product";
  const productHref = item.productSlug ? `${base}/inventory/${encodeURIComponent(item.productSlug)}` : null;
  switch (item.kind) {
    case "order_placed":
      return { body: `${order} was placed and is waiting to be confirmed.`, href: orderHref };
    case "order_cancelled":
      return { body: `${order} was cancelled by another administrator.`, href: orderHref };
    case "order_delivered":
      return { body: `${order} was delivered.`, href: orderHref };
    case "delivery_failed":
      return { body: `${order} could not be delivered. The reason is on the order.`, href: orderHref };
    case "stock_low":
      return { body: `${product} has reached its low-stock level.`, href: productHref };
    case "stock_out":
      return { body: `${product} has run out.`, href: productHref };
    case "delivery_assigned":
      return {
        body: `${order} was given to you.`,
        href: item.orderNumber ? `${base}/deliveries/${encodeURIComponent(item.orderNumber)}` : `${base}/deliveries`,
      };
    case "delivery_reassigned":
      return { body: `${order} was given to another rider. It is no longer yours.`, href: `${base}/deliveries` };
    case "delivery_cancelled":
      return { body: `${order} was cancelled. Do not deliver it.`, href: `${base}/deliveries` };
  }
}

/** The badge text for an unread count: the number, or "99+" past ninety-nine; null for none. */
export function unreadBadge(count: number): string | null {
  if (!Number.isFinite(count) || count < 1) return null;
  return count > 99 ? "99+" : String(Math.floor(count));
}
