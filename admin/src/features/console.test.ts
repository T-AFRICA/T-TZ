import { describe, expect, it } from "vitest";
import type { Actor } from "@tronic/permissions";
import { decideGate, gatePath, type AdminRecord, type VerifiedIdentity } from "./auth/gate";
import { auditSummaryText, initials, roleName, serviceState } from "./labels";
import { buildNav, countryIdFromPath, isCountryModule, isCurrentNavItem, isRiderOnly } from "./nav";
import { countrySchema, countryServiceSchema, fieldErrors, inviteSchema, signInSchema, totpSchema } from "./rules";
import { nextTheme, parseTheme } from "./theme";

const identity = (overrides: Partial<VerifiedIdentity> = {}): VerifiedIdentity => ({
  userId: "user-1",
  email: "person@example.test",
  emailConfirmed: true,
  aal: "aal1",
  hasVerifiedFactor: false,
  ...overrides,
});

const record = (overrides: Partial<AdminRecord> = {}): AdminRecord => ({
  known: true,
  status: "active",
  fullName: null,
  assignments: [{ role: "order_manager", countryId: "tz" }],
  mfaRequired: false,
  ...overrides,
});

describe("session gate", () => {
  it("lets staff in after the password alone", () => {
    const gate = decideGate(identity(), record());
    expect(gate).toMatchObject({ state: "ok", actor: { userId: "user-1", status: "active", mfaVerified: false } });
    expect(gatePath(gate)).toBe("/");
  });

  it("sends a super admin to the second step, or to set-up when they have no authenticator", () => {
    const superAdmin = record({ assignments: [{ role: "country_super_admin", countryId: "tz" }], mfaRequired: true });
    expect(decideGate(identity({ hasVerifiedFactor: true }), superAdmin)).toEqual({ state: "mfa_challenge" });
    expect(decideGate(identity(), superAdmin)).toEqual({ state: "mfa_enroll" });
    expect(gatePath({ state: "mfa_challenge" })).toBe("/mfa");
    expect(gatePath({ state: "mfa_enroll" })).toBe("/mfa/setup");
    expect(decideGate(identity({ aal: "aal2", hasVerifiedFactor: true }), superAdmin)).toMatchObject({ state: "ok", actor: { mfaVerified: true } });
  });

  it("gives no access to an unknown, unconfirmed, suspended or role-less account", () => {
    expect(decideGate(identity(), record({ known: false, status: null, assignments: [] }))).toEqual({ state: "no_access", reason: "unknown_account" });
    expect(decideGate(identity({ emailConfirmed: false }), record({ known: false, status: null, assignments: [] }))).toEqual({
      state: "no_access",
      reason: "email_not_confirmed",
    });
    expect(decideGate(identity({ aal: "aal2" }), record({ status: "suspended" }))).toEqual({ state: "no_access", reason: "suspended" });
    expect(decideGate(identity(), record({ assignments: [] }))).toEqual({ state: "no_access", reason: "no_roles" });
  });

  it("ignores roles this version does not know", () => {
    expect(decideGate(identity(), record({ assignments: [{ role: "owner_of_everything", countryId: null }] }))).toEqual({
      state: "no_access",
      reason: "no_roles",
    });
  });
});

const actor = (assignments: Actor["assignments"], mfaVerified = true): Actor => ({ userId: "user-1", status: "active", assignments, mfaVerified });
const tanzania = { id: "tz", name: "Tanzania" };
const labels = (sections: ReturnType<typeof buildNav>) => sections.map((section) => [section.title, section.items.map((item) => item.label)]);

