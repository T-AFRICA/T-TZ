import { describe, expect, it } from "vitest";
import { productInputSchema } from "@tronic/api-contracts";
import { EMPTY_PRODUCT_FORM, buildProductInput, fromMinor, parseColors, parseSpecifications, parseVariants, slugify, toMinor } from "./form";

const CATEGORY = "11111111-1111-4111-8111-111111111111";
const GROUP = "22222222-2222-4222-8222-222222222222";

describe("the product form", () => {
  it("reads amounts as people type them, in the currency's minor units", () => {
    expect(toMinor("28,000", 2)).toBe(2_800_000);
    expect(toMinor(" 28000.5 ", 2)).toBe(2_800_050);
    expect(toMinor("1500", 0)).toBe(1500);
    expect(toMinor("12.345", 2)).toBeNull();
    expect(toMinor("-5", 2)).toBeNull();
    expect(toMinor("abc", 2)).toBeNull();
    expect(fromMinor(2_800_000, 2)).toBe("28000");
    expect(fromMinor(2_800_050, 2)).toBe("28000.50");
    expect(fromMinor(null, 2)).toBe("");
  });

  it("makes a web address from the name", () => {
    expect(slugify("Smart LED Bulb 12W")).toBe("smart-led-bulb-12w");
    expect(slugify("  Énergie — 3-pin plug!! ")).toBe("energie-3-pin-plug");
  });

  it("reads specifications, variants and colours one per line", () => {
    expect(parseSpecifications("Power: 12 W\n\nBase:E27")).toEqual([
      { label: "Power", value: "12 W" },
      { label: "Base", value: "E27" },
    ]);
    expect(parseSpecifications("no colon here")).toBeNull();
    expect(parseVariants("9W, 12W\n15W")).toEqual(["9W", "12W", "15W"]);
    expect(parseColors("Warm white #FFE9B0\nBlack #000000")).toEqual([
      { name: "Warm white", swatch: "#ffe9b0" },
      { name: "Black", swatch: "#000000" },
    ]);
    expect(parseColors("Red")).toBeNull();
  });

  it("builds what the country accepts, and says what is wrong field by field", () => {
    const built = buildProductInput(
      { ...EMPTY_PRODUCT_FORM, name: "Smart LED Bulb 12W", sku: "tz-bulb-12w", placement: `${CATEGORY}|${GROUP}|`, price: "4,500", wasPrice: "5000", variants: "9W, 12W" },
      { exponent: 2, creating: true },
    );
    expect(built).toMatchObject({ ok: true, slug: "smart-led-bulb-12w", product: { sku: "TZ-BULB-12W", priceMinor: 450_000, wasPriceMinor: 500_000, groupId: GROUP, subcategoryId: null } });
    if (built.ok) expect(productInputSchema.safeParse(built.product).success).toBe(true);

    const wrong = buildProductInput({ ...EMPTY_PRODUCT_FORM, name: "X", sku: "bad sku", price: "0", wasPrice: "abc", colors: "Red" }, { exponent: 2, creating: true });
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(Object.keys(wrong.errors).sort()).toEqual(["colors", "name", "placement", "price", "sku", "wasPrice"]);
    expect(buildProductInput({ ...EMPTY_PRODUCT_FORM, name: "Bulb", sku: "TZ-1", placement: `${CATEGORY}||`, price: "100", variants: "9W, 9w" }, { exponent: 2, creating: false })).toMatchObject({
      ok: false,
      errors: { variants: expect.any(String) },
    });
  });
});
