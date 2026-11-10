import type { Product } from "@tronic/types";
import { ProductCard } from "./ProductCard";
import { ProductTabs } from "./ProductTabs";
import { SPECIAL_FOR_YOU, allSampleProducts } from "./sampleProducts";

/**
 * PLACEHOLDER "Best Sellers" picks. There is no order data yet, so this is a
 * hand-picked list of SAMPLE products, not a sales ranking. Replace it with a
 * query on real order volume once the live catalogue and orders exist.
 */
const BEST_SELLER_PICK_IDS = [
  "sample-led-bulb",
  "sample-top-plug",
  "sample-extension",
  "sample-breaker",
  "sample-ceiling-fan",
  "sample-armoured-cable",
  "sample-downlight",
  "sample-stand-fan",
] as const;

const RAIL_SIZE = 8;

/** Newest first by catalogue sequence (the same order as the "newest" sort). */
export function newArrivals(products: readonly Product[]): Product[] {
  return [...products].sort((a, b) => b.sequence - a.sequence).slice(0, RAIL_SIZE);
}

/** Placeholder best sellers, in pick order, skipping any product not visible. */
export function bestSellerPicks(products: readonly Product[]): Product[] {
  return BEST_SELLER_PICK_IDS.flatMap((id) => products.find((product) => product.id === id) ?? []);
}

function Grid({ products }: { products: readonly Product[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </ul>
  );
}

/**
 * Phone homepage product block (owner request 2026-11-10): New Arrivals,
 * Best Sellers, Featured Products and All Products as tabs. It replaces the
 * single "Special for you" rail below md; desktop keeps its rails. Every
 * product is SAMPLE-tagged synthetic data (see sampleProducts.ts).
 */
export function MobileProductTabs({ className }: { className?: string }) {
  const all = allSampleProducts();
  const visibleIds = new Set(all.map((product) => product.id));
  const featured = SPECIAL_FOR_YOU.filter((product) => visibleIds.has(product.id));

  return (
    <ProductTabs
      label="Products"
      className={className}
      tabs={[
        { id: "new", label: "New Arrivals", content: <Grid products={newArrivals(all)} /> },
        { id: "best", label: "Best Sellers", content: <Grid products={bestSellerPicks(all)} /> },
        { id: "featured", label: "Featured Products", content: <Grid products={featured} /> },
        { id: "all", label: "All Products", content: <Grid products={all} /> },
      ]}
    />
  );
}
