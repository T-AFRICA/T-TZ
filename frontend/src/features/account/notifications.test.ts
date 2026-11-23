// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The customer's notifications as the storefront serves them: whose they
 * are (the verified session, never the request), what a database without
 * migration 0023 looks like, and what "mark as read" refuses.
 */
const database = vi.hoisted(() => ({
  CUSTOMER_NOTIFICATION_KINDS: [
    "order_placed",
    "confirmed",
    "processing",
    "packed",
    "dispatched",
    "in_transit",
    "delivered",
    "cancelled",
    "delivery_attempt",
    "payment_received",
    "payment_failed",
    "refunded",
  ],
  listCustomerNotifications: vi.fn(),
  countUnreadCustomerNotifications: vi.fn(),
  markCustomerNotificationsRead: vi.fn(),
}));
const session = vi.hoisted(() => ({ user: null as { id: string } | null }));
const enabled = vi.hoisted(() => ({ value: true }));
const revalidated = vi.hoisted(() => ({ paths: [] as string[] }));

vi.mock("@tronic/database", () => database);
vi.mock("@/features/data/source", () => ({ getDb: () => ({}), getCatalog: async () => ({}), ordersEnabled: () => enabled.value }));
vi.mock("@/features/auth/server", () => ({
  authConfigured: () => true,
  currentUser: async () => (session.user ? { ...session.user, email: "neema@example.test", fullName: null, phone: null, emailVerified: true, avatarVersion: null } : null),
  supabaseServer: async () => ({}),
}));
vi.mock("next/cache", () => ({ revalidatePath: (path: string) => void revalidated.paths.push(path) }));

import { GET } from "@/app/api/account/notifications/unread/route";
import { markNotificationsReadAction } from "./actions";
import { NOTIFICATION_TEXT, notificationsMissing, unreadBadge } from "./notifications";
import { createAccountService } from "./service";

const CUSTOMER = "11111111-2222-4333-8444-555555555555";
const ME = { id: CUSTOMER, email: "neema@example.test", fullName: null, phone: null, emailVerified: true, avatarVersion: null };
const missing = (code: string) => Object.assign(new Error("relation does not exist"), { code });
const form = (id?: string) => {
  const data = new FormData();
  if (id !== undefined) data.set("id", id);
  return data;
};

beforeEach(() => {
  enabled.value = true;
  session.user = { id: CUSTOMER };
  revalidated.paths = [];
  database.listCustomerNotifications.mockReset();
  database.countUnreadCustomerNotifications.mockReset();
  database.markCustomerNotificationsRead.mockReset();
});

describe("notification wording", () => {
  it("has a title and a sentence for every kind the database writes", () => {
    for (const kind of database.CUSTOMER_NOTIFICATION_KINDS) {
      const text = NOTIFICATION_TEXT[kind as keyof typeof NOTIFICATION_TEXT];
      expect(text.title.length).toBeGreaterThan(3);
      expect(text.body.length).toBeGreaterThan(10);
    }
    // The code itself is never in a notification, only where to find it.
    expect(JSON.stringify(NOTIFICATION_TEXT)).not.toMatch(/\d{6}/);
  });

  it("shows a count as a badge only when there is something unread", () => {
    expect([0, -3, Number.NaN, Number.POSITIVE_INFINITY].map(unreadBadge)).toEqual([null, null, null, null]);
    expect([1, 9, 10, 250].map(unreadBadge)).toEqual(["1", "9", "9+", "9+"]);
  });

  it("recognises a database without the notifications, and nothing else", () => {
    expect(notificationsMissing(missing("42P01"))).toBe(true);
    expect(notificationsMissing(missing("42883"))).toBe(true);
    expect(notificationsMissing(missing("42501"))).toBe(false);
    expect(notificationsMissing(new Error("connection lost"))).toBe(false);
    expect(notificationsMissing(null)).toBe(false);
  });
});

