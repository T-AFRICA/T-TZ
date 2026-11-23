import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatPrice, getSampleProduct } from "@/components/home/sampleProducts";
import { TrackOrderView } from "@/components/orders/TrackOrderView";
import { cartStore } from "@/features/cart/store";
import { CheckoutView } from "./CheckoutView";

// The server actions run in-process in tests; the real ones are POSTs.
const placeOrder = vi.hoisted(() => vi.fn());
vi.mock("@/features/checkout/actions", async () => {
  const { quoteCheckout } = await import("@/features/checkout/quote");
  const { MockCatalogClient } = await import("@tronic/api-client");
  return {
    getCheckoutQuote: async (lines: unknown) => quoteCheckout(lines, "home", new MockCatalogClient()),
    placeOrderAction: placeOrder,
  };
});
const trackOrder = vi.hoisted(() => vi.fn());
vi.mock("@/features/orders/actions", () => ({ trackOrderAction: trackOrder }));

beforeEach(() => {
  placeOrder.mockReset();
  trackOrder.mockReset();
  cartStore.set([]);
  window.sessionStorage.clear();
});

async function fillDetails(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Full name/), "Amina Juma");
  await user.type(screen.getByLabelText(/Email address/), "amina@example.com");
  await user.type(screen.getByLabelText(/WhatsApp number/), "0712 345 678");
  await user.selectOptions(screen.getByLabelText(/Region/), "Arusha");
  await user.type(screen.getByLabelText(/District or city/), "Arusha City");
  await user.type(screen.getByLabelText(/Ward or area/), "Kaloleni");
  await user.type(screen.getByLabelText(/Street or building/), "Sokoine Road 5");
}

