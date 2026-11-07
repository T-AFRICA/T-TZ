import { ProductSection } from "./ProductSection";
import { FANS_COOLING_PICKS, LIGHTING_PICKS, SPECIAL_FOR_YOU } from "./sampleProducts";

/**
 * Homepage merchandising block. "Special for you" shows on every breakpoint
 * (approved mobile UI reference, Nov 2026); the themed category rails are
 * desktop additions (owner request Nov 2026) and stay hidden below md so the
 * approved app-style mobile homepage keeps its single product section.
 *
 * All data is SAMPLE-tagged synthetic merchandising — see sampleProducts.ts.
 */
export function FeaturedSamples() {
  return (
    <>
      <ProductSection title="Special for you" seeAllHref="/categories/lighting" products={SPECIAL_FOR_YOU} />
      <ProductSection
        title="Light up every room"
        seeAllHref="/categories/lighting"
        products={LIGHTING_PICKS}
        className="max-md:hidden"
      />
      <ProductSection
        title="Fans & cooling"
        seeAllHref="/categories/home-appliances"
        products={FANS_COOLING_PICKS}
        className="max-md:hidden"
      />
    </>
  );
}
