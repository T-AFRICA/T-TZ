import { describe, expect, it } from "vitest";
import {
  addLine,
  CART_STORAGE_KEY,
  cartStore,
  lineKey,
  MAX_LINE_QUANTITY,
  parseCart,
  parseWishlist,
  removeLine,
  setLineQuantity,
  toggleId,
  type CartLine,
} from "./store";

const bulb: CartLine = { productId: "sample-led-bulb", color: null, variant: "Warm White", quantity: 1 };

describe("cart lines", () => {
  it("merges the same product and options and caps the quantity", () => {
    const once = addLine([], { ...bulb, quantity: 4 });
    const twice = addLine(once, { ...bulb, quantity: 9 });
    expect(twice).toEqual([{ ...bulb, quantity: MAX_LINE_QUANTITY }]);
  });

  it("keeps different options on separate lines, newest first", () => {
    const lines = addLine(addLine([], bulb), { ...bulb, variant: "Daylight" });
    expect(lines.map((line) => line.variant)).toEqual(["Daylight", "Warm White"]);
  });

  it("sets a quantity within 1–10 and removes a line", () => {
    const lines = addLine([], bulb);
    const key = lineKey(bulb);
    expect(setLineQuantity(lines, key, 0)[0]!.quantity).toBe(1);
    expect(setLineQuantity(lines, key, 25)[0]!.quantity).toBe(MAX_LINE_QUANTITY);
    expect(removeLine(lines, key)).toEqual([]);
  });

  it("toggles a wishlist id", () => {
    expect(toggleId([], "sample-led-bulb")).toEqual(["sample-led-bulb"]);
    expect(toggleId(["sample-led-bulb"], "sample-led-bulb")).toEqual([]);
  });
});

describe("parsing stored data", () => {
  it("drops malformed, tampered and duplicate cart entries", () => {
    expect(
      parseCart([
        bulb,
        bulb,
        { ...bulb, quantity: 0 },
        { ...bulb, quantity: 2.5 },
        { ...bulb, productId: "../../etc" },
        { ...bulb, color: 5 },
        { ...bulb, variant: "Daylight", quantity: 99, price: 1 },
        "nonsense",
        null,
      ]),
    ).toEqual([bulb, { ...bulb, variant: "Daylight", quantity: MAX_LINE_QUANTITY }]);
    expect(parseCart({ not: "a list" })).toEqual([]);
  });

  it("keeps unique, well-formed wishlist ids", () => {
    expect(parseWishlist(["sample-led-bulb", "sample-led-bulb", "<script>", 7])).toEqual(["sample-led-bulb"]);
  });

  it("stores only ids, options and quantities, and survives corrupt storage", () => {
    cartStore.set([bulb]);
    expect(JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY)!)).toEqual([bulb]);
    expect(CART_STORAGE_KEY).toBe("tronic.tz.cart.v1");

    window.localStorage.setItem(CART_STORAGE_KEY, "{not json");
    window.dispatchEvent(new StorageEvent("storage", { key: CART_STORAGE_KEY }));
    // Without a subscriber the cached value stands; a fresh read is empty.
    const unsubscribe = cartStore.subscribe(() => {});
    window.dispatchEvent(new StorageEvent("storage", { key: CART_STORAGE_KEY }));
    expect(cartStore.get()).toEqual([]);
    unsubscribe();
  });
});
