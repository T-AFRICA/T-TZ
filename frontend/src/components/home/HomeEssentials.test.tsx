import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@tronic/ui";
import { HomeEssentials } from "./HomeEssentials";

// Buy Now navigates with the app router.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/" }));

async function renderEssentials() {
  // An async server component: resolve it, then render its output.
  const ui = await HomeEssentials();
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe("HomeEssentials", () => {
  it("renders the eight core sections in the required order", async () => {
    await renderEssentials();
    const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(headings).toEqual([
      "Offers & Promotions",
      "Featured Products",
      "Best-Selling Products",
      "New Arrivals",
      "Shop Collections",
      "Luxury Chandeliers & Lighting",
      "Cables & Wiring",
      "New Arrival Wall Lights",
    ]);
  });

  it("shows no invented best-seller ranking while there is no sales data", async () => {
    await renderEssentials();
    const section = screen.getByRole("region", { name: "Best-Selling Products" });
    expect(within(section).getByRole("status")).toHaveTextContent("waiting for sales data");
    // No product cards: only department links, which are not a ranking.
    const hrefs = within(section).getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(hrefs.every((href) => href?.startsWith("/categories/"))).toBe(true);
  });

  it("shows featured products with their SKU and product page links", async () => {
    await renderEssentials();
    const section = screen.getByRole("region", { name: "Featured Products" });
    expect(within(section).getByText("SKU MC 4050-6K")).toBeInTheDocument();
    expect(within(section).getByRole("link", { name: "4-Pole Miniature Circuit Breaker – 50A, 6kA" })).toHaveAttribute(
      "href",
      "/products/sample-mcb-4p-50a",
    );
  });

  it("links every collection and cable sub-collection to an existing category route", async () => {
    await renderEssentials();
    const collections = screen.getByRole("region", { name: "Shop Collections" });
    for (const link of within(collections).getAllByRole("link")) {
      expect(link.getAttribute("href")).toMatch(/^\/categories\/[a-z-]+$/);
    }
    const cables = screen.getByRole("region", { name: "Cables & Wiring" });
    expect(within(cables).getByRole("link", { name: "Power Cables" })).toHaveAttribute("href", "/categories/cables-wiring/power-cables");
  });
});
