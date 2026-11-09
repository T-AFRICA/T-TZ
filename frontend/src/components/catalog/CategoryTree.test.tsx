import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { getCategorySection } from "@tronic/country-config";
import { parseListingFilters } from "@/features/catalog/catalog";
import { CategoryTree } from "./CategoryTree";

const cables = getCategorySection("cables-wiring")!;

describe("CategoryTree", () => {
  it("renders the section, its groups and only the active group's subcategories open", () => {
    render(
      <CategoryTree
        section={cables}
        activeGroup="power-cables"
        activeSubcategory="single-core-cables"
        filters={parseListingFilters({})}
      />,
    );
    expect(screen.getByRole("link", { name: "All Cables & Wiring" })).toHaveAttribute("href", "/categories/cables-wiring");
    expect(screen.getByRole("link", { name: "Power Cables" })).toHaveAttribute("href", "/categories/cables-wiring/power-cables");
    expect(screen.getByRole("link", { name: "Single Core Cables" })).toHaveAttribute(
      "href",
      "/categories/cables-wiring/power-cables/single-core-cables",
    );
    expect(screen.getByRole("link", { name: "Single Core Cables" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Collapse Power Cables" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Expand Data & Signal" })).toHaveAttribute("aria-expanded", "false");
  });

  it("toggles a group with its chevron without turning the label into a toggle", async () => {
    const user = userEvent.setup();
    render(<CategoryTree section={cables} filters={parseListingFilters({})} />);
    const chevron = screen.getByRole("button", { name: "Expand Data & Signal" });
    await user.click(chevron);
    expect(screen.getByRole("button", { name: "Collapse Data & Signal" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Networking Cables" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Collapse Data & Signal" }));
    expect(screen.getByRole("button", { name: "Expand Data & Signal" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("link", { name: "Data & Signal" })).toHaveAttribute("href", "/categories/cables-wiring/data-signal");
  });

  it("carries the current filters and sort into every link and resets the page", () => {
    render(
      <CategoryTree
        section={cables}
        activeGroup="data-signal"
        filters={parseListingFilters({ brand: "Alpha", sort: "price-asc", stock: "1", page: "3" })}
      />,
    );
    const href = screen.getByRole("link", { name: "Coaxial Cables" }).getAttribute("href") ?? "";
    expect(href.startsWith("/categories/cables-wiring/data-signal/coaxial-cables?")).toBe(true);
    expect(href).toContain("brand=Alpha");
    expect(href).toContain("sort=price-asc");
    expect(href).toContain("stock=1");
    expect(href).not.toContain("page=");
  });

  it("shows plain group links where the diagrams stop at the group level", () => {
    render(<CategoryTree section={getCategorySection("tools")!} filters={parseListingFilters({})} />);
    expect(screen.getByRole("link", { name: "Hand Tools" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
