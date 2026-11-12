import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ALL_SAMPLE_PRODUCTS } from "@tronic/api-client";
import { ToastProvider } from "@tronic/ui";
import { GridCollection, PanelCollection, SpotlightCollection } from "./CollectionSections";

// Buy Now navigates with the app router.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/" }));

const base = {
  id: "collection-test",
  title: "Garden Lights",
  description: "Post lights and bollards.",
  viewAllHref: "/categories/lighting/outdoor-lighting",
};
const photo = { src: "/categories/shop-by-use.webp", alt: "Modern villa at dusk" };
const garden = ALL_SAMPLE_PRODUCTS.filter((product) => product.groupSlug === "outdoor-lighting").slice(0, 3);

describe("homepage collection sections", () => {
  it("lists catalogue products with links to their product pages", () => {
    // The cards' Add to Cart reports through the site's toasts.
    render(
      <ToastProvider>
        <PanelCollection
          {...base}
          eyebrow="Outdoor"
          viewAllLabel="Shop collection"
          photo={photo}
          result={{ status: "ok", products: garden }}
        />
      </ToastProvider>,
    );
    const section = screen.getByRole("region", { name: "Garden Lights" });
    expect(within(section).getByRole("link", { name: /Shop collection/ })).toHaveAttribute("href", base.viewAllHref);
    for (const product of garden) {
      expect(within(section).getByRole("link", { name: product.name })).toHaveAttribute("href", `/products/${product.slug}`);
    }
  });

  it("shows an empty state with a way into the category when nothing matches", () => {
    render(<GridCollection {...base} result={{ status: "ok", products: [] }} />);
    expect(screen.getByRole("status")).toHaveTextContent("No products in this collection yet.");
    expect(screen.getByRole("link", { name: "Browse Garden Lights" })).toHaveAttribute("href", base.viewAllHref);
  });

  it("shows an error state, not an empty one, when the catalogue could not be read", () => {
    render(<SpotlightCollection {...base} eyebrow="New collection" photo={photo} result={{ status: "error" }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("could not be loaded");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
