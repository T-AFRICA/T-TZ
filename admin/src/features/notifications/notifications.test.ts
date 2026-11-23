import { describe, expect, it } from "vitest";
import { STAFF_NOTIFICATION_KINDS } from "@tronic/api-contracts";
import type { Actor } from "@tronic/permissions";
import { notificationAudiences } from "./audiences";
import { NOTIFICATION_TITLE, NOTIFICATION_TONE, describeNotification, unreadBadge } from "./labels";

/** Which notifications a role is asked for, and what each one says and opens. */

const actor = (assignments: Actor["assignments"]): Actor => ({ userId: "user-1", status: "active", mfaVerified: true, assignments });

describe("notification audiences", () => {
  it("follow the permissions of the role in that country", () => {
    expect(notificationAudiences(actor([{ role: "order_manager", countryId: "tz" }]), "tz")).toEqual(["orders", "inventory"]);
    expect(notificationAudiences(actor([{ role: "inventory_manager", countryId: "tz" }]), "tz")).toEqual(["inventory"]);
    expect(notificationAudiences(actor([{ role: "customer_support", countryId: "tz" }]), "tz")).toEqual(["orders"]);
    expect(notificationAudiences(actor([{ role: "finance_viewer", countryId: "tz" }]), "tz")).toEqual(["orders"]);
    expect(notificationAudiences(actor([{ role: "content_manager", countryId: "tz" }]), "tz")).toEqual([]);
  });

  it("a rider has their own deliveries only", () => {
    expect(notificationAudiences(actor([{ role: "rider", countryId: "tz" }]), "tz")).toEqual(["rider"]);
  });

  it("a super admin has orders and stock, but is not a rider", () => {
    expect(notificationAudiences(actor([{ role: "country_super_admin", countryId: "tz" }]), "tz")).toEqual(["orders", "inventory"]);
    expect(notificationAudiences(actor([{ role: "master_super_admin", countryId: null }]), "tz")).toEqual(["orders", "inventory"]);
  });

  it("a role in one country gives nothing in another", () => {
    expect(notificationAudiences(actor([{ role: "order_manager", countryId: "tz" }]), "ke")).toEqual([]);
    expect(notificationAudiences(actor([{ role: "rider", countryId: "tz" }]), "ke")).toEqual([]);
  });

  it("a suspended administrator has none", () => {
    expect(notificationAudiences({ ...actor([{ role: "order_manager", countryId: "tz" }]), status: "suspended" }, "tz")).toEqual([]);
  });
});

describe("notification wording", () => {
  it("has a title and a tone for every kind the country can send", () => {
    for (const kind of STAFF_NOTIFICATION_KINDS) {
      expect(NOTIFICATION_TITLE[kind].length).toBeGreaterThan(3);
      expect(NOTIFICATION_TONE[kind]).toBeTruthy();
      const described = describeNotification({ kind, orderNumber: null, productSlug: null, productName: null }, "/c/tz");
      expect(described.body).not.toMatch(/null|undefined|\s{2}/);
    }
  });

  it("opens the order, the product's stock or the rider's own delivery, inside the country", () => {
    const order = { orderNumber: "TZ-261120-0A1B2C3D", productSlug: null, productName: null };
    expect(describeNotification({ kind: "order_placed", ...order }, "/c/tz")).toEqual({
      body: "Order TZ-261120-0A1B2C3D was placed and is waiting to be confirmed.",
      href: "/c/tz/orders/TZ-261120-0A1B2C3D",
    });
    expect(describeNotification({ kind: "delivery_assigned", ...order }, "/c/tz").href).toBe("/c/tz/deliveries/TZ-261120-0A1B2C3D");
    // An order that is no longer the rider's is not linked: the rider could not open it.
    expect(describeNotification({ kind: "delivery_reassigned", ...order }, "/c/tz").href).toBe("/c/tz/deliveries");
    expect(describeNotification({ kind: "delivery_cancelled", ...order }, "/c/tz").href).toBe("/c/tz/deliveries");
    expect(describeNotification({ kind: "stock_out", orderNumber: null, productSlug: "sample-top-plug", productName: "13A Top Plug" }, "/c/tz")).toEqual({
      body: "13A Top Plug has run out.",
      href: "/c/tz/inventory/sample-top-plug",
    });
  });

  it("never builds a link out of the console from what the country sent", () => {
    const hostile = describeNotification({ kind: "stock_low", orderNumber: null, productSlug: "../../../sign-in?next=//evil.example", productName: "x" }, "/c/tz");
    expect(hostile.href).toBe("/c/tz/inventory/..%2F..%2F..%2Fsign-in%3Fnext%3D%2F%2Fevil.example");
    const order = describeNotification({ kind: "order_placed", orderNumber: "//evil.example/x", productSlug: null, productName: null }, "/c/tz");
    expect(order.href?.startsWith("/c/tz/orders/")).toBe(true);
    expect(order.href).not.toContain("//");
  });

  it("shows a count as a badge only when there is something unread", () => {
    expect([0, -1, Number.NaN].map(unreadBadge)).toEqual([null, null, null]);
    expect([1, 99, 100].map(unreadBadge)).toEqual(["1", "99", "99+"]);
  });
});
