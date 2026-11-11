import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ACTIVE_COUNTRY, COUNTRIES, formatMoney } from "@tronic/country-config";
import { ANON, withAccess, type Access } from "../src/db";
import { listCustomerOrders, placeCodOrder, trackOrder, type PlaceCodOrderInput } from "../src/orders";
import { createAuthUser, createTestDatabase, type TestDatabase } from "../src/testing";

/**
 * Cash on Delivery orders (migration 0004) on a disposable PGlite database.
 * Sample prices: LED panel TZS 28,000 (2,800,000 minor units), top plug
 * TZS 18,500; the armoured cable is out of stock. 25 units of each in-stock
 * product.
 */

let t: TestDatabase;
let alice: string;
let bob: string;

const PANEL = "sample-led-panel";
const PLUG = "sample-top-plug";
const EXTENSION = "sample-extension";
const CABLE = "sample-armoured-cable";

function order(overrides: Partial<PlaceCodOrderInput> = {}): PlaceCodOrderInput {
  return {
    idempotencyKey: randomUUID(),
    country: "TZ",
    contact: { name: "Asha Mrema", email: "asha@example.test", phone: "+255712345678" },
    delivery: { method: "home", region: "Dar es Salaam", district: "Kinondoni", ward: "Mikocheni", street: "Plot 12, Mwai Kibaki Rd", extra: "", notes: "" },
    lines: [
      { product: PANEL, color: null, variant: null, quantity: 2 },
      { product: PLUG, color: null, variant: null, quantity: 1 },
    ],
    expectedTotalMinor: 2 * 2_800_000 + 1_850_000,
    ...overrides,
  };
}

async function stock(slug: string): Promise<number> {
  const [row] = await t.db.query<{ available: number }>(
    `select s.available from stock_levels s join products p on p.id = s.product_id where p.slug = $1 and s.country_code = 'TZ'`,
    [slug],
  );
  return row!.available;
}

async function orderCount(): Promise<number> {
  const [row] = await t.db.query<{ n: number }>(`select count(*)::int as n from orders`);
  return row!.n;
}

beforeAll(async () => {
  t = await createTestDatabase();
  alice = await createAuthUser(t.db, "alice@example.test");
  bob = await createAuthUser(t.db, "bob@example.test");
  await t.db.query(`create table stock_snapshot as select product_id, country_code, available from stock_levels`);
}, 60_000);

afterAll(async () => {
  await t.pg.close();
});

beforeEach(async () => {
  await t.db.query(`delete from orders`);
  await t.db.query(
    `update stock_levels s set available = snap.available
       from stock_snapshot snap where snap.product_id = s.product_id and snap.country_code = s.country_code`,
  );
  await t.db.query(
    `update product_country_prices set price_minor = 2800000
      where product_id = (select id from products where slug = $1)`,
    [PANEL],
  );
});

