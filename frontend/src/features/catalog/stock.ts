/**
 * How availability is worded and how many units can be chosen (owner
 * decision 2026-11-21: customers see how many units are available).
 *
 * The count comes from the catalogue when it knows it
 * (Product.stockAvailable, country migration 0022). Without it the
 * storefront says only "In stock" or "Out of stock", as before. The count
 * is information, not a reservation: the order checks the stock again and
 * refuses a line that asks for more than is there.
 */
interface Stocked {
  inStock: boolean;
  stockAvailable?: number | undefined;
}

/** At or under this many units the label says "Only N left". */
export const LOW_STOCK_UNITS = 5;

const units = (count: number) => count.toLocaleString("en-GB");

/** "Out of stock", "In stock", "Only 3 left" or "120 in stock". */
export function stockLabel(product: Stocked): string {
  if (!product.inStock) return "Out of stock";
  const count = product.stockAvailable;
  if (count === undefined || count <= 0) return "In stock";
  return count <= LOW_STOCK_UNITS ? `Only ${units(count)} left` : `${units(count)} in stock`;
}

/** The most units of this product that can be chosen: the line limit, or what is available if that is less. */
export function purchaseLimit(product: Stocked, lineLimit: number): number {
  const count = product.stockAvailable;
  if (count === undefined || count <= 0) return lineLimit;
  return Math.min(lineLimit, count);
}

/** What to say when the chosen quantity has reached the limit. */
export function limitHint(product: Stocked, lineLimit: number): string {
  const count = product.stockAvailable;
  return count !== undefined && count > 0 && count < lineLimit ? `Only ${units(count)} available` : "Maximum quantity reached";
}