describe("the account service", () => {
  it("reads as the signed-in customer and adds the wording", async () => {
    database.listCustomerNotifications.mockResolvedValue([{ id: 7, kind: "in_transit", orderNumber: "TZ-261120-0A1B2C3D", createdAt: "2026-11-23T08:00:00.000Z", readAt: null }]);
    const result = await createAccountService(ME).listNotifications();
    expect(result).toEqual({
      status: "ok",
      data: [{ id: 7, kind: "in_transit", orderNumber: "TZ-261120-0A1B2C3D", createdAt: "2026-11-23T08:00:00.000Z", readAt: null, ...NOTIFICATION_TEXT.in_transit }],
    });
    expect(database.listCustomerNotifications).toHaveBeenCalledWith(expect.anything(), { role: "authenticated", userId: CUSTOMER });
  });

  it("says not connected, instead of failing, on the sample catalogue or before migration 0023", async () => {
    enabled.value = false;
    expect(await createAccountService(ME).listNotifications()).toMatchObject({ status: "not_connected" });
    expect(await createAccountService(ME).countUnreadNotifications()).toBe(0);
    expect(await createAccountService(ME).markNotificationsRead(null)).toBe(false);
    expect(database.listCustomerNotifications).not.toHaveBeenCalled();

    enabled.value = true;
    database.listCustomerNotifications.mockRejectedValue(missing("42P01"));
    database.countUnreadCustomerNotifications.mockRejectedValue(missing("42P01"));
    database.markCustomerNotificationsRead.mockRejectedValue(missing("42883"));
    expect(await createAccountService(ME).listNotifications()).toMatchObject({ status: "not_connected", waitingFor: expect.stringContaining("0023") });
    expect(await createAccountService(ME).countUnreadNotifications()).toBe(0);
    expect(await createAccountService(ME).markNotificationsRead(null)).toBe(false);
  });

  it("does not hide any other database failure", async () => {
    database.listCustomerNotifications.mockRejectedValue(missing("57P01"));
    await expect(createAccountService(ME).listNotifications()).rejects.toThrow();
  });
});

describe("mark as read", () => {
  it("marks one or all for the customer of the session, then refreshes the page", async () => {
    database.markCustomerNotificationsRead.mockResolvedValue(1);
    await markNotificationsReadAction(form("42"));
    await markNotificationsReadAction(form());
    expect(database.markCustomerNotificationsRead.mock.calls.map((call) => [call[1], call[2]])).toEqual([
      [{ role: "authenticated", userId: CUSTOMER }, 42],
      [{ role: "authenticated", userId: CUSTOMER }, null],
    ]);
    expect(revalidated.paths).toEqual(["/account/notifications", "/account/notifications"]);
  });

  it("does nothing when signed out", async () => {
    session.user = null;
    await markNotificationsReadAction(form("42"));
    await markNotificationsReadAction(form());
    expect(database.markCustomerNotificationsRead).not.toHaveBeenCalled();
  });

  it("refuses an id that is not a plain positive number, rather than treating it as all", async () => {
    for (const id of ["0", "-1", "1.5", "1e3", " 4", "4;drop table orders", "12345678901234567", "null"]) await markNotificationsReadAction(form(id));
    expect(database.markCustomerNotificationsRead).not.toHaveBeenCalled();
  });
});

describe("the unread count for the bell", () => {
  it("answers the session's own count, uncached", async () => {
    database.countUnreadCustomerNotifications.mockResolvedValue(3);
    const response = await GET();
    expect(await response.json()).toEqual({ unread: 3 });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(database.countUnreadCustomerNotifications).toHaveBeenCalledWith(expect.anything(), { role: "authenticated", userId: CUSTOMER });
  });

  it("answers 0 when signed out, without asking the database", async () => {
    session.user = null;
    expect(await (await GET()).json()).toEqual({ unread: 0 });
    expect(database.countUnreadCustomerNotifications).not.toHaveBeenCalled();
  });

  it("answers 0, not an error page, when the database fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    database.countUnreadCustomerNotifications.mockRejectedValue(missing("57P01"));
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ unread: 0 });
    // The log line names no customer.
    expect(JSON.stringify(log.mock.calls)).not.toContain(CUSTOMER);
    log.mockRestore();
  });
});
