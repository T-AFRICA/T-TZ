import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@tronic/ui";
import type { SampleProduct } from "@/components/home/sampleProducts";
import { cartStore } from "@/features/cart/store";
import { PurchasePanel } from "./PurchasePanel";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const baseProduct: SampleProduct = {
  id: "sample-test-bulb",
  slug: "sample-test-bulb",
  sku: "SAMPLE-TEST-BULB",
  name: "Test Bulb",
  brand: "TRONIC",
  categorySlug: "lighting",
  categoryName: "Lighting",
  image: "/products/led-bulb.png",
  priceMinor: 1_000_000,
  currency: "TZS",
  wasPriceMinor: 1_250_000,
  inStock: true,
  countries: ["TZ"],
  active: true,
  sequence: 1,
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

  it("lets the customer type a quantity, up to 500 units (owner decision 2026-11-21)", async () => {
    cartStore.set([]);
    const user = userEvent.setup();
    renderPanel(baseProduct);
    const field = screen.getByRole("textbox", { name: "Quantity" });
    const increase = screen.getByRole("button", { name: "Increase quantity" });
    expect(field).toHaveValue("1");

    // More than ten is fine now; the steppers carry on from what was typed.
    await user.clear(field);
    await user.type(field, "250{Enter}");
    expect(field).toHaveValue("250");
    await user.click(increase);
    expect(field).toHaveValue("251");
    expect(increase).toBeEnabled();
    expect(screen.queryByText("Maximum quantity reached")).not.toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /Add to Cart/ })[0]!);
    expect(cartStore.get()[0]).toMatchObject({ quantity: 251 });
  });

  it("caps the quantity at the maximum and says so, and ignores what is not a number", async () => {
    const user = userEvent.setup();
    renderPanel(baseProduct);
    const field = screen.getByRole("textbox", { name: "Quantity" });
    const increase = screen.getByRole("button", { name: "Increase quantity" });

    // The field takes three digits; anything over 500 becomes 500.
    await user.clear(field);
    await user.type(field, "9999");
    await user.tab();
    expect(field).toHaveValue("500");
    expect(increase).toBeDisabled();
    expect(screen.getByText("Maximum quantity reached")).toBeInTheDocument();

    // Letters and signs are not kept; zero becomes one; an empty field goes back.
    await user.clear(field);
    await user.type(field, "-1e2x");
    await user.tab();
    expect(field).toHaveValue("12");
    await user.clear(field);
    await user.type(field, "0{Enter}");
    expect(field).toHaveValue("1");
    await user.clear(field);
    await user.tab();
    expect(field).toHaveValue("1");
  });

  it("shows the product's own SKU, not one made from its id", () => {
    renderPanel({ ...baseProduct, sku: "MC 4050-6K", colors: undefined, variants: undefined });
    expect(screen.getByText("SKU MC 4050-6K")).toBeInTheDocument();
  });

  it("shows no demo or sample label (removed 2026-11-12, owner request)", () => {
    renderPanel(baseProduct);
    expect(screen.queryByText(/demo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^sample$/i)).not.toBeInTheDocument();
  });

  it("disables purchasing and the quantity stepper when out of stock", () => {
    renderPanel({ ...baseProduct, inStock: false, variants: undefined });
    for (const button of screen.getAllByRole("button", { name: /Add to Cart|Buy Now|Out of Stock/ })) {
      expect(button).toBeDisabled();
    }
    expect(screen.getByRole("button", { name: "Increase quantity" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Decrease quantity" })).toBeDisabled();
  });

  it("adds the chosen line to this browser's cart and confirms with a toast", async () => {
    cartStore.set([]);
    const user = userEvent.setup();
    renderPanel(baseProduct);
    await user.click(screen.getByRole("button", { name: "Increase quantity" }));
    await user.click(screen.getAllByRole("button", { name: /Add to Cart/ })[0]!);
    expect(screen.getByRole("status")).toHaveTextContent("Added 2 × Test Bulb (Warm White) to your cart");
    expect(cartStore.get()).toEqual([
      { productId: "sample-test-bulb", color: null, variant: "Warm White", quantity: 2 },
    ]);
  });
});
