import type { ReactElement } from "react";

/**
 * In-house stroke illustrations for the eight approved category tiles
 * (SRS FR-002). PLACEHOLDER ART: generic symbols, not product imagery —
 * replace the tile media with approved category photography when the brand
 * team supplies it. Icons inherit currentColor; strokeWidth matches the
 * shared icon set (1.8).
 */

interface ArtProps {
  size?: number;
}

function base(size: number) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 48 48",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

function CablesWiring({ size = 48 }: ArtProps) {
  return (
    <svg {...base(size)}>
      <circle cx="22" cy="24" r="12" />
      <circle cx="22" cy="24" r="6" />
      <path d="M32 31c5 3 9 2 12-2" />
      <path d="M44 29v-5" />
    </svg>
  );
}

function Lighting({ size = 48 }: ArtProps) {
  return (
    <svg {...base(size)}>
      <path d="M24 6a11 11 0 0 1 6 20c-1.5 1-2 2.5-2 4h-8c0-1.5-.5-3-2-4a11 11 0 0 1 6-20Z" />
      <path d="M20 35h8M21 40h6" />
      <path d="M24 1v2M40 9l-1.6 1.6M9.6 10.6 8 9" />
    </svg>
  );
}

function SwitchesSockets({ size = 48 }: ArtProps) {
  return (
    <svg {...base(size)}>
      <rect x="8" y="8" width="32" height="32" rx="5" />
      <circle cx="24" cy="24" r="9" />
      <circle cx="20.5" cy="22" r="1.4" fill="currentColor" />
      <circle cx="27.5" cy="22" r="1.4" fill="currentColor" />
      <path d="M24 27v3" />
    </svg>
  );
}

function SwitchgearProtection({ size = 48 }: ArtProps) {
  return (
    <svg {...base(size)}>
      <path d="M24 4 40 10v12c0 10-6.5 17.5-16 22C14.5 39.5 8 32 8 22V10l16-6Z" />
      <path d="M26 14l-7 11h6l-3 9 8-12h-6l2-8Z" />
    </svg>
  );
}

function HomeAppliances({ size = 48 }: ArtProps) {
  return (
    <svg {...base(size)}>
      <rect x="10" y="6" width="28" height="36" rx="4" />
      <circle cx="24" cy="27" r="9" />
      <circle cx="24" cy="27" r="4.5" />
      <path d="M14 12h6M30 12h4" />
    </svg>
  );
}

function CableManagement({ size = 48 }: ArtProps) {
  return (
    <svg {...base(size)}>
      <path d="M6 14h36v8H6zM6 30h36" />
      <path d="M12 22v8M24 22v8M36 22v8" />
      <path d="M10 36c8 6 20 6 28 0" />
    </svg>
  );
}

function Tools({ size = 48 }: ArtProps) {
  return (
    <svg {...base(size)}>
      <path d="M15 9a7 7 0 0 0-8 8l6 1 2 5-5 2a7 7 0 0 0 8 8" />
      <path d="M18 28 34 12" />
      <path d="M33 7l8 8-4 4-8-8 4-4Z" />
      <path d="M22 32l9 9a4 4 0 0 0 6-6l-9-9" />
    </svg>
  );
}

function ShopByUse({ size = 48 }: ArtProps) {
  return (
    <svg {...base(size)}>
      <rect x="7" y="7" width="14" height="14" rx="3" />
      <rect x="27" y="7" width="14" height="14" rx="3" />
      <rect x="7" y="27" width="14" height="14" rx="3" />
      <path d="M34 27v14M27 34h14" />
    </svg>
  );
}

const ART_BY_SLUG: Record<string, (props: ArtProps) => ReactElement> = {
  "cables-wiring": CablesWiring,
  lighting: Lighting,
  "switches-sockets": SwitchesSockets,
  "switchgear-protection": SwitchgearProtection,
  "home-appliances": HomeAppliances,
  "cable-management": CableManagement,
  tools: Tools,
  "shop-by-use": ShopByUse,
};

export function CategoryArt({ slug, size = 48 }: { slug: string; size?: number }) {
  const Art = ART_BY_SLUG[slug] ?? ShopByUse;
  return <Art size={size} />;
}