describe("placing a Cash on Delivery order", () => {
  it("guest checkout: reprices from the catalogue, saves the order and reserves stock in one go", async () => {
    const result = await placeCodOrder(t.db, ANON, order());
    expect(result).toMatchObject({ ok: true, replayed: false, currency: "TZS", itemCount: 3 });
    if (!result.ok) return;
    // 2 × TZS 28,000 + TZS 18,500 = TZS 74,500, stored as 7,450,000 minor units.
    expect(result.totalMinor).toBe(7_450_000);
    expect(formatMoney(result.totalMinor, ACTIVE_COUNTRY)).toBe("TZS 74,500");
    expect(result.orderNumber).toMatch(/^TZ-\d{6}-[0-9A-F]{8}$/);

    const [saved] = await t.db.query<{ user_id: string | null; status: string; payment_status: string; total_minor: unknown }>(
      `select user_id, status, payment_status, total_minor from orders where order_number = $1`,
      [result.orderNumber],
    );
    expect(saved).toMatchObject({ user_id: null, status: "pending_payment", payment_status: "pending" });
    expect(Number(saved!.total_minor)).toBe(7_450_000);
    const lines = await t.db.query<{ product_slug: string; unit_price_minor: unknown; line_total_minor: unknown }>(
      `select product_slug, unit_price_minor, line_total_minor from order_lines l join orders o on o.id = l.order_id
        where o.order_number = $1 order by line_no`,
      [result.orderNumber],
    );
    expect(lines.map((l) => [l.product_slug, Number(l.unit_price_minor), Number(l.line_total_minor)])).toEqual([
      [PANEL, 2_800_000, 5_600_000],
      [PLUG, 1_850_000, 1_850_000],
    ]);
    expect(await stock(PANEL)).toBe(23);
    expect(await stock(PLUG)).toBe(24);
  });

  it("ignores any price the request might carry: only catalogue prices count", async () => {
    const request = order();
    const tampered = {
      ...request,
      lines: request.lines.map((line) => ({ ...line, unitPriceMinor: 1, price: 1 })),
    } as PlaceCodOrderInput;
    const result = await placeCodOrder(t.db, ANON, tampered);
    expect(result).toMatchObject({ ok: true, totalMinor: 7_450_000 });
  });

  it("a signed-in customer's order is linked to them by the session, not by the request", async () => {
    const result = await placeCodOrder(t.db, { role: "authenticated", userId: alice }, order());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [saved] = await t.db.query<{ user_id: string }>(`select user_id from orders where order_number = $1`, [result.orderNumber]);
    expect(saved!.user_id).toBe(alice);
  });
});

describe("duplicate submissions", () => {
  it("the same idempotency key returns the same order and writes it once", async () => {
    const request = order();
    const first = await placeCodOrder(t.db, ANON, request);
    const second = await placeCodOrder(t.db, ANON, request);
    const third = await placeCodOrder(t.db, ANON, request);
    expect(first.ok && second.ok && third.ok).toBe(true);
    if (!first.ok || !second.ok || !third.ok) return;
    expect(second).toMatchObject({ replayed: true, orderNumber: first.orderNumber, totalMinor: first.totalMinor });
    expect(third.orderNumber).toBe(first.orderNumber);
    expect(await orderCount()).toBe(1);
    expect(await stock(PANEL)).toBe(23);
  });

  it("concurrent retries with one key still create one order", async () => {
    const request = order();
    const results = await Promise.all([1, 2, 3, 4].map(() => placeCodOrder(t.db, ANON, request)));
    const numbers = new Set(results.map((r) => (r.ok ? r.orderNumber : r.code)));
    expect(numbers.size).toBe(1);
    expect(await orderCount()).toBe(1);
    expect(await stock(PANEL)).toBe(23);
  });

  it("the same key with a different request is refused", async () => {
    const request = order();
    await placeCodOrder(t.db, ANON, request);
    const changed = await placeCodOrder(t.db, ANON, { ...request, lines: [{ product: PLUG, color: null, variant: null, quantity: 5 }], expectedTotalMinor: null });
    expect(changed).toEqual({ ok: false, code: "idempotency_conflict" });
    const otherUser = await placeCodOrder(t.db, { role: "authenticated", userId: bob }, request);
    expect(otherUser).toEqual({ ok: false, code: "idempotency_conflict" });
    expect(await orderCount()).toBe(1);
  });
});

describe("price changes", () => {
  it("refuses the order when the price moved since the customer saw the total, and writes nothing", async () => {
    await t.db.query(
      `update product_country_prices set price_minor = 3000000 where product_id = (select id from products where slug = $1)`,
      [PANEL],
    );
    const result = await placeCodOrder(t.db, ANON, order());
    expect(result).toEqual({ ok: false, code: "price_changed", totalMinor: 2 * 3_000_000 + 1_850_000, currency: "TZS" });
    expect(await orderCount()).toBe(0);
    expect(await stock(PANEL)).toBe(25);

    // Confirming the new total goes through at the new price.
    const confirmed = await placeCodOrder(t.db, ANON, order({ expectedTotalMinor: 7_850_000 }));
    expect(confirmed).toMatchObject({ ok: true, totalMinor: 7_850_000 });
  });
});

