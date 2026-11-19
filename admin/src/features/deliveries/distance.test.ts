import { describe, expect, it } from "vitest";
import { distanceMetres, formatDistance } from "./distance";

describe("the rider's distance to the customer's pin", () => {
  it("measures a straight line in metres", () => {
    expect(distanceMetres({ lat: -6.78, lng: 39.25 }, { lat: -6.78, lng: 39.25 })).toBe(0);
    // About 0.0117 degrees of latitude is 1.3 km.
    expect(distanceMetres({ lat: -6.78, lng: 39.25 }, { lat: -6.7917, lng: 39.25 })).toBeGreaterThan(1250);
    expect(distanceMetres({ lat: -6.78, lng: 39.25 }, { lat: -6.7917, lng: 39.25 })).toBeLessThan(1350);
    expect(Math.round(distanceMetres({ lat: -6.78, lng: 39.25 }, { lat: -6.7924, lng: 39.2083 }) / 100)).toBe(48);
  });

  it("reads as metres below a kilometre, then kilometres", () => {
    expect(formatDistance(3)).toBe("10 m");
    expect(formatDistance(347)).toBe("350 m");
    expect(formatDistance(1300)).toBe("1.3 km");
    expect(formatDistance(12_400)).toBe("12 km");
  });
});
