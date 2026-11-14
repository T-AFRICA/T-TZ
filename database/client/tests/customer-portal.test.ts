import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  countCustomerOrdersByStatus,
  getCustomerOrder,
  listCustomerOrderPage,
  placeCodOrder,
  type PlaceCodOrderInput,
} from "../src/orders";
import { createAuthUser, createTestDatabase, type TestDatabase } from "../src/testing";

/**
 * Customer portal reads on a disposable PGlite database: the order list
 * (filter, search, sort, paging), one order with its lines, and the counts.
 * Alice has three orders, Bob one; every read runs as the signed-in
 * customer, so Row Level Security decides what comes back.
 */
let t: TestDatabase;
let alice: { role: "authenticated"; userId: string };
let bob: { role: "authenticated"; userId: string };
const aliceOrders: string[] = [];
let bobOrder = "";

function order(overrides: Partial<PlaceCodOrderInput> = {}): PlaceCodOrderInput {
  return {
    idempotencyKey: randomUUID(),
    country: "TZ",
    contact: { name: "Asha Mrema", email: "asha@example.test", phone: "+255712345678" },
    delivery: { method: "home", region: "Dar es Salaam", district: "Kinondoni", ward: "Mikocheni", street: "Plot 12, Mwai Kibaki Rd", extra: "", notes: "Call on arrival" },
    lines: [
      { product: "sample-led-panel", color: null, variant: null, quantity: 2 },
      { product: "sample-top-plug", color: null, variant: null, quantity: 1 },
    ],
    expectedTotalMinor: null,
    ...overrides,
  };
}

async function place(access: typeof alice, overrides: Partial<PlaceCodOrderInput> = {}): Promise<string> {
  const result = await placeCodOrder(t.db, access, order(overrides));
  if (!result.ok) throw new Error(`order failed: ${result.code}`);
  return result.orderNumber;
}

beforeAll(async () => {
  t = await createTestDatabase();
  alice = { role: "authenticated", userId: await createAuthUser(t.db, "alice@example.test") };
  bob = { role: "authenticated", userId: await createAuthUser(t.db, "bob@example.test") };
  for (let i = 0; i < 3; i += 1) aliceOrders.push(await place(alice));
  bobOrder = await place(bob, { contact: { name: "Baraka", email: "baraka@example.test", phone: "+255765432109" } });
  // Distinct dates and statuses (set as the database owner, as fulfilment would).
  await t.db.query(`update orders set created_at = '2026-10-01T08:00:00Z', status = 'delivered', payment_status = 'paid' where order_number = $1`, [aliceOrders[0]]);
  await t.db.query(`update orders set created_at = '2026-10-15T08:00:00Z', status = 'dispatched' where order_number = $1`, [aliceOrders[1]]);
  await t.db.query(`update orders set created_at = '2026-11-01T08:00:00Z' where order_number = $1`, [aliceOrders[2]]);
}, 60_000);

afterAll(async () => {
  await t.pg.close();
});

