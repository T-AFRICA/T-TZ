import { describe, expect, it } from "vitest";
import { SESSION_COOKIE_OPTIONS, SESSION_HINT_COOKIE, hintChange, hintCookie } from "./cookies";
import { hasSignedInHint } from "./sessionHint";

describe("signed-in hint", () => {
  it("recognises the hint cookie", () => {
    expect(hasSignedInHint(`${SESSION_HINT_COOKIE}=1`)).toBe(true);
    expect(hasSignedInHint(`theme=light; ${SESSION_HINT_COOKIE}=1; cart=2`)).toBe(true);
  });

  it("is false without one, for an emptied one and for look-alikes", () => {
    expect(hasSignedInHint("")).toBe(false);
    expect(hasSignedInHint("theme=light; cart=2")).toBe(false);
    expect(hasSignedInHint(`${SESSION_HINT_COOKIE}=`)).toBe(false);
    expect(hasSignedInHint(`${SESSION_HINT_COOKIE}=10`)).toBe(false);
    expect(hasSignedInHint(`x-${SESSION_HINT_COOKIE}=1`)).toBe(false);
    expect(hasSignedInHint(`note=${SESSION_HINT_COOKIE}=1`)).toBe(false);
  });

  it("no longer reads the session cookie itself, which the page cannot see", () => {
    expect(hasSignedInHint("sb-abcdefghijklmnop-auth-token=value")).toBe(false);
  });
});

describe("session cookies", () => {
  it("are HttpOnly, SameSite=Lax and site-wide", () => {
    expect(SESSION_COOKIE_OPTIONS).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
  });

  it("set the hint when a session cookie is stored, whole or in parts", () => {
    expect(hintChange([{ name: "sb-p-auth-token", value: "t", options: { maxAge: 3600 } }])).toBe("set");
    expect(
      hintChange([
        { name: "sb-p-auth-token.0", value: "a", options: { maxAge: 3600 } },
        { name: "sb-p-auth-token", value: "", options: { maxAge: 0 } },
      ]),
    ).toBe("set");
  });

  it("clear the hint when the session cookies are only removed", () => {
    expect(hintChange([{ name: "sb-p-auth-token", value: "", options: { maxAge: 0 } }])).toBe("clear");
    expect(hintChange([{ name: "sb-p-auth-token.0", value: "left", options: { maxAge: 0 } }])).toBe("clear");
  });

  it("leave the hint alone when no session cookie was written", () => {
    expect(hintChange([])).toBeNull();
    expect(hintChange([{ name: "sb-p-auth-token-code-verifier", value: "v" }])).toBeNull();
  });

  it("write a hint that holds no token and that the page can read", () => {
    const set = hintCookie("set");
    expect(set).toMatchObject({ name: SESSION_HINT_COOKIE, value: "1" });
    expect(set.options).toMatchObject({ httpOnly: false, sameSite: "lax", path: "/" });
    expect(set.options.maxAge).toBeGreaterThan(0);
    expect(hintCookie("clear")).toMatchObject({ value: "", options: { maxAge: 0 } });
  });
});
