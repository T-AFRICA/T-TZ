import { describe, expect, it } from "vitest";
import { LOW_STOCK_UNITS, limitHint, purchaseLimit, stockLabel } from "./stock";

describe("stock shown to customers", () => {
  it("says how many units are available when the catalogue knows", () => {
    expect(stockLabel({ inStock: true, stockAvailable: 120 })).toBe("120 in stock");
    expect(stockLabel({ inStock: true, stockAvailable: 1250 })).toBe("1,250 in stock");
    expect(stockLabel({ inStock: true, stockAvailable: LOW_STOCK_UNITS + 1 })).toBe("6 in stock");
  });

  it("warns when few are left", () => {
    expect(stockLabel({ inStock: true, stockAvailable: LOW_STOCK_UNITS })).toBe("Only 5 left");
    expect(stockLabel({ inStock: true, stockAvailable: 1 })).toBe("Only 1 left");
  });

  it("falls back to in stock or out of stock without a count, and never shows a count for an unavailable product", () => {
    expect(stockLabel({ inStock: true })).toBe("In stock");
    expect(stockLabel({ inStock: false })).toBe("Out of stock");
    expect(stockLabel({ inStock: false, stockAvailable: 0 })).toBe("Out of stock");
    // The two flags disagree for a moment while stock changes: availability wins.
    expect(stockLabel({ inStock: false, stockAvailable: 9 })).toBe("Out of stock");
    expect(stockLabel({ inStock: true, stockAvailable: 0 })).toBe("In stock");
  });
});

describe("how many units can be chosen", () => {
  it("is the line limit, or what is available if that is less", () => {
    expect(purchaseLimit({ inStock: true }, 500)).toBe(500);
    expect(purchaseLimit({ inStock: true, stockAvailable: 1200 }, 500)).toBe(500);
    expect(purchaseLimit({ inStock: true, stockAvailable: 37 }, 500)).toBe(37);
    expect(purchaseLimit({ inStock: true, stockAvailable: 0 }, 500)).toBe(500);
  });

  it("says why the quantity stops", () => {
    expect(limitHint({ inStock: true, stockAvailable: 37 }, 500)).toBe("Only 37 available");
    expect(limitHint({ inStock: true, stockAvailable: 1200 }, 500)).toBe("Maximum quantity reached");
    expect(limitHint({ inStock: true }, 500)).toBe("Maximum quantity reached");
  });
});
