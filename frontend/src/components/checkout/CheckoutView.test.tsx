import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { getSampleProduct } from "@/components/home/sampleProducts";
import { TrackOrderView } from "@/components/orders/TrackOrderView";
import { cartStore } from "@/features/cart/store";
import { CheckoutView } from "./CheckoutView";

// The server action runs in-process in tests; the real one is a POST.
vi.mock("@/features/checkout/actions", async () => {
  const { quoteCheckout } = await import("@/features/checkout/quote");
  return { getCheckoutQuote: async (lines: unknown) => quoteCheckout(lines) };
});

const panel = getSampleProduct("sample-led-panel")!;
const bulb = getSampleProduct("sample-led-bulb")!;
const price = (amount: number) => new Intl.NumberFormat("en-US").format(amount);

async function summary() {
  return screen.findByRole("complementary", { name: "Order summary" });
}

describe("checkout page", () => {
  it("checks out the cart with server prices", async () => {
    cartStore.set([
      { productId: panel.id, color: null, variant: null, quantity: 2 },
      { productId: bulb.id, color: null, variant: bulb.variants![0]!, quantity: 1 },
    ]);
    render(<CheckoutView buyNowLine={null} />);
    const aside = await summary();
    expect(within(aside).getByText(panel.name)).toBeInTheDocument();
    expect(within(aside).getByText(`SKU ${bulb.sku}`)).toBeInTheDocument();
    expect(aside).toHaveTextContent(price(panel.price * 2 + bulb.price));
    expect(aside).toHaveTextContent("Total so far");
  });

  it("Buy Now shows only that product and leaves the cart alone", async () => {
    cartStore.set([{ productId: panel.id, color: null, variant: null, quantity: 1 }]);
    render(<CheckoutView buyNowLine={{ productId: bulb.id, color: null, variant: bulb.variants![1]!, quantity: 2 }} />);
    const aside = await summary();
    expect(within(aside).queryByText(panel.name)).toBeNull();
    expect(within(aside).getByText(bulb.name)).toBeInTheDocument();
    expect(aside).toHaveTextContent(price(bulb.price * 2));
    expect(screen.getByText(/only this item is in this checkout/)).toBeInTheDocument();
    expect(cartStore.get()).toEqual([{ productId: panel.id, color: null, variant: null, quantity: 1 }]);
  });

  it("validates the details, focuses the first error, and never claims an order", async () => {
    const user = userEvent.setup();
    cartStore.set([{ productId: panel.id, color: null, variant: null, quantity: 1 }]);
    render(<CheckoutView buyNowLine={null} />);
    await summary();
    const place = screen.getAllByRole("button", { name: /Place order/ })[0]!;
    await user.click(place);
    expect(screen.getByLabelText(/Full name/)).toHaveFocus();
    expect(screen.getByText("Enter your full name.")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Full name/), "Amina Juma");
    await user.type(screen.getByLabelText(/Email address/), "amina@example.com");
    await user.type(screen.getByLabelText(/Phone number/), "0812");
    await user.tab();
    expect(screen.getByText("Enter a Tanzanian mobile number, like 0712 345 678.")).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/Phone number/));
    await user.type(screen.getByLabelText(/Phone number/), "0712 345 678");
    await user.selectOptions(screen.getByLabelText(/Region/), "Arusha");
    await user.type(screen.getByLabelText(/District or city/), "Arusha City");
    await user.type(screen.getByLabelText(/Ward or area/), "Kaloleni");
    await user.type(screen.getByLabelText(/Street or building/), "Sokoine Road 5");
    await user.click(place);

    const status = await screen.findByText(/nothing has been ordered or charged/);
    expect(status).toBeInTheDocument();
    expect(screen.queryByText(/order (placed|confirmed)|payment successful/i)).toBeNull();
    expect(status).toHaveTextContent("Cash on delivery is selected");
    expect(status).toHaveTextContent("this order was not sent to TRONIC");
    // Cash on delivery is chosen and open; the online methods cannot be chosen yet.
    const cod = screen.getByRole("radio", { name: /Cash on delivery/ });
    expect(cod).toBeChecked();
    expect(cod).toBeEnabled();
    for (const name of [/Mobile money/, /Debit or credit card/, /Bank transfer/]) {
      expect(screen.getByRole("radio", { name })).toBeDisabled();
    }
  });

  it("shows the empty state when there is nothing to buy", async () => {
    render(<CheckoutView buyNowLine={null} />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Nothing to check out" })).toBeInTheDocument());
  });
});

describe("track order page", () => {
  it("checks the form and says plainly that nothing was looked up", async () => {
    const user = userEvent.setup();
    render(<TrackOrderView />);
    await user.click(screen.getByRole("button", { name: "Track order" }));
    expect(screen.getByText("Enter the order number from your confirmation.")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Order number/), "TZ-12345");
    await user.type(screen.getByLabelText(/Phone or email/), "0712345678");
    await user.click(screen.getByRole("button", { name: "Track order" }));
    expect(screen.getByRole("status")).toHaveTextContent("Nothing was looked up.");
    expect(screen.getAllByRole("listitem")).toHaveLength(7);
  });
});