describe("stock", () => {
  it("refuses out-of-stock and over-quantity lines without writing anything", async () => {
    const result = await placeCodOrder(
      t.db,
      ANON,
      order({
        lines: [
          { product: CABLE, color: null, variant: null, quantity: 1 },
          { product: PANEL, color: null, variant: null, quantity: 30 },
        ],
        expectedTotalMinor: null,
      }),
    );
    expect(result).toEqual({
      ok: false,
      code: "lines_unavailable",
      problems: [
        { product: CABLE, issue: "out_of_stock", available: 0 },
        { product: PANEL, issue: "out_of_stock", available: 25 },
      ],
    });
    expect(await orderCount()).toBe(0);
    expect(await stock(PANEL)).toBe(25);
  });

  it("selling the last units marks the product out of stock for the storefront", async () => {
    await t.db.query(`update stock_levels set available = 2 where product_id = (select id from products where slug = $1)`, [PANEL]);
    const result = await placeCodOrder(t.db, ANON, order({ lines: [{ product: PANEL, color: null, variant: null, quantity: 2 }], expectedTotalMinor: 5_600_000 }));
    expect(result.ok).toBe(true);
    const [row] = await withAccess(t.db, ANON, (tx) =>
      tx.query<{ in_stock: boolean }>(`select in_stock from storefront_products where slug = $1 and country_code = 'TZ'`, [PANEL]),
    );
    expect(row!.in_stock).toBe(false);
    const again = await placeCodOrder(t.db, ANON, order({ lines: [{ product: PANEL, color: null, variant: null, quantity: 1 }], expectedTotalMinor: null }));
    expect(again).toMatchObject({ ok: false, code: "lines_unavailable" });
  });

  it("checks product options and unknown products", async () => {
    const result = await placeCodOrder(
      t.db,
      ANON,
      order({
        lines: [
          { product: EXTENSION, color: "Purple", variant: "4-way", quantity: 1 },
          { product: "no-such-product", color: null, variant: null, quantity: 1 },
        ],
        expectedTotalMinor: null,
      }),
    );
    expect(result).toEqual({
      ok: false,
      code: "lines_unavailable",
      problems: [
        { product: EXTENSION, issue: "invalid_options" },
        { product: "no-such-product", issue: "unavailable" },
      ],
    });
    const valid = await placeCodOrder(
      t.db,
      ANON,
      order({ lines: [{ product: EXTENSION, color: "White", variant: "4-way", quantity: 1 }], expectedTotalMinor: 2_200_000 }),
    );
    expect(valid).toMatchObject({ ok: true, totalMinor: 2_200_000 });
  });
});

describe("request validation", () => {
  it("refuses malformed requests, other payment-free shortcuts and inactive countries", async () => {
    const bad: Partial<PlaceCodOrderInput>[] = [
      { lines: [] },
      { lines: [{ product: PANEL, color: null, variant: null, quantity: 0 }] },
      { lines: [{ product: PANEL, color: null, variant: null, quantity: 100 }] },
      { lines: [{ product: PANEL, color: null, variant: null, quantity: 1.5 }] },
      {
        lines: [
          { product: PANEL, color: null, variant: null, quantity: 1 },
          { product: PANEL, color: null, variant: null, quantity: 1 },
        ],
      },
      { contact: { name: "A", email: "asha@example.test", phone: "+255712345678" } },
      { contact: { name: "Asha", email: "not-an-email", phone: "+255712345678" } },
      { contact: { name: "Asha", email: "asha@example.test", phone: "0712 345 678" } },
      { delivery: { method: "pickup" as "home", region: "", district: "", ward: "", street: "", extra: "", notes: "" } },
      { country: "UG" },
      { expectedTotalMinor: -1 },
    ];
    for (const overrides of bad) {
      const result = await placeCodOrder(t.db, ANON, order(overrides));
      expect(result, JSON.stringify(overrides)).toEqual({ ok: false, code: "invalid_request" });
    }
    expect(await orderCount()).toBe(0);
  });
});

