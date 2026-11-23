import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CountryFlag, hasFlag } from "./flag";

/** A country flag comes from its confirmed ISO code; without one there is a globe, never a guess. */

const draw = (isoCode: string | null | undefined, size?: "sm" | "md") => renderToStaticMarkup(createElement(CountryFlag, size ? { isoCode, size } : { isoCode }));

describe("country flags", () => {
  it("draws the flag of each listed country as an SVG, hidden from screen readers", () => {
    for (const code of ["TZ", "KE", "UG", "RW", "CD", "CG"]) {
      const html = draw(code);
      expect(html, code).toContain(`data-flag="${code}"`);
      expect(html, code).toContain("<svg");
      expect(html, code).toMatch(/^<span aria-hidden="true"/);
    }
    // Different countries, different pictures.
    expect(draw("TZ").replaceAll("TZ", "")).not.toBe(draw("KE").replaceAll("KE", ""));
    expect(draw("tz")).toContain('data-flag="TZ"');
  });

  it("shows a neutral globe when the code is not confirmed or not listed", () => {
    for (const code of [null, undefined, "", "ZZ", "USA", "constructor", "__proto__", "toString"]) {
      expect(hasFlag(code), String(code)).toBe(false);
      expect(draw(code, "sm"), String(code)).toContain('data-flag="none"');
    }
  });
});
