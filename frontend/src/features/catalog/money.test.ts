import { describe, expect, it } from "vitest";
import { ALL_SAMPLE_PRODUCTS, MockCatalogClient } from "@tronic/api-client";
import {
  ACTIVE_COUNTRY,
  COUNTRIES,
  currencyExponent,
  currencyFractionDigits,
  formatMoney,
  fromMinorUnits,
  toMinorUnits,
} from "@tronic/country-config";
import { quoteCheckout } from "@/features/checkout/quote";

/**
 * Money regression tests (review 2026-11-11, "currency scaling"). Stored
 * amounts are ISO 4217 minor units (TZS and KES ×100, UGX ×1); display shows
 * whole shillings. Each block would fail on a 100× slip at that edge.
 */
const KENYA = COUNTRIES.find((c) => c.code === "KE")!;
const UGANDA = COUNTRIES.find((c) => c.code === "UG")!;

describe("storage unit", () => {
  it("uses the ISO 4217 exponent per currency", () => {
    expect(currencyExponent("TZS")).toBe(2);
    expect(currencyExponent("KES")).toBe(2);
    expect(currencyExponent("UGX")).toBe(0);
    expect(() => currencyExponent("XYZ")).toThrow(/Unsupported currency/);
  });

  it("converts shillings to minor units and back (import edge)", () => {
    expect(toMinorUnits(28_000, "TZS")).toBe(2_800_000);
    expect(toMinorUnits("28,000", "TZS")).toBe(2_800_000);
    expect(toMinorUnits("28000.50", "TZS")).toBe(2_800_050);
    expect(toMinorUnits(1_500, "KES")).toBe(150_000);
    expect(toMinorUnits(50_000, "UGX")).toBe(50_000);
    expect(fromMinorUnits(2_800_000, "TZS")).toBe(28_000);
    expect(fromMinorUnits(150_000, "KES")).toBe(1_500);
  });

  it("refuses amounts it would have to round or guess", () => {
    expect(() => toMinorUnits("28000.505", "TZS")).toThrow(/2 decimal places/);
    expect(() => toMinorUnits("50000.5", "UGX")).toThrow(/0 decimal places/);
    expect(() => toMinorUnits("-5", "TZS")).toThrow();
    expect(() => toMinorUnits("1e5", "TZS")).toThrow();
    expect(() => formatMoney(28_000.5, ACTIVE_COUNTRY)).toThrow(/minor units/);
  });
});

describe("display", () => {
  it("shows Tanzanian shillings whole, from minor units", () => {
    expect(formatMoney(2_800_000, ACTIVE_COUNTRY)).toBe("TZS 28,000");
    expect(formatMoney(0, ACTIVE_COUNTRY)).toBe("TZS 0");
    expect(formatMoney(125_000_000, ACTIVE_COUNTRY)).toBe("TZS 1,250,000");
    // The 100× slip this guards against: a whole-shilling figure passed as
    // minor units shows a price a hundred times too small.
    expect(formatMoney(28_000, ACTIVE_COUNTRY)).toBe("TZS 280");
  });

  it("shows Kenyan shillings whole and Ugandan shillings as stored", () => {
    expect(formatMoney(150_000, KENYA)).toBe("KES 1,500");
    expect(formatMoney(50_000, UGANDA)).toBe("UGX 50,000");
  });

  it("keeps display precision separate from the storage exponent", () => {
    expect(currencyFractionDigits("TZS")).toBe(0);
    expect(currencyFractionDigits("KES")).toBe(0);
    expect(currencyFractionDigits("USD")).toBe(2);
    expect(formatMoney(1_999, ACTIVE_COUNTRY, "USD")).toBe("USD 19.99");
  });
});

describe("sample catalogue import", () => {
  it("stores every sample price in TZS minor units, in a believable shilling range", () => {
    for (const product of ALL_SAMPLE_PRODUCTS) {
      expect(product.currency).toBe("TZS");
      expect(Number.isSafeInteger(product.priceMinor)).toBe(true);
      // Whole shillings (no cents in the sample) and between TZS 1,000 and
      // TZS 10,000,000: an unconverted figure (×1) or a double conversion
      // (×10,000) falls outside.
      expect(product.priceMinor % 100).toBe(0);
      const shillings = fromMinorUnits(product.priceMinor, "TZS");
      expect(shillings).toBeGreaterThanOrEqual(1_000);
      expect(shillings).toBeLessThanOrEqual(10_000_000);
    }
  });

  it("keeps the displayed sample prices the owner approved", () => {
    const panel = ALL_SAMPLE_PRODUCTS.find((p) => p.id === "sample-led-panel")!;
    expect(formatMoney(panel.priceMinor, ACTIVE_COUNTRY)).toBe("TZS 28,000");
    expect(formatMoney(panel.wasPriceMinor!, ACTIVE_COUNTRY)).toBe("TZS 35,000");
  });
});

describe("order totals", () => {
  it("adds line totals in minor units and displays the sum in shillings", async () => {
    const quote = await quoteCheckout(
      [
        { productId: "sample-led-panel", color: null, variant: null, quantity: 3 },
        { productId: "sample-top-plug", color: null, variant: null, quantity: 2 },
      ],
      "home",
      new MockCatalogClient(),
    );
    // 3 × TZS 28,000 + 2 × TZS 18,500 = TZS 121,000.
    expect(quote.totalMinor).toBe(12_100_000);
    expect(formatMoney(quote.totalMinor, ACTIVE_COUNTRY)).toBe("TZS 121,000");
  });
});
