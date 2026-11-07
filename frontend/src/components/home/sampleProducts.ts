/**
 * Sample merchandising data for the homepage product sections. Product
 * photography is official TRONIC imagery, sourced from the brand's Kenya
 * storefront (tronic.co.ke) at the owner's direction.
 *
 * SAMPLE PRICES ONLY: the catalogue and real prices arrive with Module 02 /
 * the product API. Every card is visibly tagged SAMPLE and all TZS figures,
 * discounts and stock states are synthetic demo values (owner request
 * Nov 2026: show the discount tag and stock status on cards) — never real
 * offers or inventory.
 */
export interface SampleProduct {
  id: string;
  name: string;
  categorySlug: string;
  categoryName: string;
  image: string;
  /** Synthetic display price in whole TZS (TZS has no minor units in practice). */
  price: number;
  /** Synthetic pre-discount price; when present the card shows a Save badge. */
  wasPrice?: number;
  /** Synthetic stock state for the demo card layout. */
  inStock: boolean;
  /**
   * Synthetic variant options; when present the card's Add to Cart opens a
   * quick-selection dialog instead of linking straight to the cart.
   */
  variants?: readonly string[];
  /** What the variant axis is (e.g. "Color Temperature", "Type"); shown on the PDP. */
  variantLabel?: string;
  /** Synthetic colour options rendered as swatches on the PDP. */
  colors?: readonly SampleColor[];
}

export interface SampleColor {
  name: string;
  /** CSS colour for the swatch circle. */
  swatch: string;
}

/** Formats a synthetic TZS amount for display, e.g. 28000 → "TZS 28,000". */
export function formatSamplePrice(amount: number): string {
  return `TZS ${amount.toLocaleString("en-US")}`;
}

/** Whole-percent saving for the badge; returns null when there is no discount. */
export function discountPercent(product: SampleProduct): number | null {
  if (product.wasPrice === undefined || product.wasPrice <= product.price) {
    return null;
  }
  return Math.round((1 - product.price / product.wasPrice) * 100);
}

/** Every sample product, for the PDP route and related-product rails. */
export function allSampleProducts(): readonly SampleProduct[] {
  return [...SPECIAL_FOR_YOU, ...LIGHTING_PICKS, ...FANS_COOLING_PICKS];
}

export function getSampleProduct(id: string): SampleProduct | undefined {
  return allSampleProducts().find((product) => product.id === id);
}

/** Same-category products (excluding the product itself), newest-first order kept. */
export function relatedSampleProducts(product: SampleProduct, limit = 6): SampleProduct[] {
  return allSampleProducts()
    .filter((other) => other.categorySlug === product.categorySlug && other.id !== product.id)
    .slice(0, limit);
}

export const SPECIAL_FOR_YOU: readonly SampleProduct[] = [
  {
    id: "sample-led-panel",
    name: "24W LED Panel Light",
    categorySlug: "lighting",
    categoryName: "Lighting",
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
    image: "/products/top-plug.jpg",
    price: 18_500,
    inStock: true,
  },
  {
    id: "sample-extension",
    name: "Extension Socket with USB-C",
    categorySlug: "switches-sockets",
    categoryName: "Switches & Sockets",
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
    image: "/products/hero-cable.png",
    price: 35_000,
    inStock: false,
  },
  {
    id: "sample-led-bulb",
    name: "Warm Glow LED Bulb",
    categorySlug: "lighting",
    categoryName: "Lighting",
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
    image: "/products/circuit-breaker.jpg",
    price: 24_000,
    inStock: true,
  },
  {
    id: "sample-water-heater",
    name: "Water Heater 15L",
    categorySlug: "home-appliances",
    categoryName: "Home & Appliances",
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
    image: "/products/ceiling-fan.jpg",
    price: 98_000,
    inStock: true,
  },
];

export const LIGHTING_PICKS: readonly SampleProduct[] = [
  {
    id: "sample-downlight",
    name: "10W Spot LED Downlight",
    categorySlug: "lighting",
    categoryName: "Lighting",
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
    image: "/products/garden-post-light.jpg",
    price: 72_000,
    inStock: false,
  },
  {
    id: "sample-surface-ceiling",
    name: "20W LED Surface Ceiling Light",
    categorySlug: "lighting",
    categoryName: "Lighting",
    image: "/products/surface-ceiling-light.jpg",
    price: 38_000,
    wasPrice: 45_000,
    inStock: true,
  },
];

export const FANS_COOLING_PICKS: readonly SampleProduct[] = [
  {
    id: "sample-stand-fan",
    name: "16″ Brushless DC Stand Fan",
    categorySlug: "home-appliances",
    categoryName: "Home & Appliances",
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
    image: "/products/wall-fan.jpg",
    price: 210_000,
    inStock: true,
  },
  {
    id: "sample-exhaust-fan",
    name: "6″ Exhaust Fan 11W",
    categorySlug: "home-appliances",
    categoryName: "Home & Appliances",
    image: "/products/exhaust-fan.jpg",
    price: 32_000,
    inStock: true,
  },
  {
    id: "sample-industrial-exhaust",
    name: "12″ BLDC Industrial Exhaust Fan",
    categorySlug: "home-appliances",
    categoryName: "Home & Appliances",
    image: "/products/industrial-exhaust-fan.jpg",
    price: 165_000,
    wasPrice: 195_000,
    inStock: true,
  },
];
