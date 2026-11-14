import { describe, expect, it } from "vitest";
import { buildTracking, type TrackableOrder } from "./tracking";

const base: TrackableOrder = {
  status: "pending_payment",
  paymentStatus: "pending",
  paymentMethod: "pay_on_delivery",
  deliveryMethod: "home",
  createdAt: "2026-11-01T08:00:00.000Z",
};

const states = (order: TrackableOrder) => buildTracking(order).steps.map((step) => `${step.key}:${step.state}`);

describe("buildTracking", () => {
  it("a new order is at 'Order placed' and nothing later is marked done", () => {
    const tracking = buildTracking(base);
    expect(tracking.currentTitle).toBe("Order placed");
    expect(tracking.steps[0]?.state).toBe("current");
    expect(tracking.steps.slice(1).every((step) => step.state === "upcoming")).toBe(true);
    expect(tracking.finished).toBe(false);
  });

  it("marks earlier steps completed and the status step current", () => {
    expect(states({ ...base, status: "dispatched" })).toEqual([
      "placed:completed",
      "confirmed:completed",
      "processing:completed",
      "packed:completed",
      "dispatched:current",
      "in_transit:upcoming",
      "delivered:upcoming",
    ]);
  });

  it("a delivered order has every step completed", () => {
    const tracking = buildTracking({ ...base, status: "delivered", paymentStatus: "paid" });
    expect(tracking.steps.every((step) => step.state === "completed")).toBe(true);
    expect(tracking.finished).toBe(true);
    expect(tracking.currentTitle).toBe("Delivered");
  });

  it("only the order date is a timestamp; later steps never get an invented time", () => {
    const tracking = buildTracking({ ...base, status: "delivered" });
    expect(tracking.steps[0]?.at).toBe(base.createdAt);
    expect(tracking.steps.slice(1).every((step) => step.at === null)).toBe(true);
  });

  it("pickup orders have no dispatch or transit steps", () => {
    const tracking = buildTracking({ ...base, deliveryMethod: "pickup", status: "packed" });
    expect(tracking.steps.map((step) => step.key)).toEqual(["placed", "confirmed", "processing", "ready", "collected"]);
    expect(tracking.currentTitle).toBe("Ready for pickup");
  });

  it("a cancelled order is an exception, not a completed journey", () => {
    const tracking = buildTracking({ ...base, status: "cancelled" });
    expect(tracking.currentTitle).toBe("Cancelled");
    expect(tracking.exceptions.map((item) => item.key)).toEqual(["cancelled"]);
    expect(tracking.steps[0]?.state).toBe("completed");
    expect(tracking.steps.slice(1).every((step) => step.state === "upcoming")).toBe(true);
    expect(tracking.finished).toBe(false);
  });

  it("payment problems are exceptions beside the timeline", () => {
    expect(buildTracking({ ...base, paymentStatus: "failed" }).exceptions.map((item) => item.key)).toEqual(["payment_failed"]);
    expect(buildTracking({ ...base, status: "delivered", paymentStatus: "refunded" }).exceptions.map((item) => item.key)).toEqual(["refunded"]);
  });

  it("an unknown status shows only that the order was placed", () => {
    const tracking = buildTracking({ ...base, status: "something_new" });
    expect(tracking.steps[0]?.state).toBe("completed");
    expect(tracking.steps.slice(1).every((step) => step.state === "upcoming")).toBe(true);
  });
});
