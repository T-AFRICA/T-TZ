import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { bestSellerPicks, newArrivals } from "./MobileProductTabs";
import { ProductTabs } from "./ProductTabs";
import { allSampleProducts } from "./sampleProducts";

const tabs = [
  { id: "new", label: "New Arrivals", content: <p>new panel</p> },
  { id: "best", label: "Best Sellers", content: <p>best panel</p> },
  { id: "all", label: "All Products", content: <p>all panel</p> },
];

describe("ProductTabs", () => {
  it("shows the first tab's panel and switches on click", async () => {
    render(<ProductTabs label="Products" tabs={tabs} />);
    expect(screen.getByRole("tab", { name: "New Arrivals" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "New Arrivals" })).toHaveTextContent("new panel");
    expect(screen.getByText("best panel")).not.toBeVisible();

    await userEvent.click(screen.getByRole("tab", { name: "Best Sellers" }));
    expect(screen.getByRole("tab", { name: "Best Sellers" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("best panel")).toBeVisible();
    expect(screen.getByText("new panel")).not.toBeVisible();
  });

  it("keeps one tab in the tab order and moves with the arrow keys", async () => {
    render(<ProductTabs label="Products" tabs={tabs} />);
    const [first, , last] = screen.getAllByRole("tab");
    expect(first).toHaveAttribute("tabindex", "0");
    expect(last).toHaveAttribute("tabindex", "-1");

    first!.focus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(last).toHaveFocus();
    expect(last).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{Home}");
    expect(first).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Best Sellers" })).toHaveFocus();
  });
});

describe("mobile product rails", () => {
  it("lists new arrivals newest first", () => {
    const sequences = newArrivals(allSampleProducts()).map((product) => product.sequence);
    expect(sequences.length).toBeGreaterThan(0);
    expect(sequences).toEqual([...sequences].sort((a, b) => b - a));
  });

  it("resolves every placeholder best-seller pick to a visible product", () => {
    expect(bestSellerPicks(allSampleProducts())).toHaveLength(8);
  });
});
