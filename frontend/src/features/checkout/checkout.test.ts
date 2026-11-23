import { describe, expect, it } from "vitest";
import { MockCatalogClient } from "@tronic/api-client";
import {
  ONLINE_PAYMENT_METHODS,
  getPaymentPolicy,
  isMethodOffered,
  offeredMobileMoneyProviders,
  payOnDeliveryRefusal,
  type CountryPaymentPolicy,
} from "@tronic/country-config";
import { formatPrice, getSampleProduct } from "@/components/home/sampleProducts";
import { PAYMENT_METHODS, TZ_REGIONS } from "./config";
import { buyNowHref, parseBuyNowParams } from "./links";
import { DEFAULT_DIAL_CODE, DIAL_CODES, OTHER_DIAL_CODE, isDialCode, normalizeWhatsApp, splitWhatsApp, tzLocalNumber } from "./phone";
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

describe("country payment policy", () => {
  const tz = getPaymentPolicy("TZ");

  it("Tanzania offers cash on delivery only; Kenya and Uganda offer nothing yet", () => {
    expect(ONLINE_PAYMENT_METHODS.filter((method) => isMethodOffered(tz, method))).toEqual([]);
    expect(isMethodOffered(tz, "pay_on_delivery")).toBe(true);
    expect(offeredMobileMoneyProviders(tz)).toEqual([]);
    expect(tz.bankAccounts).toEqual([]);
    for (const country of ["KE", "UG"] as const) {
      const policy = getPaymentPolicy(country);
      expect(Object.keys(policy.methods).filter((method) => isMethodOffered(policy, method))).toEqual([]);
    }
    expect(isMethodOffered(tz, "crypto")).toBe(false);
  });

  it("a live method still needs what it depends on: a supported wallet, a confirmed bank account", () => {
    const allLive: CountryPaymentPolicy = {
      ...tz,
      methods: { mobile_money: "live", card: "live", bank_transfer: "live", pay_on_delivery: "live" },
    };
    expect(isMethodOffered(allLive, "mobile_money")).toBe(false);
    expect(isMethodOffered(allLive, "bank_transfer")).toBe(false);
    expect(isMethodOffered(allLive, "card")).toBe(true);
    const withWallet: CountryPaymentPolicy = {
      ...allLive,
      mobileMoneyProviders: [
        { id: "mpesa", name: "M-Pesa", availability: "live" },
        { id: "halopesa", name: "HaloPesa", availability: "unavailable" },
      ],
    };
    expect(isMethodOffered(withWallet, "mobile_money")).toBe(true);
    expect(offeredMobileMoneyProviders(withWallet).map((provider) => provider.id)).toEqual(["mpesa"]);
  });

  it("cash on delivery can be limited by region and by order total", () => {
    const limited: CountryPaymentPolicy = { ...tz, payOnDelivery: { regions: ["Dar es Salaam"], maxTotalMinor: 100_000_000 } };
    expect(payOnDeliveryRefusal(limited, "Dar es Salaam", 5_600_000)).toBeNull();
    expect(payOnDeliveryRefusal(limited, "Arusha", 5_600_000)).toBe("region");
    expect(payOnDeliveryRefusal(limited, "Dar es Salaam", 100_000_001)).toBe("amount");
    expect(payOnDeliveryRefusal(tz, "Arusha", 999_999_999_00)).toBeNull();
    expect(payOnDeliveryRefusal(getPaymentPolicy("KE"), "Nairobi", 1)).toBe("not_offered");
  });

  it("mobile money needs a wallet and a Tanzanian number, but only when chosen", () => {
    expect(validateCheckout({ ...valid, walletNumber: "junk" })).toEqual({});
    // Not offered in Tanzania yet, so the choice itself is refused first.
    expect(Object.keys(validateCheckout({ ...valid, paymentMethod: "mobile_money" }))).toEqual(["paymentMethod"]);
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
    expect(parseBuyNowParams({ buy: "sample-led-panel", qty: "99" })?.quantity).toBe(99);
    expect(parseBuyNowParams({ buy: "sample-led-panel", qty: "500" })?.quantity).toBe(500);
    expect(parseBuyNowParams({ buy: "sample-led-panel", qty: "501" })?.quantity).toBe(500);
    expect(parseBuyNowParams({ buy: "sample-led-panel", qty: "-3" })?.quantity).toBe(1);
    expect(parseBuyNowParams({ buy: "sample-led-panel", qty: "abc" })?.quantity).toBe(1);
    expect(parseBuyNowParams({ buy: "../etc" })).toBeNull();
    expect(parseBuyNowParams({})).toBeNull();
  });
});