const panel = getSampleProduct("sample-led-panel")!;
const bulb = getSampleProduct("sample-led-bulb")!;
const price = (minor: number) => formatPrice(minor);

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
    expect(aside).toHaveTextContent(price(panel.priceMinor * 2 + bulb.priceMinor));
    expect(aside).toHaveTextContent("Total so far");
  });

  it("Buy Now shows only that product and leaves the cart alone", async () => {
    cartStore.set([{ productId: panel.id, color: null, variant: null, quantity: 1 }]);
    render(<CheckoutView buyNowLine={{ productId: bulb.id, color: null, variant: bulb.variants![1]!, quantity: 2 }} />);
    const aside = await summary();
    expect(within(aside).queryByText(panel.name)).toBeNull();
    expect(within(aside).getByText(bulb.name)).toBeInTheDocument();
    expect(aside).toHaveTextContent(price(bulb.priceMinor * 2));
    expect(screen.getByText(/only this item is in this checkout/)).toBeInTheDocument();
    expect(cartStore.get()).toEqual([{ productId: panel.id, color: null, variant: null, quantity: 1 }]);
  });

  it("validates the details, focuses the first error, and never claims an order", async () => {
    const user = userEvent.setup({ delay: null });
    cartStore.set([{ productId: panel.id, color: null, variant: null, quantity: 1 }]);
    render(<CheckoutView buyNowLine={null} />);
    await summary();
    const place = screen.getAllByRole("button", { name: /Place order/ })[0]!;
    await user.click(place);
    expect(screen.getByLabelText(/Full name/)).toHaveFocus();
    expect(screen.getByText("Enter your full name.")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Full name/), "Amina Juma");
    await user.type(screen.getByLabelText(/Email address/), "amina@example.com");
    await user.type(screen.getByLabelText(/WhatsApp number/), "0812");
    await user.tab();
    expect(screen.getByText("Enter a Tanzanian mobile number, like 712 345 678, or choose another country code.")).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/WhatsApp number/));
    await user.type(screen.getByLabelText(/WhatsApp number/), "0712 345 678");
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

  it("with orders connected: confirms only after the order is saved, and clears the cart", async () => {
    const user = userEvent.setup({ delay: null });
    cartStore.set([{ productId: panel.id, color: null, variant: null, quantity: 2 }]);
    let resolve: (value: unknown) => void = () => undefined;
    placeOrder.mockImplementationOnce(() => new Promise((r) => (resolve = r)));
    render(<CheckoutView buyNowLine={null} ordersEnabled />);
    await summary();
    await fillDetails(user);
    const place = screen.getAllByRole("button", { name: /Place order/ })[0]!;
    await user.click(place);

    // While the order is being saved there is no confirmation and no second submit.
    await waitFor(() => expect(placeOrder).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Order placed")).toBeNull();
    expect(screen.getAllByRole("button", { name: /Placing order/ })[0]).toBeDisabled();
    const call = placeOrder.mock.calls[0]![0] as { idempotencyKey: string; expectedTotalMinor: number; form: { paymentMethod: string } };
    expect(call.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(call.expectedTotalMinor).toBe(panel.priceMinor * 2);
    expect(call.form.paymentMethod).toBe("pay_on_delivery");

    resolve({ ok: true, orderNumber: "TZ-261111-ABCD1234", totalMinor: panel.priceMinor * 2, currency: "TZS", itemCount: 2 });
    expect(await screen.findByText("Order placed")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("TZ-261111-ABCD1234");
    expect(screen.getByText(price(panel.priceMinor * 2))).toBeInTheDocument();
    expect(cartStore.get()).toEqual([]);
    expect(window.location.search).not.toContain("TZ-261111");
  });

  it("a retry after a lost answer reuses the idempotency key; a price change shows the new total", async () => {
    const user = userEvent.setup({ delay: null });
    cartStore.set([{ productId: panel.id, color: null, variant: null, quantity: 1 }]);
    placeOrder
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ ok: false, reason: "price_changed", totalMinor: 3_000_000 });
    render(<CheckoutView buyNowLine={null} ordersEnabled />);
    await summary();
    await fillDetails(user);
    const place = () => screen.getAllByRole("button", { name: /Place order/ })[0]!;
    await user.click(place());
    expect(await screen.findByText(/it will not be placed twice/)).toBeInTheDocument();
    await user.click(place());
    await waitFor(() => expect(placeOrder).toHaveBeenCalledTimes(2));
    const [first, second] = placeOrder.mock.calls.map((c) => (c[0] as { idempotencyKey: string }).idempotencyKey);
    expect(second).toBe(first);
    expect(await screen.findByText(/Prices changed since you opened checkout/)).toHaveTextContent("TZS 30,000");
    expect(screen.queryByText("Order placed")).toBeNull();
    expect(cartStore.get()).toHaveLength(1);
  });

  it("payment: offers only approved methods, says what happens next, and the review lists every step", async () => {
    const user = userEvent.setup({ delay: null });
    cartStore.set([{ productId: panel.id, color: null, variant: null, quantity: 1 }]);
    render(<CheckoutView buyNowLine={null} />);
    const aside = await summary();
    // Cash on delivery is the only live method, so it is chosen; its details show at once.
    expect(screen.getByRole("radio", { name: /Cash on delivery/ })).toBeChecked();
    expect(screen.getByText("Pay when it arrives")).toBeInTheDocument();
    expect(aside).toHaveTextContent("PaymentCash on delivery");
    // Methods without an approved provider are "Coming soon"; their fields never appear.
    const coming = screen.getByRole("group", { name: "Coming soon" });
    expect(within(coming).getAllByRole("radio")).toHaveLength(3);
    for (const radio of within(coming).getAllByRole("radio")) expect(radio).toBeDisabled();
    expect(screen.queryByLabelText(/Mobile money number/)).toBeNull();
    expect(screen.queryByText(/card number|cvv/i)).toBeNull();
    expect(screen.getByText(/never asks for your mobile money PIN/)).toBeInTheDocument();

    const review = screen.getByRole("heading", { name: /Review and place order/ }).closest("section")!;
    expect(within(review).getAllByText("Not complete yet")).toHaveLength(2);
    await fillDetails(user);
    expect(within(review).queryByText("Not complete yet")).toBeNull();
    expect(review).toHaveTextContent("Amina Juma · +255712345678");
    expect(review).toHaveTextContent("Sokoine Road 5, Kaloleni, Arusha City, Arusha");
    expect(review).toHaveTextContent("PaymentCash on delivery");
  });

  it("keeps what the customer typed when they leave checkout and come back, and forgets it after the order", async () => {
    const user = userEvent.setup({ delay: null });
    cartStore.set([{ productId: panel.id, color: null, variant: null, quantity: 1 }]);
    const first = render(<CheckoutView buyNowLine={null} ordersEnabled />);
    await summary();
    await fillDetails(user);
    first.unmount();

    render(<CheckoutView buyNowLine={null} ordersEnabled />);
    await summary();
    expect(screen.getByLabelText(/Full name/)).toHaveValue("Amina Juma");
    expect(screen.getByLabelText(/Street or building/)).toHaveValue("Sokoine Road 5");
    placeOrder.mockResolvedValueOnce({ ok: true, orderNumber: "TZ-261118-ABCD1234", totalMinor: panel.priceMinor, currency: "TZS", itemCount: 1 });
    await user.click(screen.getAllByRole("button", { name: /Place order/ })[0]!);
    expect(await screen.findByText("Order placed")).toBeInTheDocument();
    expect(window.sessionStorage.getItem("tronic:checkout-draft")).toBeNull();
  });

  it("shows the empty state when there is nothing to buy", async () => {
    render(<CheckoutView buyNowLine={null} />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Nothing to check out" })).toBeInTheDocument());
  });
});

