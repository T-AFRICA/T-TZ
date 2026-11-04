import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@tronic/ui";
import type { SampleProduct } from "@/components/home/sampleProducts";
import { PurchasePanel } from "./PurchasePanel";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const baseProduct: SampleProduct = {
  id: "sample-test-bulb",
  name: "Test Bulb",
  categorySlug: "lighting",
  categoryName: "Lighting",
  image: "/products/led-bulb.png",
  price: 10_000,
  wasPrice: 12_500,
  inStock: true,
  variants: ["Warm White", "Cool White"],
};

function renderPanel(product: SampleProduct) {
  return render(
    <ToastProvider>
      <PurchasePanel product={product} />
    </ToastProvider>,
  );
}

describe("PurchasePanel", () => {
  it("shows price, was-price, computed saving and the selected variant in the SKU", async () => {
    const user = userEvent.setup();
    renderPanel(baseProduct);
    // The price renders in the buy box and again in the sticky mobile bar.
    expect(screen.getAllByText("TZS 10,000").length).toBeGreaterThan(0);
    expect(screen.getByText("TZS 12,500")).toBeInTheDocument();
    expect(screen.getByText("Save 20%")).toBeInTheDocument();
    expect(screen.getByText(/SKU SAMPLE-TEST-BULB · Warm White/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cool White" }));
    expect(screen.getByRole("button", { name: "Cool White" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText(/SKU SAMPLE-TEST-BULB · Cool White/)).toBeInTheDocument();
  });

  it("carries a selected colour swatch into the SKU", async () => {
    const user = userEvent.setup();
    renderPanel({
      ...baseProduct,
      colors: [
        { name: "White", swatch: "#f4f4f2" },
        { name: "Matte Black", swatch: "#26262a" },
      ],
    });
    expect(screen.getByText(/SKU SAMPLE-TEST-BULB · White · Warm White/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Matte Black" }));
    expect(screen.getByText(/SKU SAMPLE-TEST-BULB · Matte Black · Warm White/)).toBeInTheDocument();
  });

  it("clamps the quantity at a minimum of 1", async () => {
    const user = userEvent.setup();
    renderPanel(baseProduct);
    const decrease = screen.getAllByRole("button", { name: "Decrease quantity" })[0]!;
    expect(decrease).toBeDisabled();
    await user.click(screen.getAllByRole("button", { name: "Increase quantity" })[0]!);
    expect(decrease).toBeEnabled();
  });

  it("disables purchasing when the product is out of stock", () => {
    renderPanel({ ...baseProduct, inStock: false, variants: undefined });
    for (const button of screen.getAllByRole("button", { name: /Add to Cart|Buy Now|Out of Stock/ })) {
      expect(button).toBeDisabled();
    }
  });

  it("confirms Add to Cart with a clearly-sample toast", async () => {
    const user = userEvent.setup();
    renderPanel(baseProduct);
    await user.click(screen.getAllByRole("button", { name: /Add to Cart/ })[0]!);
    expect(screen.getByRole("status")).toHaveTextContent(/sample mode/i);
  });
});
