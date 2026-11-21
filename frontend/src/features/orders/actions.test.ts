// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Track Order by number plus checkout phone or email: what a visitor gets
 * back, and what they never get (the delivery code).
 */
const database = vi.hoisted(() => ({ trackOrder: vi.fn(), getDeliveryCode: vi.fn() }));
const throttle = vi.hoisted(() => ({ open: true, asked: [] as [string, string][] }));
const enabled = vi.hoisted(() => ({ value: true }));

vi.mock("@tronic/database", () => database);
vi.mock("@/features/data/source", () => ({ getDb: () => ({}), ordersEnabled: () => enabled.value }));
vi.mock("@/features/security/throttle", () => ({
  allowAttempt: async (kind: string, target: string) => {
    throttle.asked.push([kind, target]);
    return throttle.open;
  },
}));

import { trackOrderAction, type TrackOrderState } from "./actions";

const IDLE: TrackOrderState = { status: "idle" };
const NUMBER = "TZ-261120-0A1B2C3D";
const form = (orderNumber: string, contact: string) => {
  const data = new FormData();
  data.set("orderNumber", orderNumber);
  data.set("contact", contact);
  return data;
};
const order = (status: string) => ({ found: true, orderNumber: NUMBER, status, createdAt: "2026-11-20T08:00:00Z", totalMinor: 5600000, currency: "TZS", itemCount: 2 });

beforeEach(() => {
  enabled.value = true;
  throttle.open = true;
  throttle.asked = [];
  database.trackOrder.mockReset();
  database.getDeliveryCode.mockReset();
});

describe("track order", () => {
  it("answers with the order's status and never the delivery code, even while it is on its way", async () => {
    for (const status of ["dispatched", "in_transit"]) {
      database.trackOrder.mockResolvedValueOnce(order(status));
      const result = await trackOrderAction(IDLE, form(NUMBER, "0712 340 001"));
      expect(result).toMatchObject({ status: "found", order: { orderNumber: NUMBER, status }, codeInAccount: true });
      expect(JSON.stringify(result)).not.toMatch(/deliveryCode|"code"/);
    }
    // The rider is shown this number and this phone: neither may fetch the code.
    expect(database.getDeliveryCode).not.toHaveBeenCalled();

    database.trackOrder.mockResolvedValueOnce(order("confirmed"));
    expect(await trackOrderAction(IDLE, form(NUMBER, "neema@example.test"))).toMatchObject({ status: "found", codeInAccount: false });
  });

  it("gives the same answer for a wrong contact and an unknown order", async () => {
    database.trackOrder.mockResolvedValue({ found: false });
    expect(await trackOrderAction(IDLE, form(NUMBER, "+255700000000"))).toEqual({ status: "not_found" });
  });

  it("stops after too many tries for one order, without looking anything up", async () => {
    throttle.open = false;
    expect(await trackOrderAction(IDLE, form(NUMBER, "+255712340001"))).toEqual({ status: "rate_limited" });
    expect(database.trackOrder).not.toHaveBeenCalled();
    expect(throttle.asked).toEqual([["trackOrder", NUMBER]]);
  });

  it("validates before counting an attempt or asking the database", async () => {
    expect(await trackOrderAction(IDLE, form("nonsense", "x"))).toMatchObject({ status: "invalid" });
    expect(throttle.asked).toEqual([]);
    expect(database.trackOrder).not.toHaveBeenCalled();
    enabled.value = false;
    expect(await trackOrderAction(IDLE, form(NUMBER, "+255712340001"))).toEqual({ status: "unavailable" });
  });
});