describe("navigation", () => {
  it("shows a Master Super Admin the platform pages and every module of the chosen country", () => {
    const sections = buildNav(actor([{ role: "master_super_admin", countryId: null }]), tanzania);
    expect(labels(sections)).toEqual([
      ["Platform", ["Overview", "Countries", "Administrators", "Audit log", "Security events"]],
      ["Tanzania", ["Dashboard", "Products", "Categories", "Inventory", "Orders", "Customers", "Website content", "Promotions", "Reports", "Riders", "Staff", "Settings"]],
    ]);
    expect(sections[1]!.items.find((item) => item.label === "Orders")?.href).toBe("/c/tz/orders");
  });

  it("shows a Country Super Admin their country and the audit log, without the platform administration", () => {
    const sections = buildNav(actor([{ role: "country_super_admin", countryId: "tz" }]), tanzania);
    expect(labels(sections)[0]).toEqual(["Platform", ["Overview", "Audit log"]]);
    expect(sections[1]!.items).toHaveLength(12);
  });

  it("shows staff only what their role covers", () => {
    const sections = buildNav(actor([{ role: "order_manager", countryId: "tz" }], false), tanzania);
    expect(labels(sections)).toEqual([
      ["Platform", ["Overview"]],
      ["Tanzania", ["Dashboard", "Products", "Inventory", "Orders", "Customers", "Riders"]],
    ]);
  });

  it("shows a rider their deliveries and nothing else of the country", () => {
    const sections = buildNav(actor([{ role: "rider", countryId: "tz" }], false), tanzania);
    expect(labels(sections)).toEqual([
      ["Platform", ["Overview"]],
      ["Tanzania", ["Dashboard", "My deliveries"]],
    ]);
    expect(sections[1]!.items.find((item) => item.label === "My deliveries")?.href).toBe("/c/tz/deliveries");
  });

  it("gives the rider dashboard only to someone whose one role in the country is Rider", () => {
    expect(isRiderOnly(actor([{ role: "rider", countryId: "tz" }], false), "tz")).toBe(true);
    expect(isRiderOnly(actor([{ role: "rider", countryId: "tz" }, { role: "order_manager", countryId: "tz" }], false), "tz")).toBe(false);
    expect(isRiderOnly(actor([{ role: "rider", countryId: "ke" }], false), "tz")).toBe(false);
    expect(isRiderOnly(actor([{ role: "master_super_admin", countryId: null }]), "tz")).toBe(false);
  });

  it("shows nothing of a country the administrator has no role in", () => {
    const sections = buildNav(actor([{ role: "country_super_admin", countryId: "tz" }]), { id: "ke", name: "Kenya" });
    expect(labels(sections)[1]).toEqual(["Kenya", ["Dashboard"]]);
  });

  it("reads the country from a path and marks the current item", () => {
    expect(countryIdFromPath("/c/tz/orders")).toBe("tz");
    expect(countryIdFromPath("/c/congo")).toBe("congo");
    expect(countryIdFromPath("/countries")).toBeNull();
    expect(countryIdFromPath("/c/TZ")).toBeNull();
    expect(isCurrentNavItem("/", "/")).toBe(true);
    expect(isCurrentNavItem("/", "/audit")).toBe(false);
    expect(isCurrentNavItem("/c/tz", "/c/tz/orders")).toBe(false);
    expect(isCurrentNavItem("/c/tz/orders", "/c/tz/orders")).toBe(true);
    expect(isCurrentNavItem("/audit", "/audit")).toBe(true);
    expect(isCountryModule("orders")).toBe(true);
    expect(isCountryModule("staff")).toBe(false);
    expect(isCountryModule("constructor")).toBe(false);
  });
});

