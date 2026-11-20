import type { StockAdjustMode, StockLevel, StockReason } from "@tronic/api-contracts";

/** Display text for stock values that come from a country. Nothing here decides what may change: the country does. */

export const STOCK_REASON_LABEL: Record<StockReason, string> = {
  received: "Received from supplier",
  returned: "Returned by a customer",
  damaged: "Damaged",
  lost: "Lost or stolen",
  correction: "Count correction",
  other: "Other",
  order: "Order placed",
  order_cancelled: "Order cancelled",
};

export const STOCK_MODE_LABEL: Record<StockAdjustMode, string> = {
  add: "Add units",
  remove: "Remove units",
  set: "Set a counted total",
};

export const STOCK_LEVEL_LABEL: Record<StockLevel, string> = {
  ok: "In stock",
  low: "Low",
  out: "Out of stock",
};

export const STOCK_LEVEL_TONE: Record<StockLevel, "ok" | "neutral" | "warn" | "danger" | "info"> = {
  ok: "ok",
  low: "warn",
  out: "danger",
};

/** "+20", "−3". */
export function signedChange(change: number): string {
  return change > 0 ? `+${change}` : `−${Math.abs(change)}`;
}
