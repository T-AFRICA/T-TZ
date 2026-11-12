import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CATEGORY_SECTIONS } from "@tronic/country-config";
import { CategoryRail } from "./CategoryRail";

describe("CategoryRail", () => {
  it("links every navbar category once for assistive tech and the keyboard", () => {
    render(<CategoryRail />);
    const rail = screen.getByRole("navigation", { name: "Shop by category" });
    // The loop copy is aria-hidden, so only the first copy is exposed.
    const links = within(rail).getAllByRole("link");
    expect(links).toHaveLength(CATEGORY_SECTIONS.length);
    CATEGORY_SECTIONS.forEach((section, index) => {
      expect(links[index]).toHaveAttribute("href", `/categories/${section.slug}`);
      expect(links[index]).toHaveAccessibleName(section.name);
    });
  });

  it("keeps the ticker's loop copy out of the tab order", () => {
    const { container } = render(<CategoryRail />);
    const copy = container.querySelector(".category-rail-copy");
    expect(copy).toHaveAttribute("aria-hidden", "true");
    const copyLinks = copy?.querySelectorAll("a") ?? [];
    expect(copyLinks).toHaveLength(CATEGORY_SECTIONS.length);
    for (const link of copyLinks) {
      expect(link).toHaveAttribute("tabindex", "-1");
    }
  });
});
