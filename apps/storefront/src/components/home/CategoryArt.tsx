/**
 * Category symbols for the eight approved departments (SRS FR-002), backed
 * by lucide-react for professionally drawn, optically corrected icons
 * (owner request Nov 2026 — the hand-drawn set read as thin at small sizes).
 * PLACEHOLDER ART for tile media: replace with approved category photography
 * when the brand team supplies it.
 */
import {
  Cable,
  Lightbulb,
  LayoutGrid,
  Plug,
  Route,
  WashingMachine,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

const ART_BY_SLUG: Record<string, LucideIcon> = {
  "cables-wiring": Cable,
  lighting: Lightbulb,
  "switches-sockets": Plug,
  "switchgear-protection": Zap,
  "home-appliances": WashingMachine,
  "cable-management": Route,
  tools: Wrench,
  "shop-by-use": LayoutGrid,
};

export function CategoryArt({ slug, size = 48 }: { slug: string; size?: number }) {
  const Icon = ART_BY_SLUG[slug] ?? LayoutGrid;
  return <Icon size={size} strokeWidth={size > 40 ? 1.5 : 2} aria-hidden="true" />;
}
