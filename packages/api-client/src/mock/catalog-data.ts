import type { Product } from "@tronic/types";

/**
 * SAMPLE catalogue (owner request Nov 2026): official TRONIC product
 * photography sourced from the brand's Kenya storefront at the owner's
 * direction, with synthetic prices, discounts and stock states so the
 * storefront can be exercised before the live catalogue. Every figure here
 * is a demo value, never a real offer or inventory count; the UI labels them
 * SAMPLE. Group placement follows the Tanzania taxonomy so navigation can be
 * tested, and `useCases` places each product under Shop by Use (homeowner,
 * contractor, commercial) without duplicating it; `sequence` is catalogue
 * order for the "newest" sort.
 */
type Seed = Omit<Product, "slug" | "sku" | "currency" | "countries" | "active" | "sequence"> & {
  brand?: string;
};

const CURRENCY = "TZS";

function seed(list: readonly Seed[], start: number): Product[] {
  return list.map((item, index) => ({
    slug: item.id,
    sku: item.id.toUpperCase(),
    currency: CURRENCY,
    countries: ["TZ"],
    active: true,
    sequence: start + index,
    brand: "TRONIC",
    ...item,
  }));
}

export const SPECIAL_FOR_YOU: readonly Product[] = seed(
  [
    {
      id: "sample-led-panel",
      name: "24W LED Panel Light",
      categorySlug: "lighting",
      categoryName: "Lighting",
      groupSlug: "indoor-lighting",
      useCases: ["for-homeowners", "for-commercial"],
      image: "/products/panel-light.png",
      price: 28_000,
      wasPrice: 35_000,
      inStock: true,
    },
    {
      id: "sample-top-plug",
      name: "13A Top Plug",
      categorySlug: "switches-sockets",
      categoryName: "Switches & Sockets",
      groupSlug: "switches-sockets",
      useCases: ["for-homeowners", "for-contractors"],
      image: "/products/top-plug.jpg",
      price: 18_500,
      inStock: true,
    },
    {
      id: "sample-extension",
      name: "Extension Socket with USB-C",
      categorySlug: "switches-sockets",
      categoryName: "Switches & Sockets",
      groupSlug: "power-outlets-extensions",
      useCases: ["for-homeowners"],
      image: "/products/extension-socket.jpg",
      price: 22_000,
      wasPrice: 27_500,
      inStock: true,
      variants: ["3-way", "4-way", "6-way"],
      variantLabel: "Type",
      colors: [
        { name: "White", swatch: "#f4f4f2" },
        { name: "Black", swatch: "#1f1f23" },
      ],
    },
    {
      id: "sample-armoured-cable",
      name: "Armoured Cable 4 Core",
      categorySlug: "cables-wiring",
      categoryName: "Cables & Wiring",
      groupSlug: "power-cables",
      useCases: ["for-contractors", "for-commercial"],
      image: "/products/hero-cable.png",
      price: 35_000,
      inStock: false,
    },
    {
      id: "sample-led-bulb",
      name: "Warm Glow LED Bulb",
      categorySlug: "lighting",
      categoryName: "Lighting",
      groupSlug: "indoor-lighting",
      useCases: ["for-homeowners"],
      image: "/products/led-bulb.png",
      price: 6_500,
      wasPrice: 8_000,
      inStock: true,
      variants: ["Warm White", "Cool White", "Daylight"],
      variantLabel: "Color Temperature",
    },
    {
      id: "sample-breaker",
      name: "2 Pole Circuit Breaker 63A",
      categorySlug: "switchgear-protection",
      categoryName: "Switchgear & Protection",
      groupSlug: "circuit-breakers",
      useCases: ["for-contractors", "for-commercial"],
      image: "/products/circuit-breaker.jpg",
      price: 24_000,
      inStock: true,
    },
    {
      id: "sample-water-heater",
      name: "Water Heater 15L",
      categorySlug: "home-appliances",
      categoryName: "Home & Appliances",
      groupSlug: "heating-water",
      useCases: ["for-homeowners"],
      image: "/products/water-heater.jpg",
      price: 185_000,
      wasPrice: 215_000,
      inStock: true,
    },
    {
      id: "sample-ceiling-fan",
      name: "BLDC Ceiling Fan",
      categorySlug: "home-appliances",
      categoryName: "Home & Appliances",
      groupSlug: "fans-cooling",
      useCases: ["for-homeowners"],
      image: "/products/ceiling-fan.jpg",
      price: 98_000,
      inStock: true,
    },
  ],
  1,
);