describe("the WhatsApp number at checkout", () => {
  it("puts the chosen country code in front and drops the leading zero", () => {
    expect(normalizeWhatsApp("0712 345 678", "+255")).toBe("+255712345678");
    expect(normalizeWhatsApp("712-345-678", "+255")).toBe("+255712345678");
    // The code typed again with Tanzania chosen, as people often do.
    expect(normalizeWhatsApp("255712345678", "+255")).toBe("+255712345678");
    expect(normalizeWhatsApp("0712 345 678", "+254")).toBe("+254712345678");
    expect(normalizeWhatsApp("(300) 123.4567", "+92")).toBe("+923001234567");
    expect(normalizeWhatsApp("7911 123456", "+44")).toBe("+447911123456");
  });

  it("lets a number typed in full carry its own country code, whatever is chosen", () => {
    expect(normalizeWhatsApp("+254 712 345 678", "+255")).toBe("+254712345678");
    expect(normalizeWhatsApp("00254712345678", "+255")).toBe("+254712345678");
    // A country that is not in the list.
    expect(normalizeWhatsApp("+358 40 123 4567", OTHER_DIAL_CODE)).toBe("+358401234567");
    expect(normalizeWhatsApp("+255 612 345 678")).toBe("+255612345678");
  });

  it("refuses what is not a number the orders table would keep", () => {
    // Too short, too long, letters, a second plus, nothing at all.
    for (const bad of ["", "   ", "12345", "+12345678", "+1234567890123456", "07abc45678", "+255 712 345 678 ext 4", "++255712345678", "+0712345678", "0", "+"]) {
      expect(normalizeWhatsApp(bad, "+255"), bad).toBeNull();
    }
    // A Tanzanian number must be a mobile one (6 or 7 after the code): WhatsApp runs on a mobile number.
    expect(normalizeWhatsApp("0222 123 456", "+255")).toBeNull();
    expect(normalizeWhatsApp("+255 22 212 3456")).toBeNull();
    // Without a plus sign there must be a country code from the list.
    expect(normalizeWhatsApp("712345678", OTHER_DIAL_CODE)).toBeNull();
    for (const hostile of ["255", "+999", "+255; drop table orders", "<script>", "+", "++", " +255"]) {
      expect(normalizeWhatsApp("712345678", hostile), hostile).toBeNull();
    }
    // Whatever comes out is exactly what the database checks for.
    for (const [number, code] of [["0712 345 678", "+255"], ["+971 50 123 4567", ""], ["3001234567", "+92"]] as const) {
      expect(normalizeWhatsApp(number, code)).toMatch(/^\+[1-9][0-9]{8,14}$/);
    }
  });

  it("lists each country code once, none hidden inside another, Tanzania first", () => {
    expect(DIAL_CODES[0]).toEqual({ iso: "TZ", name: "Tanzania", code: DEFAULT_DIAL_CODE });
    const codes = DIAL_CODES.map((entry) => entry.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(new Set(DIAL_CODES.map((entry) => entry.iso)).size).toBe(codes.length);
    for (const code of codes) {
      expect(code).toMatch(/^\+[1-9][0-9]{0,3}$/);
      expect(codes.filter((other) => other !== code && other.startsWith(code)), code).toEqual([]);
    }
    expect([isDialCode("+255"), isDialCode("255"), isDialCode(""), isDialCode("+999")]).toEqual([true, false, false, false]);
  });

  it("shows a stored number back as a country code and the rest", () => {
    expect(splitWhatsApp("+255712345678")).toEqual({ dialCode: "+255", national: "712 345 678" });
    expect(splitWhatsApp("+254712345678")).toEqual({ dialCode: "+254", national: "712345678" });
    expect(splitWhatsApp("+14155550123")).toEqual({ dialCode: "+1", national: "4155550123" });
    // Not in the list, or not a stored number at all.
    expect([splitWhatsApp("+358401234567"), splitWhatsApp("0712345678"), splitWhatsApp(""), splitWhatsApp(null)]).toEqual([null, null, null, null]);
    // Back and forth without loss.
    for (const number of ["+255712345678", "+254712345678", "+923001234567", "+971501234567"]) {
      const split = splitWhatsApp(number)!;
      expect(normalizeWhatsApp(split.national, split.dialCode)).toBe(number);
    }
    expect(tzLocalNumber("+255712345678")).toBe("0712 345 678");
    expect([tzLocalNumber("+254712345678"), tzLocalNumber(null)]).toEqual([null, null]);
  });

  it("checks the form's number with its country code, and never trusts a code that is not in the list", () => {
    expect(validateCheckout({ ...valid, phoneCountry: "+254", phone: "0712 345 678" })).toEqual({});
    expect(validateCheckout({ ...valid, phoneCountry: OTHER_DIAL_CODE, phone: "+358 40 123 4567" })).toEqual({});
    expect(validateCheckout({ ...valid, phone: "" }).phone).toBe("Enter your WhatsApp number.");
    expect(validateCheckout({ ...valid, phone: "0222 123 456" }).phone).toMatch(/Tanzanian mobile number/);
    expect(validateCheckout({ ...valid, phoneCountry: "+254", phone: "12" }).phone).toMatch(/\+254/);
    expect(validateCheckout({ ...valid, phoneCountry: OTHER_DIAL_CODE, phone: "712345678" }).phone).toMatch(/with \+ and its country code/);
    // A made-up country code in the request is treated as none: the number must then carry its own.
    expect(validateCheckout({ ...valid, phoneCountry: "+999", phone: "712345678" }).phone).toBeDefined();
    expect(validateCheckout({ ...valid, phoneCountry: "<script>", phone: "+254712345678" })).toEqual({});
    expect(validateCheckout({ ...valid, phone: `+255712345678${" ".repeat(30)}` }).phone).toBeUndefined();
    expect(validateCheckout({ ...valid, phone: "+".padEnd(40, "1") }).phone).toBeDefined();
  });
});
