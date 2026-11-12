import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CATEGORY_SECTIONS } from "@tronic/country-config";
import { Navbar, fitCount } from "./Navbar";

describe("fitCount", () => {
  const widths = [100, 60, 120, 160, 120, 120, 40, 80]; // 800 in total

  it("shows every section when they fit", () => {
    expect(fitCount(widths, 800, 70, false)).toBe(8);
  });

  it("leaves room for More when it is shown anyway (company links)", () => {
    // 800 - 70 = 730: the first seven take 720.
    expect(fitCount(widths, 800, 70, true)).toBe(7);
    expect(fitCount(widths, 870, 70, true)).toBe(8);
  });

  it("keeps the sections that fit beside More, in order", () => {
    // 700 - 70 for More = 630: 100 + 60 + 120 + 160 + 120 = 560; + 120 is too much.
    expect(fitCount(widths, 700, 70, false)).toBe(5);
    expect(fitCount(widths, 100, 70, false)).toBe(0);
  });
});

describe("Navbar", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the eight approved category sections (FR-002)", () => {
    render(<Navbar />);
    expect(CATEGORY_SECTIONS).toHaveLength(8);
    for (const section of CATEGORY_SECTIONS) {
      expect(screen.getByRole("button", { name: section.name })).toBeInTheDocument();
    }
  });

  it("opens a section's group panel and closes it with Escape", async () => {
    const user = userEvent.setup();
    render(<Navbar />);
    const lighting = screen.getByRole("button", { name: "Lighting" });
    await user.click(lighting);
    expect(lighting).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Indoor Lighting" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Panel Lights" })).toHaveAttribute(
      "href",
      "/categories/lighting/indoor-lighting/panel-lights",
    );
    await user.keyboard("{Escape}");
    expect(lighting).toHaveAttribute("aria-expanded", "false");
  });

  it("opens the company links from the More button and closes with Escape", async () => {
    const user = userEvent.setup();
    render(<Navbar />);
    const more = screen.getByRole("button", { name: "More" });
    expect(more).toHaveAttribute("aria-expanded", "false");
    await user.click(more);
    expect(more).toHaveAttribute("aria-expanded", "true");
    const company = within(document.getElementById("navbar-more-menu")!).getByRole("list", { name: "Company" });
    expect(within(company).getByRole("link", { name: "About Us" })).toHaveAttribute("href", "/about");
    expect(within(company).getByRole("link", { name: "Our Showroom Locations" })).toHaveAttribute(
      "href",
      "/showrooms",
    );
    await user.keyboard("{Escape}");
    expect(more).toHaveAttribute("aria-expanded", "false");
  });

  it("moves sections that do not fit into More, where they open their usual panel", async () => {
    // A 500px bar; every section label measures 100px and the More group 80px.
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute("data-nav-row") ? 500 : 0;
    });
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      const width = this.hasAttribute("data-ruler-section") ? 100 : this.hasAttribute("data-ruler-more") ? 80 : 0;
      return { width, height: 0, x: 0, y: 0, top: 0, left: 0, right: width, bottom: 0, toJSON: () => ({}) };
    });
    const user = userEvent.setup();
    render(<Navbar />);

    // 500 - 80 = 420: four 100px sections stay in the bar, on one line.
    const bar = screen.getByRole("navigation", { name: "Product categories" });
    for (const section of CATEGORY_SECTIONS.slice(0, 4)) {
      expect(within(bar).getByRole("button", { name: section.name })).toBeInTheDocument();
    }
    expect(within(bar).queryByRole("button", { name: "Tools" })).not.toBeInTheDocument();

    const more = screen.getByRole("button", { name: "More" });
    await user.click(more);
    const extra = within(document.getElementById("navbar-more-menu")!).getByRole("list", { name: "More categories" });
    expect(within(extra).getAllByRole("button").map((button) => button.textContent)).toEqual(
      CATEGORY_SECTIONS.slice(4).map((section) => section.name),
    );

    // Choosing one opens its panel and moves focus into it; Escape returns to More.
    await user.click(within(extra).getByRole("button", { name: "Tools" }));
    expect(screen.getByRole("region", { name: "Tools groups" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "All Tools" })).toHaveFocus();
    expect(more).toHaveAttribute("aria-expanded", "false");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("region", { name: "Tools groups" })).not.toBeInTheDocument();
    expect(more).toHaveFocus();
  });
});