describe("reading orders", () => {
  it("a customer sees only their own orders; another customer and anon see none of them", async () => {
    const a = await placeCodOrder(t.db, { role: "authenticated", userId: alice }, order());
    const b = await placeCodOrder(t.db, { role: "authenticated", userId: bob }, order({ contact: { name: "Baraka", email: "baraka@example.test", phone: "+255765432109" } }));
    await placeCodOrder(t.db, ANON, order());
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;

    const aliceAccess: Access = { role: "authenticated", userId: alice };
    const aliceOrders = await listCustomerOrders(t.db, { role: "authenticated", userId: alice });
    expect(aliceOrders.map((o) => o.orderNumber)).toEqual([a.orderNumber]);
    const bobOrders = await listCustomerOrders(t.db, { role: "authenticated", userId: bob });
    expect(bobOrders.map((o) => o.orderNumber)).toEqual([b.orderNumber]);

    // Alice asking for Bob's order directly gets nothing back.
    const peek = await withAccess(t.db, aliceAccess, (tx) =>
      tx.query(`select * from orders where order_number = $1`, [b.orderNumber]),
    );
    expect(peek).toEqual([]);
    const peekLines = await withAccess(t.db, aliceAccess, (tx) =>
      tx.query(`select * from order_lines l join orders o on o.id = l.order_id where o.order_number = $1`, [b.orderNumber]),
    );
    expect(peekLines).toEqual([]);
    // Nobody can change an order through the API roles.
    await expect(
      withAccess(t.db, aliceAccess, (tx) => tx.query(`update orders set status = 'delivered' where order_number = $1`, [a.orderNumber])),
    ).rejects.toThrow(/permission denied/);
  });

  it("guest tracking needs the order number and the checkout email or phone", async () => {
    const placed = await placeCodOrder(t.db, ANON, order());
    if (!placed.ok) throw new Error("order failed");
    expect(await trackOrder(t.db, placed.orderNumber, "asha@example.test")).toMatchObject({
      found: true,
      status: "pending_payment",
      totalMinor: 7_450_000,
      itemCount: 3,
    });
    expect(await trackOrder(t.db, placed.orderNumber.toLowerCase(), "+255712345678")).toMatchObject({ found: true });
    expect(await trackOrder(t.db, placed.orderNumber, "someone@example.test")).toEqual({ found: false });
    expect(await trackOrder(t.db, "TZ-000000-00000000", "asha@example.test")).toEqual({ found: false });
  });
});

describe("currency scaling across countries", () => {
  it("a KES order stores Kenyan shillings ×100 and displays them whole", async () => {
    await t.db.query(`update countries set active = true where code = 'KE'`);
    try {
      await t.db.query(
        `insert into product_country_prices (product_id, country_code, currency, price_minor, in_stock, active)
         select id, 'KE', 'KES', 150000, false, true from products where slug = $1`,
        [PLUG],
      );
      await t.db.query(`insert into stock_levels (product_id, country_code, available) select id, 'KE', 10 from products where slug = $1`, [PLUG]);
      const result = await placeCodOrder(
        t.db,
        ANON,
        order({
          country: "KE",
          lines: [{ product: PLUG, color: null, variant: null, quantity: 3 }],
          expectedTotalMinor: 450_000,
          contact: { name: "Wanjiru", email: "wanjiru@example.test", phone: "+254712345678" },
        }),
      );
      expect(result).toMatchObject({ ok: true, currency: "KES", totalMinor: 450_000 });
      const kenya = COUNTRIES.find((c) => c.code === "KE")!;
      expect(formatMoney(450_000, kenya)).toBe("KES 4,500");
    } finally {
      await t.db.query(`delete from orders where country_code = 'KE'`);
      await t.db.query(`delete from stock_levels where country_code = 'KE'`);
      await t.db.query(`delete from product_country_prices where country_code = 'KE'`);
      await t.db.query(`update countries set active = false where code = 'KE'`);
    }
  });
});
