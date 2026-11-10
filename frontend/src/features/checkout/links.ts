import { MAX_LINE_QUANTITY, parseCart, type CartLine } from "@/features/cart/store";

/**
 * Buy Now goes straight to checkout with just that product (owner brief
 * 2026-11-10); it never touches the cart. The line travels in the URL so a
 * refresh keeps it. The server re-validates and re-prices it like any
 * other checkout line.
 */
export const CHECKOUT_PATH = "/checkout";

export function buyNowHref(line: CartLine): string {
  const params = new URLSearchParams({ buy: line.productId, qty: String(line.quantity) });
  if (line.color) params.set("color", line.color);
  if (line.variant) params.set("variant", line.variant);
  return `${CHECKOUT_PATH}?${params.toString()}`;
}

type Params = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** The Buy Now line from checkout search params, or null for a cart checkout. */
export function parseBuyNowParams(params: Params): CartLine | null {
  const productId = one(params.buy);
  if (!productId) return null;
  const quantity = Number(one(params.qty) ?? "1");
  const [line] = parseCart([
    {
      productId,
      color: one(params.color) ?? null,
      variant: one(params.variant) ?? null,
      quantity: Number.isInteger(quantity) ? Math.min(Math.max(quantity, 1), MAX_LINE_QUANTITY) : 1,
    },
  ]);
  return line ?? null;
}
