import { CATEGORY_SECTIONS } from "@tronic/country-config";
import { CategoryBannerCard, type CategoryBanner } from "./CategoryBannerCard";

/**
 * Banner photography per category (owner-supplied 2026-11-07, rendered to
 * 1600x800 WOFF-free WebP in /public/categories). The fan photograph is
 * official TRONIC imagery; the others are stock scenes of the category's
 * subject and carry no TRONIC branding or product claims. Replace a file to
 * change a banner; the slug must stay a CATEGORY_SECTIONS slug.
 */
const BANNER_ART: Record<string, Pick<CategoryBanner, "alt">> = {
  "cables-wiring": {
    alt: "Cross-section of an armoured power cable showing its copper conductors",
  },
  lighting: {
    alt: "Living room lit by pendant lamps and warm cove lighting",
  },
  "switches-sockets": {
    alt: "White twin socket with switches on a kitchen wall",
  },
  "switchgear-protection": {
    alt: "Row of low-voltage switchgear panels in a plant room",
  },
  "home-appliances": {
    alt: "TRONIC stand fan in a bright living room",
  },
  "cable-management": {
    alt: "Cables routed through galvanised cable trays in an industrial hall",
  },
  tools: {
    alt: "Insulated pliers, screwdrivers and a digital multimeter",
  },
  "shop-by-use": {
    alt: "Modern villa at dusk with illuminated facade and pool",
  },
};

const BANNERS: readonly CategoryBanner[] = CATEGORY_SECTIONS.map((section) => {
  const art = BANNER_ART[section.slug];
  if (!art || !section.description) {
    throw new Error(`No banner art or description for category "${section.slug}"`);
  }
  return {
    slug: section.slug,
    name: section.name,
    tagline: section.description,
    image: `/categories/${section.slug}.webp`,
    ...art,
  };
});

/**
 * "Explore Our Categories": the eight navbar categories as photographic
 * banners, two per row at every size. On phones the first two are tall
 * feature tiles and the rest compact tiles (oraimo reference). Replaces the
 * circular rail on the homepage (the navbar keeps its own category menu).
 */
export function CategoryShowcase() {
  return (
    <section aria-labelledby="category-showcase-title" className="mt-3 md:mt-8">
      {/* The banners speak for themselves (owner request 2026-11-07): the title
          stays for assistive tech and the document outline only. */}
      <h2 id="category-showcase-title" className="sr-only">
        Explore Our Categories
      </h2>
      <ul className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 md:gap-4">
        {BANNERS.map((banner, index) => (
          <li key={banner.slug} className="min-w-0">
            <CategoryBannerCard banner={banner} variant={index < 2 ? "feature" : "compact"} priority={index < 2} />
          </li>
        ))}
      </ul>
    </section>
  );
}