describe("form rules", () => {
  it("normalise and check the sign-in and code fields", () => {
    expect(signInSchema.parse({ email: "  Person@Example.TEST ", password: "x" }).email).toBe("person@example.test");
    expect(signInSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
    expect(signInSchema.safeParse({ email: "a@example.test", password: "" }).success).toBe(false);
    expect(totpSchema.parse({ code: "246 810" }).code).toBe("246810");
    expect(totpSchema.safeParse({ code: "24681" }).success).toBe(false);
    expect(totpSchema.safeParse({ code: "abcdef" }).success).toBe(false);
  });

  it("never accept the master role or a global role in the invite form", () => {
    expect(inviteSchema.safeParse({ email: "a@example.test", role: "order_manager", countryId: "tz" }).success).toBe(true);
    const refused = inviteSchema.safeParse({ email: "a@example.test", role: "master_super_admin", countryId: "tz" });
    expect(refused.success).toBe(false);
    expect(inviteSchema.safeParse({ email: "a@example.test", role: "order_manager", countryId: "TZ; drop" }).success).toBe(false);
  });

  it("a rider needs a name and a phone; a Tanzanian 07xx number gets +255", () => {
    const rider = { email: "r@example.test", role: "rider", countryId: "tz" };
    expect(inviteSchema.safeParse({ ...rider, name: "", phone: "" }).success).toBe(false);
    expect(inviteSchema.parse({ ...rider, name: "  Asha   Mwita ", phone: "0713 000-222" })).toMatchObject({ name: "Asha Mwita", phone: "+255713000222" });
    expect(inviteSchema.safeParse({ ...rider, name: "Asha", phone: "0713" }).success).toBe(false);
    // Other roles may leave both empty.
    expect(inviteSchema.parse({ email: "a@example.test", role: "order_manager", countryId: "tz", name: "", phone: "" })).toMatchObject({ name: null, phone: null });
  });

  it("clear empty country fields and check the rest", () => {
    const base = { countryId: "congo", name: "Congo", isoCode: "", currency: "", timezone: "", websiteDomain: "", status: "pending_confirmation" };
    expect(countrySchema.parse(base)).toMatchObject({ isoCode: null, currency: null, timezone: null, websiteDomain: null });
    expect(countrySchema.parse({ ...base, websiteDomain: "Tronic.Example.TEST" }).websiteDomain).toBe("tronic.example.test");
    const bad = countrySchema.safeParse({ ...base, isoCode: "TZA", currency: "tz", timezone: "Mars/Olympus", websiteDomain: "https://x.test/", status: "live" });
    expect(bad.success).toBe(false);
    expect(Object.keys(fieldErrors(bad.error!)).sort()).toEqual(["currency", "isoCode", "status", "timezone", "websiteDomain"]);
  });

  it("take a service address over HTTPS only", () => {
    const base = { countryId: "tz", apiBaseUrl: "", vercelProject: "", supabaseProjectRef: "", enabled: false };
    expect(countryServiceSchema.parse(base).apiBaseUrl).toBeNull();
    expect(countryServiceSchema.safeParse({ ...base, apiBaseUrl: "https://tz.example.test" }).success).toBe(true);
    for (const address of ["http://tz.example.test", "https://tz.example.test/", "https://user:pw@tz.example.test", "javascript:alert(1)"]) {
      expect(countryServiceSchema.safeParse({ ...base, apiBaseUrl: address }).success, address).toBe(false);
    }
  });
});

describe("labels and theme", () => {
  it("describe a service only as far as it was really checked", () => {
    expect(serviceState(null)).toMatchObject({ label: "Not registered", connected: false });
    expect(serviceState({ apiBaseUrl: "https://x.test", enabled: false, lastCheck: null })).toMatchObject({ label: "Registered, switched off", connected: false });
    expect(serviceState({ apiBaseUrl: "https://x.test", enabled: true, lastCheck: null })).toMatchObject({ label: "Switched on, never checked", connected: false });
    expect(serviceState({ apiBaseUrl: "https://x.test", enabled: true, lastCheck: { ok: false } })).toMatchObject({ label: "Not answering", connected: false });
    expect(serviceState({ apiBaseUrl: "https://x.test", enabled: true, lastCheck: { ok: true } })).toMatchObject({ label: "Connected", connected: true });
  });

  it("summarise audit entries and names", () => {
    expect(roleName("country_super_admin")).toBe("Country Super Admin");
    expect(roleName("something_new")).toBe("something_new");
    expect(auditSummaryText("role.grant", { role: "order_manager", email: "a@example.test" })).toBe("Order Manager · a@example.test");
    expect(
      auditSummaryText("country.update", { before: { website_domain: null, status: "planned" }, after: { website_domain: "x.test", status: "planned" } }),
    ).toBe("website domain: not set → x.test");
    expect(initials("Asha Mrema", "asha@example.test")).toBe("AM");
    expect(initials(null, "tz.super@example.test")).toBe("TS");
  });

  it("cycle the theme and ignore unknown stored values", () => {
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("purple")).toBe("system");
    expect(parseTheme(undefined)).toBe("system");
    expect(nextTheme("system")).toBe("light");
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("system");
  });
});
