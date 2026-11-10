import type { Product } from "@tronic/types";
import { getSampleProduct } from "@/components/home/sampleProducts";
import { lineKey, parseCart, type CartLine } from "@/features/cart/store";
import { DELIVERY_METHODS, type DeliveryMethodId } from "./config";

/**
 * Prices a checkout on the server (owner brief 2026-11-10: "never trust
 * frontend-submitted totals"). The browser sends only product ids, options
 * and quantities; every name, price and stock flag comes from the
 * catalogue here. Lines that cannot be bought are returned with a reason
 * and left out of the totals.
 *
 * Reads the sample catalogue for now; with the live catalogue this reads
 * prices and stock from the database, and the order action re-runs it
 * inside the order transaction.
 */
export type LineIssue = "unavailable" | "out_of_stock" | "invalid_options";

export interface QuoteLine {
  key: string;
  productId: string;
  name: string;
  sku: string;
  slug: string;
  image: string;
  categoryName: string;
  color: string | null;
  variant: string | null;
  quantity: number;
  /** Catalogue price per unit, minor units. */
  unitPrice: number;
  /** Pre-discount price per unit, when the product is on sale. */
  wasPrice: number | null;
  lineTotal: number;
  issue: LineIssue | null;
}

export interface CheckoutQuote {
  currency: string;
  lines: QuoteLine[];
  /** Lines that could not be priced at all (product gone). */
  missing: number;
  /** Units that can be bought. */
  itemCount: number;
  subtotal: number;
  /** Sum of (was price − price) × quantity for sale items. */
  savings: number;
  /** Null while the delivery fee is not configured. */
  deliveryFee: number | null;
  /** Subtotal plus delivery when known; the subtotal alone otherwise. */
  total: number;
  /** True when the total still lacks the delivery fee. */
  totalIsPartial: boolean;
}

export const MAX_CHECKOUT_LINES = 50;

function optionIssue(product: Product, line: CartLine): boolean {
  const colors = product.colors?.map((color) => color.name) ?? [];
  const variants = product.variants ?? [];
  const colorOk = colors.length === 0 ? line.color === null : line.color !== null && colors.includes(line.color);
  const variantOk = variants.length === 0 ? line.variant === null : line.variant !== null && variants.includes(line.variant);
  return !(colorOk && variantOk);
}

/** Validates raw input from the browser and prices it. */
export function quoteCheckout(raw: unknown, deliveryMethod: DeliveryMethodId = "home"): CheckoutQuote {
  const parsed = parseCart(raw).slice(0, MAX_CHECKOUT_LINES);
  const lines: QuoteLine[] = [];
  let missing = 0;

  for (const line of parsed) {
    const product = getSampleProduct(line.productId);
    if (!product) {
      missing += 1;
      continue;
    }
    const issue: LineIssue | null = optionIssue(product, line)
      ? "invalid_options"
      : !product.inStock
        ? "out_of_stock"
        : null;
    lines.push({
      key: lineKey(line),
      productId: product.id,
      name: product.name,
      sku: product.sku,
      slug: product.slug,
      image: product.image,
      categoryName: product.categoryName,
      color: line.color,
      variant: line.variant,
      quantity: line.quantity,
      unitPrice: product.price,
      wasPrice: product.wasPrice !== undefined && product.wasPrice > product.price ? product.wasPrice : null,
      lineTotal: product.price * line.quantity,
      issue,
    });
  }

  const buyable = lines.filter((line) => line.issue === null);
  const subtotal = buyable.reduce((sum, line) => sum + line.lineTotal, 0);
  const savings = buyable.reduce(
    (sum, line) => sum + (line.wasPrice === null ? 0 : (line.wasPrice - line.unitPrice) * line.quantity),
    0,
  );
  const deliveryFee = DELIVERY_METHODS.find((method) => method.id === deliveryMethod)?.feeMinor ?? null;

  return {
    currency: "TZS",
    lines,
    missing,
    itemCount: buyable.reduce((sum, line) => sum + line.quantity, 0),
    subtotal,
    savings,
    deliveryFee,
    total: subtotal + (deliveryFee ?? 0),
    totalIsPartial: deliveryFee === null,
  };
}
