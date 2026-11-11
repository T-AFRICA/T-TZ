import { describe, expect, it } from "vitest";
import { MockCatalogClient } from "@tronic/api-client";
import { formatPrice, getSampleProduct } from "@/components/home/sampleProducts";
import { PAYMENT_METHODS, TZ_REGIONS } from "./config";
import { buyNowHref, parseBuyNowParams } from "./links";
import { quoteCheckout } from "./quote";
import { EMPTY_CHECKOUT_FORM, normalizeTzPhone, validateCheckout, type CheckoutForm } from "./validation";

const valid: CheckoutForm = {
  ...EMPTY_CHECKOUT_FORM,
  fullName: "Amina Juma",
  email: "amina@example.com",
  phone: "0712 345 678",
  region: "Dar es Salaam",
  district: "Kinondoni",
  ward: "Mikocheni",
  street: "Plot 12, Example Street",
};

describe("checkout validation", () => {
  it("accepts a complete form", () => {
    expect(validateCheckout(valid)).toEqual({});
  });

  it("normalises Tanzanian mobile numbers and rejects others", () => {
    expect(normalizeTzPhone("0712 345 678")).toBe("+255712345678");
    expect(normalizeTzPhone("+255 612-345-678")).toBe("+255612345678");
    expect(normalizeTzPhone("255712345678")).toBe("+255712345678");
    expect(normalizeTzPhone("712345678")).toBe("+255712345678");
    expect(normalizeTzPhone("0812 345 678")).toBeNull();
    expect(normalizeTzPhone("+254712345678")).toBeNull();
    expect(normalizeTzPhone("07123")).toBeNull();
  });

  it("reports required, malformed and over-long fields", () => {
    const errors = validateCheckout({
      ...valid,
      fullName: " ",
      email: "amina@",
      phone: "12345",
      region: "Nairobi",
      street: "x".repeat(121),
      instructions: "y".repeat(301),
    });
    expect(Object.keys(errors).sort()).toEqual(["email", "fullName", "instructions", "phone", "region", "street"]);
  });

  it("refuses a delivery method that is not enabled", () => {
    expect(validateCheckout({ ...valid, deliveryMethod: "pickup" }).deliveryMethod).toBeDefined();
  });

  it("lists the 31 regions; only cash on delivery is open", () => {
    expect(TZ_REGIONS).toHaveLength(31);
    expect(PAYMENT_METHODS.filter((method) => method.status !== "unavailable").map((method) => method.id)).toEqual([
      "pay_on_delivery",
    ]);
    expect(EMPTY_CHECKOUT_FORM.paymentMethod).toBe("pay_on_delivery");
  });

  it("refuses a payment method that is not available", () => {
    expect(validateCheckout({ ...valid, paymentMethod: "card" }).paymentMethod).toBeDefined();
    expect(validateCheckout({ ...valid, paymentMethod: "" }).paymentMethod).toBeDefined();
  });
});

describe("server quote", () => {
  const bulb = getSampleProduct("sample-led-bulb")!;
  const panel = getSampleProduct("sample-led-panel")!;

  const catalog = new MockCatalogClient();

  it("prices lines from the catalogue and ignores anything else the browser sends", async () => {
    const quote = await quoteCheckout(
      [
        { productId: panel.id, color: null, variant: null, quantity: 2, price: 1, unitPrice: 1, priceMinor: 1 },
        { productId: bulb.id, color: null, variant: bulb.variants![0], quantity: 1 },
      ],
      "home",
      catalog,
    );
    expect(quote.lines.map((line) => line.unitPriceMinor)).toEqual([panel.priceMinor, bulb.priceMinor]);
    expect(quote.subtotalMinor).toBe(panel.priceMinor * 2 + bulb.priceMinor);
    expect(quote.itemCount).toBe(3);
    expect(quote.deliveryFeeMinor).toBeNull();
    expect(quote.totalIsPartial).toBe(true);
    expect(quote.totalMinor).toBe(quote.subtotalMinor);
  });

  it("keeps order totals in minor units: 2 × TZS 28,000 is 5,600,000, shown as TZS 56,000", async () => {
    const quote = await quoteCheckout([{ productId: panel.id, color: null, variant: null, quantity: 2 }], "home", catalog);
    expect(panel.priceMinor).toBe(2_800_000);
    expect(quote.totalMinor).toBe(5_600_000);
    expect(formatPrice(quote.totalMinor)).toBe("TZS 56,000");
    expect(quote.currency).toBe("TZS");
  });

  it("leaves out products with wrong options and counts missing ones", async () => {
    const quote = await quoteCheckout([
      { productId: bulb.id, color: null, variant: null, quantity: 1 },
      { productId: bulb.id, color: null, variant: "Ultraviolet", quantity: 1 },
      { productId: "sample-retired", color: null, variant: null, quantity: 1 },
    ], "home", catalog);
    expect(quote.lines.map((line) => line.issue)).toEqual(["invalid_options", "invalid_options"]);
    expect(quote.missing).toBe(1);
    expect(quote.subtotalMinor).toBe(0);
  });

  it("returns nothing for junk input", async () => {
    expect((await quoteCheckout("not a list", "home", catalog)).lines).toEqual([]);
    expect((await quoteCheckout([{ productId: "<script>", quantity: 1, color: null, variant: null }], "home", catalog)).lines).toEqual([]);
  });
});

describe("Buy Now links", () => {
  it("round-trips one line through the URL and clamps the quantity", () => {
    const href = buyNowHref({ productId: "sample-extension", color: "White", variant: "4-way", quantity: 3 });
    expect(href).toBe("/checkout?buy=sample-extension&qty=3&color=White&variant=4-way");
    const params = Object.fromEntries(new URLSearchParams(href.split("?")[1]));
    expect(parseBuyNowParams(params)).toEqual({ productId: "sample-extension", color: "White", variant: "4-way", quantity: 3 });
    expect(parseBuyNowParams({ buy: "sample-led-panel", qty: "99" })?.quantity).toBe(10);
    expect(parseBuyNowParams({ buy: "sample-led-panel", qty: "abc" })?.quantity).toBe(1);
    expect(parseBuyNowParams({ buy: "../etc" })).toBeNull();
    expect(parseBuyNowParams({})).toBeNull();
  });
});
