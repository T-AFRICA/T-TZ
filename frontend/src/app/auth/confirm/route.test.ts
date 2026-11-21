// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The target of the links in auth emails: it exchanges only the kinds of
 * link this site sends, and only ever goes on to a page of this site.
 */
const verifyOtp = vi.hoisted(() => vi.fn());

vi.mock("@/features/auth/server", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/features/auth/server")>();
  return { ...real, authConfigured: () => true, supabaseServer: async () => ({ auth: { verifyOtp } }) };
});

import { GET } from "./route";

const ORIGIN = "https://shop.example.test";
const link = (query: string) => new NextRequest(`${ORIGIN}/auth/confirm?${query}`);

beforeEach(() => {
  verifyOtp.mockReset();
  verifyOtp.mockResolvedValue({ error: null });
});

describe("email link target", () => {
  it("exchanges a sign-up confirmation and a password reset, then stays on this site", async () => {
    for (const type of ["signup", "email"]) {
      const response = await GET(link(`token_hash=abc&type=${type}&next=/checkout`));
      expect(response.status, type).toBe(303);
      expect(response.headers.get("location"), type).toBe(`${ORIGIN}/checkout`);
    }
    const reset = await GET(link("token_hash=abc&type=recovery&next=/reset-password"));
    expect(reset.headers.get("location")).toBe(`${ORIGIN}/reset-password`);
    expect(verifyOtp).toHaveBeenCalledTimes(3);
  });

  it("refuses the kinds of link this site never sends, without asking the provider", async () => {
    for (const type of ["magiclink", "invite", "email_change", "phone_change", "sms", ""]) {
      const response = await GET(link(`token_hash=abc&type=${type}&next=/account`));
      expect(response.status, type).toBe(303);
      expect(response.headers.get("location"), type).toBe(`${ORIGIN}/login`);
    }
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("never follows a link to another site", async () => {
    for (const next of ["https://evil.example.test/", "//evil.example.test", "/\evil.example.test"]) {
      const response = await GET(link(`token_hash=abc&type=signup&next=${encodeURIComponent(next)}`));
      expect(new URL(response.headers.get("location")!).origin, next).toBe(ORIGIN);
    }
  });

  it("sends a link that no longer works back to the form it came from", async () => {
    verifyOtp.mockResolvedValue({ error: { code: "otp_expired" } });
    expect((await GET(link("token_hash=old&type=recovery"))).headers.get("location")).toBe(`${ORIGIN}/forgot-password`);
    expect((await GET(link("token_hash=old&type=signup"))).headers.get("location")).toBe(`${ORIGIN}/login`);
    expect((await GET(link("type=signup"))).headers.get("location")).toBe(`${ORIGIN}/login`);
  });
});
