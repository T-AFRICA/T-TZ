import { describe, expect, it } from "vitest";
import { CATEGORY_SECTIONS, METER_NAV_ITEM } from "@tronic/country-config";

/** Guards the SRS §7 taxonomy contract the whole storefront builds on. */
describe("category taxonomy", () => {
  it("has exactly eight sections (FR-002)", () => {
    expect(CATEGORY_SECTIONS).toHaveLength(8);
  });

  it("has unique section slugs and unique group slugs within each section", () => {
    const sectionSlugs = CATEGORY_SECTIONS.map((section) => section.slug);
    expect(new Set(sectionSlugs).size).toBe(sectionSlugs.length);
    for (const section of CATEGORY_SECTIONS) {
      const groupSlugs = section.groups.map((group) => group.slug);
      expect(new Set(groupSlugs).size).toBe(groupSlugs.length);
      expect(section.groups.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("exposes the dedicated Meter navbar item at /meter (FR-003)", () => {
    expect(METER_NAV_ITEM.href).toBe("/meter");
  });
});
