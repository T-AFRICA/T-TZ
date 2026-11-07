import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CATEGORY_SECTIONS } from "@tronic/country-config";
import { CategoryShowcase } from "./CategoryShowcase";

describe("CategoryShowcase", () => {
  it("renders one linked banner per navbar category, in taxonomy order", () => {
    render(<CategoryShowcase />);
    expect(screen.getByRole("heading", { level: 2, name: "Explore Our Categories" })).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(CATEGORY_SECTIONS.length);
    CATEGORY_SECTIONS.forEach((section, index) => {
      expect(links[index]).toHaveAttribute("href", `/categories/${section.slug}`);
      expect(links[index]).toHaveAccessibleName(new RegExp(`^${section.name}`));
    });
  });

  it("gives every banner photograph a description", () => {
    render(<CategoryShowcase />);
    for (const image of screen.getAllByRole("img")) {
      expect(image.getAttribute("alt")?.length ?? 0).toBeGreaterThan(10);
    }
  });
});
