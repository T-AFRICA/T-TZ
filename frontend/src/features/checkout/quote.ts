import type { CatalogClient } from "@tronic/api-client";
import { ACTIVE_COUNTRY } from "@tronic/country-config";
import type { Product } from "@tronic/types";
import { lineKey, parseCart, type CartLine } from "@/features/cart/store";
import { DELIVERY_METHODS, type DeliveryMethodId } from "./config";

/**
 * Prices a checkout on the server (owner brief 2026-11-10: "never trust
 * frontend-submitted totals"). The browser sends only product ids, options
 * and quantities; every name, price and stock flag comes from the
 * catalogue here. Lines that cannot be bought are returned with a reason
 * and left out of the totals.
 *
 * Reads whichever catalogue the deployment uses (the CatalogClient: mock
 * sample data or the database). The quote is what the customer sees; the
 * order itself is repriced again inside the database transaction
 * (place_cod_order), so a stale quote can never set the price.
 *
 * Every amount is an integer in ISO 4217 minor units (TZS ×100).
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
  unitPriceMinor: number;
  /** Pre-discount price per unit, when the product is on sale. */
  wasPriceMinor: number | null;
  lineTotalMinor: number;
  issue: LineIssue | null;
}

export interface CheckoutQuote {
  currency: string;
  lines: QuoteLine[];
  /** Lines that could not be priced at all (product gone). */
  missing: number;
  /** Units that can be bought. */
  itemCount: number;
  subtotalMinor: number;
  /** Sum of (was price − price) × quantity for sale items. */
  savingsMinor: number;
  /** Null while the delivery fee is not configured. */
  deliveryFeeMinor: number | null;
  /** Subtotal plus delivery when known; the subtotal alone otherwise. */
  totalMinor: number;
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

/** Validates raw input from the browser and prices it from the catalogue. */
export async function quoteCheckout(
  raw: unknown,
  deliveryMethod: DeliveryMethodId,
  catalog: CatalogClient,
): Promise<CheckoutQuote> {
  const parsed = parseCart(raw).slice(0, MAX_CHECKOUT_LINES);
  const lines: QuoteLine[] = [];
  let missing = 0;
  const products = await Promise.all(parsed.map((line) => catalog.getProduct(line.productId, ACTIVE_COUNTRY.code)));

  for (const [index, line] of parsed.entries()) {
    const product = products[index];
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
      unitPriceMinor: product.priceMinor,
      wasPriceMinor:
        product.wasPriceMinor !== undefined && product.wasPriceMinor > product.priceMinor ? product.wasPriceMinor : null,
      lineTotalMinor: product.priceMinor * line.quantity,
      issue,
    });
  }

  const buyable = lines.filter((line) => line.issue === null);
  const subtotalMinor = buyable.reduce((sum, line) => sum + line.lineTotalMinor, 0);
  const savingsMinor = buyable.reduce(
    (sum, line) => sum + (line.wasPriceMinor === null ? 0 : (line.wasPriceMinor - line.unitPriceMinor) * line.quantity),
    0,
  );
  const deliveryFeeMinor = DELIVERY_METHODS.find((method) => method.id === deliveryMethod)?.feeMinor ?? null;

  return {
    currency: ACTIVE_COUNTRY.currency,
    lines,
    missing,
    itemCount: buyable.reduce((sum, line) => sum + line.quantity, 0),
    subtotalMinor,
    savingsMinor,
    deliveryFeeMinor,
    totalMinor: subtotalMinor + (deliveryFeeMinor ?? 0),
    totalIsPartial: deliveryFeeMinor === null,
  };
}
