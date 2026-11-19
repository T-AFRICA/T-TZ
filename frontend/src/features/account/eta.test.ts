import { describe, expect, it } from "vitest";
import { distanceMetres, formatArrival, formatDistance } from "./eta";

describe("tracking distance and arrival estimate", () => {
  // Two points in Dar es Salaam about 1.1 km apart (Kariakoo to the city centre side).
  const kariakoo = { lat: -6.8186, lng: 39.2737 };
  const nearby = { lat: -6.8186, lng: 39.2837 };

  it("measures the straight line between two points", () => {
    expect(distanceMetres(kariakoo, kariakoo)).toBe(0);
    const metres = distanceMetres(kariakoo, nearby);
    expect(metres).toBeGreaterThan(1090);
    expect(metres).toBeLessThan(1120);
  });

  it("shows metres under 1 km, one decimal under 10 km, whole kilometres above", () => {
    expect(formatDistance(843)).toBe("840 m");
    expect(formatDistance(4)).toBe("10 m");
    expect(formatDistance(2440)).toBe("2.4 km");
    expect(formatDistance(15_400)).toBe("15 km");
  });

  it("estimates the time at city speed over a longer road, and says 'arriving' when close", () => {
    expect(formatArrival(80)).toBe("Arriving now");
    // 1.1 km straight -> about 1.54 km of road at 20 km/h -> 5 minutes.
    expect(formatArrival(1100)).toBe("about 5 min");
    expect(formatArrival(20_000)).toBe("about 1 h 24 min");
    expect(formatArrival(30_000)).toBe("about 2 h 6 min");
  });
});
