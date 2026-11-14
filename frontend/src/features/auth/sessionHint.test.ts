import { describe, expect, it } from "vitest";
import { hasSessionCookie } from "./sessionHint";

describe("signed-in hint", () => {
  it("recognises the session cookie, whole or in numbered parts", () => {
    expect(hasSessionCookie("sb-abcdefghijklmnop-auth-token=value")).toBe(true);
    expect(hasSessionCookie("theme=light; sb-abcdefghijklmnop-auth-token.0=part; sb-abcdefghijklmnop-auth-token.1=rest")).toBe(true);
    expect(hasSessionCookie("cart=1; sb-127-auth-token=x")).toBe(true);
  });

  it("is false without one, for an emptied one and for look-alikes", () => {
    expect(hasSessionCookie("")).toBe(false);
    expect(hasSessionCookie("theme=light; cart=2")).toBe(false);
    expect(hasSessionCookie("sb-abcdefghijklmnop-auth-token=")).toBe(false);
    expect(hasSessionCookie("sb-abcdefghijklmnop-auth-token=; theme=light")).toBe(false);
    expect(hasSessionCookie("sb-abcdefghijklmnop-auth-token-code-verifier=abc")).toBe(false);
    expect(hasSessionCookie("note=sb-x-auth-token=1")).toBe(false);
  });
});