describe("customer order list", () => {
  it("returns the customer's own orders, newest first, with their lines", async () => {
    const page = await listCustomerOrderPage(t.db, alice);
    expect(page.total).toBe(3);
    expect(page.items.map((o) => o.orderNumber)).toEqual([aliceOrders[2], aliceOrders[1], aliceOrders[0]]);
    const first = page.items[0]!;
    expect(first.itemCount).toBe(3);
    expect(first.lines).toEqual([
      { productSlug: "sample-led-panel", sku: "SAMPLE-LED-PANEL", name: "24W LED Panel Light", quantity: 2 },
      { productSlug: "sample-top-plug", sku: "SAMPLE-TOP-PLUG", name: "13A Top Plug", quantity: 1 },
    ]);
    expect(first.paymentMethod).toBe("pay_on_delivery");
    expect(first.totalMinor).toBe(2 * 2_800_000 + 1_850_000);
  });

  it("filters by status, order number and date, and sorts oldest first", async () => {
    const delivered = await listCustomerOrderPage(t.db, alice, { statuses: ["delivered"] });
    expect(delivered.items.map((o) => o.orderNumber)).toEqual([aliceOrders[0]]);

    const several = await listCustomerOrderPage(t.db, alice, { statuses: ["delivered", "dispatched"], sort: "oldest" });
    expect(several.items.map((o) => o.orderNumber)).toEqual([aliceOrders[0], aliceOrders[1]]);

    const tail = aliceOrders[1]!.slice(-6).toLowerCase();
    const searched = await listCustomerOrderPage(t.db, alice, { search: tail });
    expect(searched.items.map((o) => o.orderNumber)).toEqual([aliceOrders[1]]);

    const october = await listCustomerOrderPage(t.db, alice, { from: "2026-10-01T00:00:00Z", to: "2026-11-01T00:00:00Z" });
    expect(october.total).toBe(2);

    // An unknown status is ignored rather than trusted.
    const unknown = await listCustomerOrderPage(t.db, alice, { statuses: ["delivered' or '1'='1"] });
    expect(unknown.total).toBe(3);
  });

  it("pages in the database and clamps the page number", async () => {
    const first = await listCustomerOrderPage(t.db, alice, { pageSize: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.pageCount).toBe(2);
    const last = await listCustomerOrderPage(t.db, alice, { pageSize: 2, page: 99 });
    expect(last.page).toBe(2);
    expect(last.items.map((o) => o.orderNumber)).toEqual([aliceOrders[0]]);
  });

  it("never returns another customer's order, even when searching for its number", async () => {
    const page = await listCustomerOrderPage(t.db, alice, { search: bobOrder });
    expect(page.total).toBe(0);
    expect((await listCustomerOrderPage(t.db, bob)).items.map((o) => o.orderNumber)).toEqual([bobOrder]);
  });

  it("counts the customer's own orders by status", async () => {
    expect(await countCustomerOrdersByStatus(t.db, alice)).toEqual({ delivered: 1, dispatched: 1, pending_payment: 1 });
    expect(await countCustomerOrdersByStatus(t.db, bob)).toEqual({ pending_payment: 1 });
  });
});

describe("one customer order", () => {
  it("returns the order with its lines, contact, address and totals", async () => {
    const detail = await getCustomerOrder(t.db, alice, aliceOrders[0]!.toLowerCase());
    expect(detail).not.toBeNull();
    if (!detail) return;
    expect(detail.orderNumber).toBe(aliceOrders[0]);
    expect(detail.status).toBe("delivered");
    expect(detail.paymentStatus).toBe("paid");
    expect(detail.contact).toEqual({ name: "Asha Mrema", email: "asha@example.test", phone: "+255712345678" });
    expect(detail.delivery).toMatchObject({ region: "Dar es Salaam", district: "Kinondoni", ward: "Mikocheni", extra: null, notes: "Call on arrival" });
    expect(detail.detailLines).toHaveLength(2);
    expect(detail.detailLines[0]).toMatchObject({ lineNo: 1, sku: "SAMPLE-LED-PANEL", quantity: 2, unitPriceMinor: 2_800_000, lineTotalMinor: 5_600_000 });
    expect(detail.subtotalMinor).toBe(detail.detailLines.reduce((sum, line) => sum + line.lineTotalMinor, 0));
    expect(detail.deliveryFeeMinor).toBeNull();
  });

  it("gives the same answer for another customer's order and an unknown number", async () => {
    expect(await getCustomerOrder(t.db, alice, bobOrder)).toBeNull();
    expect(await getCustomerOrder(t.db, alice, "TZ-000000-00000000")).toBeNull();
    expect(await getCustomerOrder(t.db, alice, "x")).toBeNull();
    expect((await getCustomerOrder(t.db, bob, bobOrder))?.orderNumber).toBe(bobOrder);
  });
});
