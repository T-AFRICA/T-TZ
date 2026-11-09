import type { CategorySection, NavLink } from "@tronic/types";

/**
 * The eight source-defined navbar sections for Tanzania (SRS §7, FR-002),
 * their groups and, from the owner's Website Content Structure diagrams
 * (2026-11-09), the subcategories under each group. The hierarchy is
 * Navbar section > Category group > Subcategory; Tools and Shop by Use stop
 * at the group level in those diagrams. Names and hierarchy require business
 * sign-off before launch.
 */
export const CATEGORY_SECTIONS: readonly CategorySection[] = [
  {
    slug: "cables-wiring",
    name: "Cables & Wiring",
    description: "Power cables and copper wiring",
    groups: [
      {
        slug: "power-cables",
        name: "Power Cables",
        subcategories: [
          { slug: "single-core-cables", name: "Single Core Cables" },
          { slug: "twin-with-earth-cables", name: "Twin With Earth Cables" },
          { slug: "1-core-flexible-cables", name: "1 Core Flexible Cables" },
          { slug: "2-core-flexible-cables", name: "2 Core Flexible Cables" },
          { slug: "3-core-flexible-cables", name: "3 Core Flexible Cables" },
          { slug: "4-core-flexible-cables", name: "4 Core Flexible Cables" },
          { slug: "5-core-flexible-cables", name: "5 Core Flexible Cables" },
          { slug: "armoured-xlpe-cables", name: "Armoured XLPE Cables" },
          { slug: "submersible-cables", name: "Submersible Cables" },
          { slug: "twin-flat-cable", name: "Twin Flat Cable" },
        ],
      },
      {
        slug: "data-signal",
        name: "Data & Signal",
        subcategories: [
          { slug: "networking-cables", name: "Networking Cables" },
          { slug: "coaxial-cables", name: "Coaxial Cables" },
          { slug: "hdmi-vga-cables", name: "HDMI & VGA Cables" },
          { slug: "fire-cables", name: "Fire Cables" },
        ],
      },
      {
        slug: "cable-accessories",
        name: "Cable Accessories",
        subcategories: [
          { slug: "cable-lugs", name: "Cable Lugs" },
          { slug: "cable-glands", name: "Cable Glands" },
          { slug: "cable-clips", name: "Cable Clips" },
          { slug: "connectors", name: "Connectors" },
          { slug: "cable-ties", name: "Cable Ties" },
          { slug: "insulation-tape", name: "Insulation Tape" },
          { slug: "heat-shrink", name: "Heat Shrink" },
        ],
      },
    ],
  },
  {
    slug: "lighting",
    name: "Lighting",
    description: "LED, decorative and architectural lighting",
    groups: [
      {
        slug: "indoor-lighting",
        name: "Indoor Lighting",
        subcategories: [
          { slug: "led-bulbs-tubes", name: "LED Bulbs & Tubes" },
          { slug: "panel-lights", name: "Panel Lights" },
          { slug: "recessed-downlights", name: "Recessed Downlights" },
          { slug: "surface-downlights", name: "Surface Downlights" },
          { slug: "ceiling-lights", name: "Ceiling Lights" },
          { slug: "spotlights", name: "Spotlights" },
          { slug: "tracklights", name: "Tracklights" },
          { slug: "battens-fittings", name: "Battens & Fittings" },
          { slug: "bathroom-lights", name: "Bathroom Lights" },
          { slug: "mirror-shaver-lights", name: "Mirror & Shaver Lights" },
          { slug: "exit-lights", name: "Exit Lights" },
          { slug: "indoor-wall-brackets", name: "Indoor Wall Brackets" },
          { slug: "led-wall-lights", name: "LED Wall Lights" },
        ],
      },
      {
        slug: "outdoor-lighting",
        name: "Outdoor Lighting",
        subcategories: [
          { slug: "floodlights", name: "Floodlights" },
          { slug: "street-lights", name: "Street Lights" },
          { slug: "solar-lights", name: "Solar Lights" },
          { slug: "garden-gate-lights", name: "Garden & Gate Lights" },
          { slug: "bollards-stand-lights", name: "Bollards / Stand Lights" },
          { slug: "bulkhead-lights", name: "Bulkhead Lights" },
          { slug: "step-ground-lights", name: "Step & Ground Lights" },
          { slug: "outdoor-wall-brackets", name: "Outdoor Wall Brackets" },
          { slug: "swimming-pool-lights", name: "Swimming Pool Lights" },
          { slug: "petrol-station-canopy-highbay", name: "Petrol Station / Canopy / Highbay" },
        ],
      },
      {
        slug: "decorative-lighting",
        name: "Decorative Lighting",
        subcategories: [
          { slug: "chandeliers", name: "Chandeliers" },
          { slug: "pendants", name: "Pendants" },
          { slug: "3-in-1-ceiling-lights", name: "3-in-1 Ceiling Lights" },
          { slug: "series-fairy-lights", name: "Series / Fairy Lights" },
          { slug: "table-lamps", name: "Table Lamps" },
          { slug: "floor-lamps", name: "Floor Lamps" },
          { slug: "ceiling-fan-with-light", name: "Ceiling Fan with Light" },
        ],
      },
    ],
  },
  {
    slug: "switches-sockets",
    name: "Switches & Sockets",
    description: "Wall switches, sockets and outlets",
    groups: [
      {
        slug: "switches-sockets",
        name: "Switches & Sockets",
        subcategories: [
          { slug: "classic-range", name: "Classic Range" },
          { slug: "pro-range", name: "Pro Range" },
          { slug: "signature-range", name: "Signature Range" },
          { slug: "metallic-switches-sockets", name: "Metallic Switches & Sockets" },
          { slug: "floor-sockets", name: "Floor Sockets" },
          { slug: "top-plugs", name: "Top Plugs" },
          { slug: "plates-boxes", name: "Plates & Boxes" },
        ],
      },
      {
        slug: "power-outlets-extensions",
        name: "Power Outlets & Extensions",
        subcategories: [
          { slug: "extension-sockets", name: "Extension Sockets" },
          { slug: "extension-reels", name: "Extension Reels" },
          { slug: "usb-extensions", name: "USB Extensions" },
          { slug: "multi-plugs-adaptors", name: "Multi-Plugs & Adaptors" },
          { slug: "usb-adaptors", name: "USB Adaptors" },
          { slug: "travel-adaptors", name: "Travel Adaptors" },
          { slug: "power-supply", name: "Power Supply" },
        ],
      },
      {
        slug: "control-accessories",
        name: "Control & Accessories",
        subcategories: [
          { slug: "timers", name: "Timers" },
          { slug: "sensors", name: "Sensors" },
          { slug: "push-buttons", name: "Push Buttons" },
          { slug: "automations", name: "Automations" },
          { slug: "bulb-holders-ceiling-rose", name: "Bulb Holders & Ceiling Rose" },
          { slug: "ballasts-ignitors-drivers", name: "Ballasts, Ignitors & Drivers" },
        ],
      },
    ],
  },
  {
    slug: "switchgear-protection",
    name: "Switchgear & Protection",
    description: "Breakers, panels and protection gear",
    groups: [
      {
        slug: "distribution-panels",
        name: "Distribution & Panels",
        subcategories: [
          { slug: "distribution-boards", name: "Distribution Boards" },
          { slug: "consumer-units", name: "Consumer Units" },
          { slug: "enclosures", name: "Enclosures" },
          { slug: "waterproof-boxes", name: "Waterproof Boxes" },
        ],
      },
      {
        slug: "circuit-breakers",
        name: "Circuit Breakers",
        subcategories: [
          { slug: "mcb", name: "MCB - Miniature Circuit Breaker" },
          { slug: "mccb", name: "MCCB - Moulded Case Circuit Breaker" },
          { slug: "rccb-mpcb", name: "RCCB / MPCB" },
          { slug: "automatic-changeover", name: "Automatic Changeover" },
          { slug: "manual-changeover", name: "Manual Changeover" },
          { slug: "isolators", name: "Isolators" },
        ],
      },
      {
        slug: "control-motor-gear",
        name: "Control & Motor Gear",
        subcategories: [
          { slug: "contactors", name: "Contactors" },
          { slug: "dol-starters", name: "DOL Starters" },
          { slug: "star-delta-starters", name: "Star Delta Starters" },
          { slug: "relays-auxiliary", name: "Relays & Auxiliary" },
          { slug: "control-monitor-relays", name: "Control & Monitor Relays" },
          { slug: "capacitors", name: "Capacitors" },
          { slug: "industrial-plugs-sockets", name: "Industrial Plugs & Sockets" },
          { slug: "indicator-lights", name: "Indicator Lights" },
          { slug: "cutouts", name: "Cutouts" },
          { slug: "meters-testers", name: "Meters & Testers" },
        ],
      },
      {
        slug: "earthing-surge",
        name: "Earthing & Surge Protection",
        subcategories: [
          { slug: "stabilizers", name: "Stabilizers" },
          { slug: "voltage-guards", name: "Voltage Guards" },
          { slug: "arresters", name: "Arresters" },
          { slug: "busbar", name: "Busbar" },
          { slug: "earth-rods", name: "Earth Rods" },
          { slug: "earth-rod-accessories", name: "Earth Rod Accessories" },
          { slug: "earth-pit", name: "Earth Pit" },
          { slug: "fire-safety-equipment", name: "Fire Safety Equipment" },
        ],
      },
    ],
  },
  {
    slug: "home-appliances",
    name: "Home & Appliances",
    description: "Fans and home electrical appliances",
    groups: [
      {
        slug: "fans-cooling",
        name: "Fans & Cooling",
        subcategories: [
          { slug: "ceiling-fans", name: "Ceiling Fans" },
          { slug: "stand-fan", name: "Stand Fan" },
          { slug: "wall-fans", name: "Wall Fans" },
          { slug: "table-fans", name: "Table Fans" },
          { slug: "exhaust-fan", name: "Exhaust Fan" },
        ],
      },
      {
        slug: "heating-water",
        name: "Heating & Water",
        subcategories: [
          { slug: "instant-water-heaters", name: "Instant Water Heaters" },
          { slug: "storage-water-heaters", name: "Storage Water Heaters" },
          { slug: "room-heaters", name: "Room Heaters" },
          { slug: "iron-boxes", name: "Iron Boxes" },
          { slug: "hair-hand-dryers", name: "Hair & Hand Dryers" },
        ],
      },
      {
        slug: "appliance-protection",
        name: "Appliance Protection",
        subcategories: [
          { slug: "appliance-guards", name: "Appliance Guards" },
          { slug: "tv-brackets", name: "TV Brackets" },
        ],
      },
      {
        slug: "signalling-security",
        name: "Signalling & Security",
        subcategories: [
          { slug: "wired-doorbells", name: "Wired Doorbells" },
          { slug: "wireless-doorbells", name: "Wireless Doorbells" },
          { slug: "school-fire-bells", name: "School & Fire Bells" },
          { slug: "bell-accessories", name: "Bell Accessories" },
          { slug: "torches", name: "Torches" },
        ],
      },
    ],
  },
  {
    slug: "cable-management",
    name: "Cable Management",
    description: "Trays, trunking and conduits",
    groups: [
      {
        slug: "trunkings",
        name: "Trunkings",
        subcategories: [
          { slug: "adhesive-trunkings", name: "Adhesive Trunkings" },
          { slug: "compartment-trunkings", name: "Compartment Trunkings" },
          { slug: "gi-trunkings", name: "GI Trunkings" },
          { slug: "slotted-trunkings", name: "Slotted Trunkings" },
          { slug: "standard-pvc-trunkings", name: "Standard PVC Trunkings" },
          { slug: "floor-trunking", name: "Floor Trunking" },
        ],
      },
      {
        slug: "cable-trays",
        name: "Cable Trays",
        subcategories: [
          { slug: "cable-trays", name: "Cable Trays" },
          { slug: "cable-tray-accessories", name: "Cable Tray Accessories" },
          { slug: "cable-tray-ladders", name: "Cable Tray Ladders" },
        ],
      },
      {
        slug: "pvc-conduits",
        name: "PVC Conduits",
        subcategories: [
          { slug: "flex-conduits", name: "Flex Conduits" },
          { slug: "pvc-conduit-pipes", name: "PVC Conduit Pipes" },
          { slug: "conduit-accessories", name: "Conduit Accessories" },
        ],
      },
      {
        slug: "galvanized-conduits",
        name: "Galvanized Conduits",
        subcategories: [
          { slug: "gi-pipes", name: "GI Pipes" },
          { slug: "gi-accessories", name: "GI Accessories" },
        ],
      },
    ],
  },
  {
    slug: "tools",
    name: "Tools",
    description: "Installation and testing tools",
    groups: [
      { slug: "hand-tools", name: "Hand Tools" },
      { slug: "power-tools", name: "Power Tools" },
      { slug: "ladders", name: "Ladders" },
    ],
  },
  {
    slug: "shop-by-use",
    name: "Shop by Use",
    description: "Home, commercial and industrial",
    kind: "use-case",
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
