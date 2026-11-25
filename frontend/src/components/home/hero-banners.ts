/**
 * The homepage hero's category banners (owner artwork 2026-11-24). Each one
 * was supplied in three shapes, one per kind of screen:
 *
 * - `mobile`  1600x833, the same 96:50 shape as the other slides on phones
 * - `tablet`  1600x700 (16:7), which is the hero's photograph box at 768px
 * - `desktop` 1600x400 (4:1), with the left quarter or more left clear for the copy
 *
 * The files are `/banners/hero-<name>-<shape>.jpg`, byte for byte as supplied.
 *
 * The colour lists are nine samples, evenly spaced from left to right, read
 * off the artwork itself (the backdrop is lit unevenly, so one flat colour
 * would show a join): `floor` is the bottom row of the mobile banner, and
 * `tabletWall` and `desktopWall` are the top rows of the other two. BannerHero
 * continues the photograph with them where the hero is taller than the
 * artwork. Sample them again if a banner is replaced.
 */
export interface HeroBanner {
  /** File name part: `/banners/hero-<name>-<shape>.jpg`. */
  name: string;
  /** Short name, used for the slideshow's dot and slide label. */
  label: string;
  /** What the photograph shows, for the section's accessible name. */
  description: string;
  /** Headline in two lines. */
  heading: readonly [string, string];
  /** Colour of the headline's second line; must keep 3:1 on the walls below. */
  accent: string;
  text: string;
  cta: { label: string; href: string };
  /**
   * Desktop width of the copy, as a full class name so Tailwind finds it:
   * up to where this banner's first product starts (30% of the width, or
   * 26%), less the page gutter.
   */
  copyWidth: string;
  floor: readonly string[];
  tabletWall: readonly string[];
  desktopWall: readonly string[];
}

/** Body text on all three banners: at least 4.5:1 on every wall colour below. */
export const HERO_BANNER_TEXT = "#2b2724";
/** Headline on all three banners (the premium black token's value). */
export const HERO_BANNER_HEADING = "#111111";
const COPY_30 = "lg:max-w-[calc(30vw-2rem)]";
const COPY_26 = "lg:max-w-[calc(26vw-2rem)]";
/** The brand red token's value: only on the light grey banner, where it keeps 3:1. */
const BRAND_RED = "#ef1c26";

export const HERO_BANNER_SHAPES = ["mobile", "tablet", "desktop"] as const;
export type HeroBannerShape = (typeof HERO_BANNER_SHAPES)[number];

export function heroBannerSrc(banner: HeroBanner, shape: HeroBannerShape): string {
  return `/banners/hero-${banner.name}-${shape}.jpg`;
}

export const HERO_BANNERS: readonly HeroBanner[] = [
  {
    name: "switchgear",
    label: "Switchgear & Protection",
    description: "distribution boards, circuit breakers, isolators, changeover switches and voltage protectors",
    heading: ["Protect Every", "Circuit."],
    accent: BRAND_RED,
    text: "Distribution boards, circuit breakers, isolators, changeover switches and voltage protectors for homes, businesses and industries.",
    cta: { label: "Shop Switchgear", href: "/categories/switchgear-protection" },
    copyWidth: COPY_30,
    floor: ["#ecebed", "#ebeaed", "#eaeaea", "#eaeaec", "#eaeaec", "#ebebed", "#ececec", "#ededee", "#eeeef0"],
    tabletWall: ["#e0e0e2", "#e2e2e4", "#e4e4e6", "#e5e5e5", "#e6e6e6", "#e5e5e7", "#e3e3e5", "#e0e0e0", "#dbdbdd"],
    desktopWall: ["#dadada", "#dbdbdd", "#dddddf", "#e2e2e4", "#e5e5e7", "#e6e6e6", "#e4e4e6", "#e0e0e2", "#d8d8da"],
  },
  {
    name: "appliances",
    label: "Home Appliances",
    description: "water heaters, fans, a room heater, an iron, a hand dryer and a door chime",
    heading: ["Comfort for", "Every Home."],
    accent: HERO_BANNER_HEADING,
    text: "Water heaters, stand, wall and ceiling fans, room heaters, irons and hand dryers for everyday comfort.",
    cta: { label: "Shop Home Appliances", href: "/categories/home-appliances" },
    copyWidth: COPY_30,
    floor: ["#d9c0a2", "#d6bd9f", "#d5bc9e", "#d1b89a", "#ceb396", "#ccb194", "#caad90", "#c7a889", "#c6a488"],
    tabletWall: ["#cbab8a", "#c8a784", "#c5a481", "#c3a27d", "#bf9c7e", "#bc9a77", "#b89575", "#b59370", "#b69576"],
    desktopWall: ["#d0af8e", "#cfae8d", "#cfae8d", "#ceab8b", "#c8a683", "#c3a27f", "#be9c77", "#b79474", "#b2906d"],
  },
  {
    name: "switches",
    label: "Switches & Sockets",
    description: "wall switches and sockets in several finishes, an extension reel, a timer and a power strip",
    heading: ["Switch On", "in Style."],
    accent: HERO_BANNER_HEADING,
    text: "Switches, sockets, extension reels, timers and power strips in white, black, gold and red finishes.",
    cta: { label: "Shop Switches & Sockets", href: "/categories/switches-sockets" },
    // The gold socket starts at 26.8% of the width.
    copyWidth: COPY_26,
    floor: ["#d0ccc9", "#d1ccc9", "#d1cec9", "#cecdc9", "#d0cfcb", "#cecfca", "#d0cfcd", "#d1d1cf", "#d2d2d0"],
    tabletWall: ["#b5b5b3", "#bbbbb9", "#c0c0be", "#c3c3c1", "#c4c4c2", "#c4c4c2", "#c2c2c0", "#c0c0be", "#bcbbb9"],
    desktopWall: ["#a7a7a5", "#a8a8a6", "#ababa9", "#b6b6b4", "#bfbfbd", "#c5c5c3", "#c4c4c2", "#c1c1bf", "#b9b9b7"],
  },
];
