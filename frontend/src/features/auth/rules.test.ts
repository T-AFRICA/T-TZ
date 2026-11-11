import { describe, expect, it } from "vitest";
import { passwordChecks, passwordStrength, validateForgot, validateLogin, validateRegister, validateReset } from "./rules";
import { AUTH_ERROR_TEXT, AUTH_NOT_CONNECTED_MESSAGE, authErrorFromSupabase } from "./service";

const register = {
  fullName: "Amina Juma",
  email: "amina@example.com",
  phone: "0712 345 678",
  password: "Tronic2026",
  confirmPassword: "Tronic2026",
  acceptTerms: true,
};

describe("account form rules", () => {
  it("login needs a valid email and a password", () => {
    expect(validateLogin({ email: "amina@example.com", password: "x" })).toEqual({});
    expect(Object.keys(validateLogin({ email: "amina@", password: "" })).sort()).toEqual(["email", "password"]);
  });

  it("registration checks every field, the Tanzanian number and matching passwords", () => {
    expect(validateRegister(register)).toEqual({});
    const errors = validateRegister({
      ...register,
      fullName: "",
      phone: "0812 345 678",
      password: "short",
      confirmPassword: "other",
      acceptTerms: false,
    });
    expect(Object.keys(errors).sort()).toEqual(["acceptTerms", "confirmPassword", "fullName", "password", "phone"]);
    expect(validateRegister({ ...register, confirmPassword: "Tronic2027" }).confirmPassword).toBe("The passwords do not match.");
  });

  it("password policy: length, a letter, a number, at most 72 characters", () => {
    expect(passwordChecks("abc").map((check) => check.met)).toEqual([false, true, false]);
    expect(passwordChecks("abcdefg1").every((check) => check.met)).toBe(true);
    expect(validateReset({ password: "a1".repeat(37), confirmPassword: "a1".repeat(37) }).password).toBeDefined();
    expect(validateReset({ password: "12345678", confirmPassword: "12345678" }).password).toBeDefined();
  });

  it("rates strength as guidance on top of the policy", () => {
    expect(passwordStrength("")).toBe("empty");
    expect(passwordStrength("abc")).toBe("weak");
    expect(passwordStrength("abcdefg1")).toBe("fair");
    expect(passwordStrength("Tronic-Tanzania-26")).toBe("strong");
  });

  it("forgot password needs a valid email", () => {
    expect(validateForgot({ email: "amina@example.com" })).toEqual({});
    expect(validateForgot({ email: "" }).email).toBe("Enter your email address.");
  });
});

describe("auth errors", () => {
  it("maps Supabase Auth errors to customer text without provider details", () => {
    expect(AUTH_NOT_CONNECTED_MESSAGE).toBe("Authentication will be available when account services are connected.");
    expect(authErrorFromSupabase("invalid_credentials")).toBe("invalid_credentials");
    expect(authErrorFromSupabase("email_exists")).toBe("email_taken");
    expect(authErrorFromSupabase("otp_expired")).toBe("link_expired");
    expect(authErrorFromSupabase("over_request_rate_limit")).toBe("rate_limited");
    expect(authErrorFromSupabase(undefined, 429)).toBe("rate_limited");
    expect(authErrorFromSupabase("something_new", 500)).toBe("network");
    for (const text of Object.values(AUTH_ERROR_TEXT)) expect(text).not.toMatch(/supabase|gotrue|jwt|token/i);
  });
});