describe("track order page", () => {
  it("while orders are not connected, cannot be submitted and says why", async () => {
    render(<TrackOrderView enabled={false} />);
    expect(screen.getByRole("button", { name: "Track order" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Online order tracking opens together with online ordering.");
    expect(screen.getAllByRole("listitem")).toHaveLength(7);
    expect(trackOrder).not.toHaveBeenCalled();
  });

  it("checks the form, then posts it and shows the order found", async () => {
    const user = userEvent.setup({ delay: null });
    trackOrder.mockResolvedValueOnce({
      status: "found",
      order: { orderNumber: "TZ-261111-ABCD1234", status: "pending_payment", createdAt: "2026-11-11T10:00:00Z", totalMinor: 5_600_000, currency: "TZS", itemCount: 2 },
    });
    render(<TrackOrderView enabled />);
    await user.click(screen.getByRole("button", { name: "Track order" }));
    expect(screen.getByText("Enter the order number from your confirmation.")).toBeInTheDocument();
    expect(trackOrder).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText(/Order number/), "TZ-261111-ABCD1234");
    await user.type(screen.getByLabelText(/Phone or email/), "0712345678");
    await user.click(screen.getByRole("button", { name: "Track order" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Order TZ-261111-ABCD1234: Pending payment");
    expect(screen.getByRole("status")).toHaveTextContent("TZS 56,000");
  });
});

describe("checkout: the WhatsApp number", () => {
  const code = () => screen.getByLabelText("Country code") as HTMLSelectElement;
  const number = () => screen.getByLabelText(/WhatsApp number/) as HTMLInputElement;

  it("asks for a WhatsApp number with a country code, Tanzania chosen first", async () => {
    cartStore.set([{ productId: panel.id, color: null, variant: null, quantity: 1 }]);
    render(<CheckoutView buyNowLine={null} />);
    await summary();
    expect(screen.queryByLabelText(/Phone number/)).toBeNull();
    expect(code().value).toBe("+255");
    expect(within(code()).getByRole("option", { name: "+254 Kenya" })).toBeInTheDocument();
    expect(within(code()).getByRole("option", { name: "Other country" })).toBeInTheDocument();
    expect(number()).toHaveAttribute("type", "tel");
    expect(number()).toBeRequired();
  });

  it("starts from the account's number, and moves the code of a number typed in full into the list", async () => {
    const user = userEvent.setup({ delay: null });
    cartStore.set([{ productId: panel.id, color: null, variant: null, quantity: 1 }]);
    render(<CheckoutView buyNowLine={null} customer={{ fullName: "Amina Juma", email: "amina@example.com", phone: "+254712345678" }} />);
    await summary();
    await waitFor(() => expect(code().value).toBe("+254"));
    expect(number().value).toBe("712345678");

    await user.clear(number());
    await user.type(number(), "+92 300 1234567");
    await user.tab();
    expect(code().value).toBe("+92");
    expect(number().value).toBe("3001234567");

    // A country that is not in the list keeps its number in full, under "Other country", without an error.
    await user.clear(number());
    await user.type(number(), "+358 40 123 4567");
    await user.tab();
    expect(code().value).toBe("");
    expect(number().value).toBe("+358 40 123 4567");
    expect(number()).not.toHaveAttribute("aria-invalid");

    // Under "Other country" a number without its code is refused, in words.
    await user.clear(number());
    await user.type(number(), "401234567");
    await user.tab();
    expect(screen.getByText("Enter the number in full, with + and its country code, like +255 712 345 678.")).toBeInTheDocument();
    expect(number()).toHaveAttribute("aria-invalid", "true");
    // Choosing the country checks the number again.
    await user.selectOptions(code(), "+254");
    await user.clear(number());
    await user.type(number(), "0712 345 678");
    await user.tab();
    expect(number()).not.toHaveAttribute("aria-invalid");
  });

  it("sends the number and its country code with the order", async () => {
    const user = userEvent.setup({ delay: null });
    cartStore.set([{ productId: panel.id, color: null, variant: null, quantity: 1 }]);
    placeOrder.mockResolvedValueOnce({ ok: true, orderNumber: "TZ-261123-ABCD1234", totalMinor: panel.priceMinor, currency: "TZS", itemCount: 1 });
    render(<CheckoutView buyNowLine={null} ordersEnabled />);
    await summary();
    await fillDetails(user);
    await user.selectOptions(code(), "+254");
    const review = screen.getByRole("heading", { name: /Review and place order/ }).closest("section")!;
    expect(review).toHaveTextContent("Amina Juma · +254712345678");
    await user.click(screen.getAllByRole("button", { name: /Place order/ })[0]!);
    await waitFor(() => expect(placeOrder).toHaveBeenCalledTimes(1));
    const call = placeOrder.mock.calls[0]![0] as { form: { phone: string; phoneCountry: string } };
    expect(call.form).toMatchObject({ phone: "0712 345 678", phoneCountry: "+254" });
    expect(await screen.findByText("Order placed")).toBeInTheDocument();
  });
});
