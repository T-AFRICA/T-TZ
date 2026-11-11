import type { Product } from "@tronic/types";
import { getSampleProduct } from "@/components/home/sampleProducts";
import { lineKey, type CartLine } from "./store";

/**
 * Joins stored cart lines with the catalogue. Prices, names, images and
 * stock always come from the catalogue, never from storage. A product that
 * is gone or hidden in this country comes back as `product: null`, so the
 * cart can say so and offer to remove it.
 *
 * Reads the bundled sample catalogue synchronously, as RecentlyViewed
 * does. When the live catalogue lands this becomes a server lookup and the
 * cart totals move to the cart service (features/cart/README.md).
 */
export interface ResolvedLine {
  key: string;
  line: CartLine;
  product: Product | null;
}

export function resolveLines(lines: readonly CartLine[]): ResolvedLine[] {
  return lines.map((line) => ({ key: lineKey(line), line, product: getSampleProduct(line.productId) ?? null }));
}

export interface CartSummary {
  /** Units that can be bought (in stock, still listed). */
  itemCount: number;
  /** Sum of catalogue price × quantity for those units, in minor units. */
  subtotal: number;
}

export function summarize(lines: readonly ResolvedLine[]): CartSummary {
  let itemCount = 0;
  let subtotal = 0;
  for (const { line, product } of lines) {
    if (!product || !product.inStock) continue;
    itemCount += line.quantity;
    subtotal += product.priceMinor * line.quantity;
  }
  return { itemCount, subtotal };
}

export function resolveWishlist(ids: readonly string[]): Product[] {
  return ids.map((id) => getSampleProduct(id)).filter((product): product is Product => product !== undefined);
}
