import { describe, expect, it } from "vitest";
import { ACTIVE_COUNTRY, currencyFractionDigits, formatMoney } from "@tronic/country-config";

describe("formatMoney", () => {
  it("formats Tanzanian shillings without decimals and with the currency code", () => {
    expect(formatMoney(28_000, ACTIVE_COUNTRY)).toBe("TZS 28,000");
    expect(formatMoney(0, ACTIVE_COUNTRY)).toBe("TZS 0");
    expect(formatMoney(1_250_000, ACTIVE_COUNTRY)).toBe("TZS 1,250,000");
  });

  it("uses the currency's own precision", () => {
    expect(currencyFractionDigits("TZS")).toBe(0);
    expect(currencyFractionDigits("KES")).toBe(0);
    expect(currencyFractionDigits("USD")).toBe(2);
    expect(formatMoney(1_999, ACTIVE_COUNTRY, "USD")).toBe("USD 19.99");
  });
});
