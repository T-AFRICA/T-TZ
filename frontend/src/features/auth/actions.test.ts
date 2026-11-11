import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The account server actions against a stand-in Supabase client: they
 * validate before calling the provider, refuse while auth is off, map
 * provider errors to our codes and never hand back provider details.
 */
const supabase = vi.hoisted(() => ({
  auth: {
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    getUser: vi.fn(),
    updateUser: vi.fn(),
    signOut: vi.fn(),
  },
}));
const configured = vi.hoisted(() => ({ value: true }));

vi.mock("./server", async (importOriginal) => {
  const real = await importOriginal<typeof import("./server")>();
  return {
    ...real,
    authConfigured: () => configured.value,
    siteOrigin: () => "https://shop.example.test",
    supabaseServer: async () => supabase,
  };
});
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT ${path}`);
  },
}));

import { requestPasswordResetAction, signInAction, signUpAction, updatePasswordAction } from "./actions";
import { safeNextPath } from "./server";
import { IDLE } from "./state";

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};

beforeEach(() => {
  configured.value = true;
  for (const fn of Object.values(supabase.auth)) fn.mockReset();
});

describe("sign in", () => {
  it("refuses while auth is not configured, without calling the provider", async () => {
    configured.value = false;
    expect(await signInAction(IDLE, form({ email: "a@example.com", password: "x" }))).toEqual({ status: "error", code: "not_connected" });
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("validates on the server before calling the provider", async () => {
    const result = await signInAction(IDLE, form({ email: "not-an-email", password: "" }));
    expect(result).toMatchObject({ status: "invalid", fieldErrors: { email: expect.any(String), password: expect.any(String) } });
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("signs in and goes to the account page; a bad password gets our own message", async () => {
    supabase.auth.signInWithPassword.mockResolvedValueOnce({ data: {}, error: null });
    await expect(signInAction(IDLE, form({ email: " amina@example.com ", password: "secret-pass-1" }))).rejects.toThrow(
      "REDIRECT /account",
    );
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: "amina@example.com", password: "secret-pass-1" });

    supabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: {},
      error: { code: "invalid_credentials", status: 400, message: "Invalid login credentials (gotrue)" },
    });
    const failed = await signInAction(IDLE, form({ email: "amina@example.com", password: "wrong-pass-1" }));
    expect(failed).toEqual({ status: "error", code: "invalid_credentials" });
    expect(JSON.stringify(failed)).not.toMatch(/gotrue|wrong-pass/);
  });

  it("follows only same-site paths after sign-in", async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });
    await expect(signInAction(IDLE, form({ email: "a@example.com", password: "p", next: "//evil.example" }))).rejects.toThrow(
      "REDIRECT /account",
    );
    expect(safeNextPath("https://evil.example")).toBe("/account");
    expect(safeNextPath("/\\evil.example")).toBe("/account");
    expect(safeNextPath("/checkout")).toBe("/checkout");
  });
});

describe("sign up", () => {
  const valid = {
    fullName: " Amina Juma ",
    email: "amina@example.com",
    phone: "0712 345 678",
    password: "Tronic-2026",
    confirmPassword: "Tronic-2026",
    acceptTerms: "on",
  };

  it("creates the account with a normalised phone and asks the customer to confirm by email", async () => {
    supabase.auth.signUp.mockResolvedValueOnce({ data: { user: { id: "u" }, session: null }, error: null });
    const result = await signUpAction(IDLE, form(valid));
    expect(result).toEqual({ status: "sent", text: expect.stringContaining("Check your email") });
    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: "amina@example.com",
      password: "Tronic-2026",
      options: {
        emailRedirectTo: "https://shop.example.test/auth/confirm?next=/account",
        data: { full_name: "Amina Juma", phone: "+255712345678" },
      },
    });
  });

  it("refuses without accepted terms or with a non-Tanzanian number", async () => {
    expect(await signUpAction(IDLE, form({ ...valid, acceptTerms: "" }))).toMatchObject({ status: "invalid" });
    expect(await signUpAction(IDLE, form({ ...valid, phone: "0812 000 000" }))).toMatchObject({ status: "invalid" });
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
  });
});

describe("password recovery", () => {
  it("gives the same answer whether or not the email has an account", async () => {
    supabase.auth.resetPasswordForEmail.mockResolvedValueOnce({ data: {}, error: null });
    const known = await requestPasswordResetAction(IDLE, form({ email: "amina@example.com" }));
    supabase.auth.resetPasswordForEmail.mockResolvedValueOnce({ data: {}, error: { code: "user_not_found", status: 400 } });
    const unknown = await requestPasswordResetAction(IDLE, form({ email: "nobody@example.com" }));
    expect(unknown).toEqual(known);
    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith("amina@example.com", {
      redirectTo: "https://shop.example.test/auth/confirm?next=/reset-password",
    });
  });

  it("updates the password only inside the session the reset link opened", async () => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    expect(await updatePasswordAction(IDLE, form({ password: "Tronic-2026", confirmPassword: "Tronic-2026" }))).toEqual({
      status: "error",
      code: "link_expired",
    });
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();

    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: "u" } }, error: null });
    supabase.auth.updateUser.mockResolvedValueOnce({ data: {}, error: null });
    await expect(updatePasswordAction(IDLE, form({ password: "Tronic-2026", confirmPassword: "Tronic-2026" }))).rejects.toThrow(
      "REDIRECT /account",
    );
  });
});
