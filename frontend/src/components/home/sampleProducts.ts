import type { Product } from "@tronic/types";
import { ALL_SAMPLE_PRODUCTS } from "@tronic/api-client";
import { ACTIVE_COUNTRY, formatMoney } from "@tronic/country-config";

/**
 * Compatibility layer for the homepage and product components, which grew up
 * on a local sample set. The data now lives in packages/api-client (mock
 * catalogue) and the type in packages/types; these helpers keep the existing
 * imports working while routes move to the CatalogClient. Synchronous on
 * purpose: RecentlyViewed reads from localStorage on the client and
 * generateStaticParams runs at build time.
 *
 * SAMPLE PRICES ONLY: every figure is a synthetic demo value, never a real
 * offer or inventory; the UI labels them SAMPLE.
 */
export type SampleProduct = Product;
export type { ProductColor as SampleColor } from "@tronic/types";
export { SPECIAL_FOR_YOU, LIGHTING_PICKS, FANS_COOLING_PICKS } from "@tronic/api-client";

/** Formats a price for the active country, e.g. 28000 → "TZS 28,000". */
export function formatSamplePrice(amount: number): string {
  return formatMoney(amount, ACTIVE_COUNTRY);
}

/** Whole-percent saving for the badge; returns null when there is no discount. */
export function discountPercent(product: Product): number | null {
  if (product.wasPrice === undefined || product.wasPrice <= product.price) {
    return null;
  }
  return Math.round((1 - product.price / product.wasPrice) * 100);
}

const visible = (product: Product) =>
  product.active && product.countries.includes(ACTIVE_COUNTRY.code);

/** Every sample product visible in the active country, in catalogue order. */
export function allSampleProducts(): readonly Product[] {
  return ALL_SAMPLE_PRODUCTS.filter(visible);
}

export function getSampleProduct(id: string): Product | undefined {
  return allSampleProducts().find((product) => product.id === id);
}

/** Same-category products (excluding the product itself), catalogue order kept. */
export function relatedSampleProducts(product: Product, limit = 6): Product[] {
  return allSampleProducts()
    .filter((other) => other.categorySlug === product.categorySlug && other.id !== product.id)
    .slice(0, limit);
}
