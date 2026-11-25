import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getCategorySection } from "@tronic/country-config";
import { BannerHero } from "./BannerHero";
import {
  HERO_BANNERS,
  HERO_BANNER_HEADING,
  HERO_BANNER_SHAPES,
  HERO_BANNER_TEXT,
  heroBannerSrc,
  type HeroBannerShape,
} from "./hero-banners";

/** Width and height of a JPEG, read from its frame header. */
function jpegSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  let at = 2;
  while (at < bytes.length) {
    if (bytes[at] !== 0xff) {
      at += 1;
      continue;
    }
    const marker = bytes[at + 1] ?? 0;
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) return { width: bytes.readUInt16BE(at + 7), height: bytes.readUInt16BE(at + 5) };
    at += 2 + bytes.readUInt16BE(at + 2);
  }
  throw new Error(`no JPEG frame in ${path}`);
}

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG contrast ratio of two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/** The shape each kind of screen is laid out for (BannerHero.tsx). */
const SHAPE_SIZE: Record<HeroBannerShape, { width: number; height: number }> = {
  mobile: { width: 1600, height: 833 },
  tablet: { width: 1600, height: 700 },
  desktop: { width: 1600, height: 400 },
};

describe("the homepage hero's category banners", () => {
  it("has every banner in all three shapes, each in the shape the layout expects", () => {
    expect(HERO_BANNERS).toHaveLength(3);
    for (const banner of HERO_BANNERS) {
      for (const shape of HERO_BANNER_SHAPES) {
        const file = resolve(process.cwd(), "public", heroBannerSrc(banner, shape).slice(1));
        expect(existsSync(file), file).toBe(true);
        expect(jpegSize(file), file).toEqual(SHAPE_SIZE[shape]);
      }
    }
  });

  it("links each banner to a category that exists", () => {
    for (const banner of HERO_BANNERS) {
      const slug = /^\/categories\/([a-z-]+)$/.exec(banner.cta.href)?.[1];
      expect(slug, banner.cta.href).toBeDefined();
      expect(getCategorySection(slug ?? ""), banner.cta.href).toBeDefined();
    }
  });

  it("keeps the copy readable on every wall colour it can sit on", () => {
    for (const banner of HERO_BANNERS) {
      // Tablets centre the copy on the tablet wall; desktop puts it on the left of the desktop wall.
      for (const wall of [...banner.tabletWall, ...banner.desktopWall]) {
        expect(wall).toMatch(/^#[0-9a-f]{6}$/);
        expect(contrast(HERO_BANNER_TEXT, wall), `${banner.name} text on ${wall}`).toBeGreaterThanOrEqual(4.5);
        // The headline is large display type, where 3:1 is the requirement.
        expect(contrast(HERO_BANNER_HEADING, wall), `${banner.name} heading on ${wall}`).toBeGreaterThanOrEqual(3);
        expect(contrast(banner.accent, wall), `${banner.name} accent on ${wall}`).toBeGreaterThanOrEqual(3);
      }
      expect(banner.floor).toHaveLength(9);
      expect(banner.tabletWall).toHaveLength(9);
      expect(banner.desktopWall).toHaveLength(9);
    }
  });

  it("renders a banner as a named section with its headline and one link", () => {
    const banner = HERO_BANNERS[0];
    if (!banner) throw new Error("no banner");
    render(<BannerHero banner={banner} />);
    const section = screen.getByRole("region", { name: /^TRONIC switchgear & protection:/ });
    expect(section).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Protect Every Circuit." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Shop Switchgear" })).toHaveAttribute("href", "/categories/switchgear-protection");
    // The photographs are decoration: the section's name says what they show.
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });
});
