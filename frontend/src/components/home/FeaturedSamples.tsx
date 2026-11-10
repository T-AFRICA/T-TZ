import { MobileProductTabs } from "./MobileProductTabs";
import { ProductSection } from "./ProductSection";
import { FANS_COOLING_PICKS, LIGHTING_PICKS, SPECIAL_FOR_YOU } from "./sampleProducts";

/**
 * Homepage merchandising block. Below md the phone homepage shows one tabbed
 * block (New Arrivals, Best Sellers, Featured Products, All Products; owner
 * request 2026-11-10). From md up it shows "Special for you" and the themed
 * category rails (owner request Nov 2026).
 *
 * All data is SAMPLE-tagged synthetic merchandising — see sampleProducts.ts.
 */
export function FeaturedSamples() {
  return (
    <>
      <MobileProductTabs className="md:hidden" />
      <ProductSection
        title="Special for you"
        seeAllHref="/categories/lighting"
        products={SPECIAL_FOR_YOU}
        className="max-md:hidden"
      />
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
