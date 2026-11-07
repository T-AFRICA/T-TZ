"use client";

import { useEffect, useState } from "react";
import { ProductCard } from "@/components/home/ProductCard";
import { getSampleProduct, type SampleProduct } from "@/components/home/sampleProducts";

const STORAGE_KEY = "tronic.recently-viewed";
const MAX_ITEMS = 6;

/**
 * Per-visitor "recently viewed" rail backed by localStorage (a browser
 * convenience, never shared state). Records the current product on mount
 * and shows the earlier ones; renders nothing on a first visit or when
 * storage is unavailable (private windows), so the page never depends on it.
 */
export function RecentlyViewed({ currentId }: { currentId: string }) {
  const [products, setProducts] = useState<SampleProduct[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const previous: string[] = raw ? (JSON.parse(raw) as string[]) : [];
      const others = previous.filter((id) => id !== currentId);
      setProducts(
        others
          .map((id) => getSampleProduct(id))
          .filter((product): product is SampleProduct => product !== undefined)
          .slice(0, MAX_ITEMS),
      );
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([currentId, ...others].slice(0, MAX_ITEMS + 1)),
      );
    } catch {
      // Storage unavailable — the rail simply stays hidden.
    }
  }, [currentId]);

  if (products.length === 0) {
    return null;
  }

  return (
    <section aria-label="Recently viewed — sample products" className="mt-10 md:mt-14">
      <h2
        className="text-lg font-bold leading-tight md:text-[length:var(--text-h3)]"
        style={{ fontFamily: "var(--font-heading, var(--font-fallback-heading))" }}
      >
        Recently viewed
      </h2>
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:mt-5 md:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </ul>
    </section>
  );
}