export const LIGHTING_PICKS: readonly Product[] = seed(
  [
    {
      id: "sample-downlight",
      name: "10W Spot LED Downlight",
      categorySlug: "lighting",
      categoryName: "Lighting",
      groupSlug: "indoor-lighting",
      useCases: ["for-homeowners", "for-contractors"],
      image: "/products/downlight-spot.jpg",
      price: 12_500,
      wasPrice: 15_000,
      inStock: true,
    },
    {
      id: "sample-pendant",
      name: "Single Pendant Lamp",
      categorySlug: "lighting",
      categoryName: "Lighting",
      groupSlug: "decorative-lighting",
      useCases: ["for-homeowners"],
      image: "/products/pendant-lamp.jpg",
      price: 65_000,
      inStock: true,
      colors: [
        { name: "White", swatch: "#f5f3ee" },
        { name: "Matte Black", swatch: "#26262a" },
        { name: "Brass", swatch: "#b98d4f" },
      ],
    },
    {
      id: "sample-garden-post",
      name: "Outdoor Garden Post Light",
      categorySlug: "lighting",
      categoryName: "Lighting",
      groupSlug: "outdoor-lighting",
      useCases: ["for-homeowners", "for-commercial"],
      image: "/products/garden-post-light.jpg",
      price: 72_000,
      inStock: false,
    },
    {
      id: "sample-surface-ceiling",
      name: "20W LED Surface Ceiling Light",
      categorySlug: "lighting",
      categoryName: "Lighting",
      groupSlug: "indoor-lighting",
      useCases: ["for-homeowners", "for-commercial"],
      image: "/products/surface-ceiling-light.jpg",
      price: 38_000,
      wasPrice: 45_000,
      inStock: true,
    },
  ],
  101,
);

export const FANS_COOLING_PICKS: readonly Product[] = seed(
  [
    {
      id: "sample-stand-fan",
      name: "16″ Brushless DC Stand Fan",
      categorySlug: "home-appliances",
      categoryName: "Home & Appliances",
      groupSlug: "fans-cooling",
      useCases: ["for-homeowners"],
      image: "/products/stand-fan.jpg",
      price: 145_000,
      wasPrice: 170_000,
      inStock: true,
      colors: [
        { name: "White", swatch: "#f4f4f2" },
        { name: "Graphite", swatch: "#4a4d52" },
      ],
    },
    {
      id: "sample-wall-fan",
      name: "24″ Industrial Wall Fan",
      categorySlug: "home-appliances",
      categoryName: "Home & Appliances",
      groupSlug: "fans-cooling",
      useCases: ["for-commercial"],
      image: "/products/wall-fan.jpg",
      price: 210_000,
      inStock: true,
    },
    {
      id: "sample-exhaust-fan",
      name: "6″ Exhaust Fan 11W",
      categorySlug: "home-appliances",
      categoryName: "Home & Appliances",
      groupSlug: "fans-cooling",
      useCases: ["for-homeowners", "for-commercial"],
      image: "/products/exhaust-fan.jpg",
      price: 32_000,
      inStock: true,
    },
    {
      id: "sample-industrial-exhaust",
      name: "12″ BLDC Industrial Exhaust Fan",
      categorySlug: "home-appliances",
      categoryName: "Home & Appliances",
      groupSlug: "fans-cooling",
      useCases: ["for-commercial", "for-contractors"],
      image: "/products/industrial-exhaust-fan.jpg",
      price: 165_000,
      wasPrice: 195_000,
      inStock: true,
    },
  ],
  201,
);

/** Every sample product, in catalogue order. */
export const ALL_SAMPLE_PRODUCTS: readonly Product[] = [
  ...SPECIAL_FOR_YOU,
  ...LIGHTING_PICKS,
  ...FANS_COOLING_PICKS,
];
