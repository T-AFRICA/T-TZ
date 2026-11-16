import { describe, expect, it } from "vitest";
import {
  COUNTRY_PERMISSION_KEYS,
  ROLES,
  ROLE_KEYS,
  accessibleCountries,
  can,
  canAccessCountry,
  canGrantRole,
  canSuspend,
  countriesWith,
  grantRefusal,
  grantableRoles,
  isMaster,
  isOperational,
  permissionsIn,
  requiresMfa,
  type Actor,
  type RoleAssignment,
} from "./index";

function actor(assignments: RoleAssignment[], overrides: Partial<Actor> = {}): Actor {
  return { userId: "user-1", status: "active", mfaVerified: true, assignments, ...overrides };
}

const master = actor([{ role: "master_super_admin", countryId: null }]);
const tzSuper = actor([{ role: "country_super_admin", countryId: "tz" }], { userId: "tz-super" });
const keSuper = actor([{ role: "country_super_admin", countryId: "ke" }], { userId: "ke-super" });
const tzOrders = actor([{ role: "order_manager", countryId: "tz" }], { userId: "tz-orders" });

describe("catalogue", () => {
  it("has one global role, and it is never granted in the application", () => {
    const global = ROLE_KEYS.filter((key) => ROLES[key].scope === "global");
    expect(global).toEqual(["master_super_admin"]);
    expect(ROLES.master_super_admin.grantableBy).toBe("provisioning");
  });

  it("gives the Country Super Admin every country permission and asks both super roles for a second factor", () => {
    expect([...ROLES.country_super_admin.permissions].sort()).toEqual([...COUNTRY_PERMISSION_KEYS].sort());
    expect(ROLES.master_super_admin.requiresMfa).toBe(true);
    expect(ROLES.country_super_admin.requiresMfa).toBe(true);
  });

  it("keeps staff.manage and settings.update out of every staff role", () => {
    for (const key of ROLE_KEYS) {
      if (ROLES[key].grantableBy !== "country_super_admin") continue;
      expect(ROLES[key].permissions, key).not.toContain("staff.manage");
      expect(ROLES[key].permissions, key).not.toContain("settings.update");
    }
  });
});

describe("country isolation", () => {
  it("lets a Master Super Admin into every country", () => {
    expect(isMaster(master)).toBe(true);
    expect(accessibleCountries(master)).toBe("all");
    expect(can(master, "customers.read", "tz")).toBe(true);
    expect(can(master, "customers.read", "ke")).toBe(true);
    expect(can(master, "global.admins.manage")).toBe(true);
    expect(countriesWith(master, "orders.read")).toBe("all");
  });

  it("keeps a Tanzania Super Admin inside Tanzania", () => {
    expect(accessibleCountries(tzSuper)).toEqual(["tz"]);
    expect(canAccessCountry(tzSuper, "tz")).toBe(true);
    expect(canAccessCountry(tzSuper, "ke")).toBe(false);
    expect(can(tzSuper, "customers.read", "tz")).toBe(true);
    expect(can(tzSuper, "customers.read", "ke")).toBe(false);
  });

  it("stops a Kenya Super Admin from reading Tanzania customers", () => {
    expect(can(keSuper, "customers.read", "tz")).toBe(false);
    expect(permissionsIn(keSuper, "tz")).toEqual([]);
  });

  it("never grants a country permission without a country, or a global one to a country role", () => {
    expect(can(tzSuper, "orders.read")).toBe(false);
    expect(can(tzSuper, "orders.read", null)).toBe(false);
    expect(can(tzSuper, "global.audit.read")).toBe(false);
    expect(can(tzSuper, "global.audit.read", "tz")).toBe(false);
  });

  it("gives a staff role only its own permissions in its own country", () => {
    expect(can(tzOrders, "orders.update", "tz")).toBe(true);
    expect(can(tzOrders, "products.update", "tz")).toBe(false);
    expect(can(tzOrders, "orders.update", "ke")).toBe(false);
    expect(permissionsIn(tzOrders, "tz").sort()).toEqual([...ROLES.order_manager.permissions].sort());
  });

  it("adds up the roles of an administrator who works in two countries, country by country", () => {
    const both = actor([
      { role: "order_manager", countryId: "tz" },
      { role: "content_manager", countryId: "ke" },
    ]);
    expect([...accessibleCountries(both)].sort()).toEqual(["ke", "tz"]);
    expect(can(both, "orders.update", "tz")).toBe(true);
    expect(can(both, "orders.update", "ke")).toBe(false);
    expect(can(both, "content.publish", "ke")).toBe(true);
    expect(can(both, "content.publish", "tz")).toBe(false);
    expect(countriesWith(both, "orders.read")).toEqual(["tz"]);
  });

  it("ignores assignments whose country does not fit the role's scope", () => {
    const broken = actor([
      { role: "master_super_admin", countryId: "tz" },
      { role: "country_super_admin", countryId: null },
    ]);
    expect(isOperational(broken)).toBe(false);
    expect(isMaster(broken)).toBe(false);
    expect(can(broken, "orders.read", "tz")).toBe(false);
  });
});

