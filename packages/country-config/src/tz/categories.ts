import type { CategorySection, NavLink } from "@tronic/types";

/**
 * The eight source-defined navbar sections for Tanzania (SRS §7, FR-002).
 * Group-level detail comes from the SRS category table; the deeper
 * subcategory tree lands when the Website Content Structure document is
 * supplied. Names and hierarchy require business sign-off before launch.
 */
export const CATEGORY_SECTIONS: readonly CategorySection[] = [
  {
    slug: "cables-wiring",
    name: "Cables & Wiring",
    groups: [
      { slug: "power-cables", name: "Power Cables" },
      { slug: "data-signal", name: "Data & Signal" },
      { slug: "cable-accessories", name: "Cable Accessories" },
    ],
  },
  {
    slug: "lighting",
    name: "Lighting",
    groups: [
      { slug: "indoor-lighting", name: "Indoor Lighting" },
      { slug: "outdoor-lighting", name: "Outdoor Lighting" },
      { slug: "decorative-lighting", name: "Decorative Lighting" },
    ],
  },
  {
    slug: "switches-sockets",
    name: "Switches & Sockets",
    groups: [
      { slug: "switches-sockets", name: "Switches & Sockets" },
      { slug: "power-outlets-extensions", name: "Power Outlets & Extensions" },
      { slug: "control-accessories", name: "Control & Accessories" },
    ],
  },
  {
    slug: "switchgear-protection",
    name: "Switchgear & Protection",
    groups: [
      { slug: "distribution-panels", name: "Distribution & Panels" },
      { slug: "circuit-breakers", name: "Circuit Breakers" },
      { slug: "control-motor-gear", name: "Control & Motor Gear" },
      { slug: "earthing-surge", name: "Earthing & Surge" },
    ],
  },
  {
    slug: "home-appliances",
    name: "Home & Appliances",
    groups: [
      { slug: "fans-cooling", name: "Fans & Cooling" },
      { slug: "heating-water", name: "Heating & Water" },
      { slug: "appliance-protection", name: "Appliance Protection" },
      { slug: "signalling-security", name: "Signalling & Security" },
    ],
  },
  {
    slug: "cable-management",
    name: "Cable Management",
    groups: [
      { slug: "trunkings", name: "Trunkings" },
      { slug: "cable-trays", name: "Cable Trays" },
      { slug: "pvc-conduits", name: "PVC Conduits" },
      { slug: "galvanized-conduits", name: "Galvanized Conduits" },
    ],
  },
  {
    slug: "tools",
    name: "Tools",
    groups: [
      { slug: "hand-tools", name: "Hand Tools" },
      { slug: "power-tools", name: "Power Tools" },
      { slug: "ladders", name: "Ladders" },
    ],
  },
  {
    slug: "shop-by-use",
    name: "Shop by Use",
    groups: [
      { slug: "for-homeowners", name: "For Homeowners" },
      { slug: "for-contractors", name: "For Contractors" },
      { slug: "for-commercial", name: "For Commercial" },
    ],
  },
] as const;

/**
 * Dedicated Meter navbar item (SRS FR-003). Exactly one customer-facing page
 * at /meter; it must never carry payment UI (FR-035/FR-043).
 */
export const METER_NAV_ITEM: NavLink = {
  href: "/meter",
  // Owner-approved label (Nov 2026): "Meter Token Issuer".
  label: "Meter Token Issuer",
};

export function getCategorySection(slug: string): CategorySection | undefined {
  return CATEGORY_SECTIONS.find((section) => section.slug === slug);
}
