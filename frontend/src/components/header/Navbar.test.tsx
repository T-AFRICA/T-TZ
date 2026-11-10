import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CATEGORY_SECTIONS } from "@tronic/country-config";
import { Navbar, splitNavLabel } from "./Navbar";

describe("splitNavLabel", () => {
  it("splits names into two balanced lines with & ending the first line", () => {
    expect(splitNavLabel("Cables & Wiring")).toEqual(["Cables &", "Wiring"]);
    expect(splitNavLabel("Switches & Sockets")).toEqual(["Switches &", "Sockets"]);
    expect(splitNavLabel("Switchgear & Protection")).toEqual(["Switchgear &", "Protection"]);
    expect(splitNavLabel("Cable Management")).toEqual(["Cable", "Management"]);
    expect(splitNavLabel("Shop by Use")).toEqual(["Shop", "by Use"]);
  });

  it("keeps one-word names on one line", () => {
    expect(splitNavLabel("Lighting")).toEqual(["Lighting"]);
    expect(splitNavLabel("Tools")).toEqual(["Tools"]);
  });
});

describe("Navbar", () => {
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
    const menu = document.getElementById("navbar-company-menu")!;
    expect(within(menu).getByRole("link", { name: "About Us" })).toHaveAttribute("href", "/about");
    expect(within(menu).getByRole("link", { name: "Our Showroom Locations" })).toHaveAttribute("href", "/showrooms");
    await user.keyboard("{Escape}");
    expect(more).toHaveAttribute("aria-expanded", "false");
  });
});