describe("suspension and second factor", () => {
  it("gives a suspended administrator nothing, whatever their roles", () => {
    const suspended = { ...master, status: "suspended" as const };
    expect(isOperational(suspended)).toBe(false);
    expect(isMaster(suspended)).toBe(false);
    expect(can(suspended, "orders.read", "tz")).toBe(false);
    expect(accessibleCountries(suspended)).toEqual([]);
    expect(canGrantRole(suspended, "order_manager", "tz", "someone")).toBe(false);
  });

  it("gives a super admin nothing until the second factor is passed", () => {
    const waiting = { ...tzSuper, mfaVerified: false };
    expect(requiresMfa(waiting)).toBe(true);
    expect(isOperational(waiting)).toBe(false);
    expect(can(waiting, "orders.read", "tz")).toBe(false);
  });

  it("does not ask staff for a second factor", () => {
    const staff = { ...tzOrders, mfaVerified: false };
    expect(requiresMfa(staff)).toBe(false);
    expect(can(staff, "orders.read", "tz")).toBe(true);
  });

  it("gives an account without roles nothing", () => {
    expect(isOperational(actor([]))).toBe(false);
  });
});

describe("granting roles", () => {
  it("never grants Master Super Admin in the application, not even by a Master Super Admin", () => {
    expect(grantRefusal(master, "master_super_admin", null, "someone")).toBe("master_is_provisioned");
    expect(grantRefusal(tzSuper, "master_super_admin", null, "someone")).toBe("master_is_provisioned");
    expect(grantRefusal(tzSuper, "master_super_admin", "tz", "someone")).toBe("master_is_provisioned");
  });

  it("lets only a Master Super Admin create a Country Super Admin", () => {
    expect(canGrantRole(master, "country_super_admin", "ke", "someone")).toBe(true);
    expect(grantRefusal(tzSuper, "country_super_admin", "tz", "someone")).toBe("not_allowed");
    expect(grantRefusal(tzOrders, "country_super_admin", "tz", "someone")).toBe("not_allowed");
  });

  it("lets a Country Super Admin assign staff roles in their own country only", () => {
    expect(canGrantRole(tzSuper, "order_manager", "tz", "someone")).toBe(true);
    expect(grantRefusal(tzSuper, "order_manager", "ke", "someone")).toBe("country_not_allowed");
    expect(grantableRoles(tzSuper, "tz")).not.toContain("country_super_admin");
    expect(grantableRoles(tzSuper, "tz")).toContain("customer_support");
    expect(grantableRoles(tzSuper, "ke")).toEqual([]);
    expect(grantableRoles(master, "ke")).toContain("country_super_admin");
  });

  it("does not let staff assign roles", () => {
    expect(grantRefusal(tzOrders, "customer_support", "tz", "someone")).toBe("country_not_allowed");
    expect(grantableRoles(tzOrders, "tz")).toEqual([]);
  });

  it("does not let anyone change their own roles", () => {
    expect(grantRefusal(tzSuper, "order_manager", "tz", "tz-super")).toBe("own_account");
    expect(grantRefusal(master, "country_super_admin", "tz", "user-1")).toBe("own_account");
  });

  it("needs a country for a country role", () => {
    expect(grantRefusal(master, "order_manager", null, "someone")).toBe("country_required");
  });
});

describe("suspending accounts", () => {
  it("is for a Master Super Admin only, never on themselves or another Master Super Admin", () => {
    expect(canSuspend(master, { userId: "tz-super", isMaster: false })).toBe(true);
    expect(canSuspend(master, { userId: "user-1", isMaster: true })).toBe(false);
    expect(canSuspend(master, { userId: "other-master", isMaster: true })).toBe(false);
    expect(canSuspend(tzSuper, { userId: "tz-orders", isMaster: false })).toBe(false);
  });
});
