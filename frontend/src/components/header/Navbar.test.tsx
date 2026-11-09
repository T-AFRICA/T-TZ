import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CATEGORY_SECTIONS } from "@tronic/country-config";
import { Navbar } from "./Navbar";

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
});
