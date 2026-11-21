import { describe, expect, it } from "vitest";
import { createThrottle } from "./throttle";

describe("attempt limits", () => {
  it("stops guessing at one account from many addresses", () => {
    const throttle = createThrottle();
    const results = Array.from({ length: 25 }, (_, i) => throttle.allow("signIn", "someone@example.test", `10.0.0.${i}`, 1_000));
    expect(results.slice(0, 20).every(Boolean)).toBe(true);
    expect(results.slice(20).some(Boolean)).toBe(false);
  });

  it("treats the target without regard to case or surrounding spaces", () => {
    const throttle = createThrottle();
    for (let i = 0; i < 3; i += 1) expect(throttle.allow("passwordReset", "Someone@Example.test", "10.0.0.1", 1_000)).toBe(true);
    expect(throttle.allow("passwordReset", "  someone@example.test ", "10.0.0.2", 1_000)).toBe(false);
  });

  it("stops one address trying many order numbers", () => {
    const throttle = createThrottle();
    const results = Array.from({ length: 105 }, (_, i) => throttle.allow("trackOrder", `TZ-261120-${String(i).padStart(8, "0")}`, "10.0.0.9", 1_000));
    expect(results.slice(0, 100).every(Boolean)).toBe(true);
    expect(results.slice(100).some(Boolean)).toBe(false);
  });

  it("keeps the kinds apart and opens again after the window", () => {
    const throttle = createThrottle(60_000);
    for (let i = 0; i < 3; i += 1) throttle.allow("passwordReset", "a@example.test", "10.0.0.1", 0);
    expect(throttle.allow("passwordReset", "a@example.test", "10.0.0.1", 1)).toBe(false);
    // Another form for the same address is counted on its own.
    expect(throttle.allow("signIn", "a@example.test", "10.0.0.1", 1)).toBe(true);
    expect(throttle.allow("passwordReset", "a@example.test", "10.0.0.1", 60_001)).toBe(true);
  });

  it("does not let other customers' attempts count against someone else", () => {
    const throttle = createThrottle();
    for (let i = 0; i < 20; i += 1) throttle.allow("signIn", "a@example.test", "10.0.0.1", 0);
    expect(throttle.allow("signIn", "a@example.test", "10.0.0.2", 0)).toBe(false);
    expect(throttle.allow("signIn", "b@example.test", "10.0.0.2", 0)).toBe(true);
  });
});
