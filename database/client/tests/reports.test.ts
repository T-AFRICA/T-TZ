import { randomUUID } from "node:crypto";
import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  COUNTRY_ADMIN_API_PREFIX,
  createServiceTokenSigner,
  createServiceTokenVerifier,
  ordersReportSchema,
  productsReportSchema,
  salesReportSchema,
  stockReportSchema,
  type ServiceTokenSigner,
} from "@tronic/api-contracts";
import { ANON, withAccess } from "../src/db";
import { handleCountryAdminRequest, type CountryAdminResponse, type CountryAdminService } from "../src/country-admin";
import { placeCodOrder } from "../src/orders";
import { createShopper, createTestDatabase, type TestDatabase } from "../src/testing";

/**
 * Reports (migration 0019) through the country admin API, on a disposable
 * PGlite database with the SAMPLE catalogue: three orders today (one
 * delivered and paid, one cancelled, one open), a rider's deliveries and a
 * stock change. A sale is a paid order.
 */

let t: TestDatabase;
let signer: ServiceTokenSigner;
let service: CountryAdminService;
let today: string;

const MANAGER = "0b6f3a52-7c1e-4f0a-9a57-3d0a5d6b9e11";
const RIDER = "6a1d2c3b-4e5f-4a60-8b71-9c8d7e6f5a41";

async function send(method: "GET" | "POST", path: string, permission: string, body?: unknown): Promise<CountryAdminResponse> {
  const fullPath = `${COUNTRY_ADMIN_API_PREFIX}${path}`;
  const text = body === undefined ? "" : JSON.stringify(body);
  const token = await signer.sign({ countryCode: "TZ", actorId: MANAGER, permission, method, path: fullPath, body: text });
  return handleCountryAdminRequest(service, { method, path: fullPath, authorization: `Bearer ${token}`, body: text });
}

async function order(region: string, lines: { product: string; quantity: number }[]): Promise<string> {
  const placed = await placeCodOrder(t.db, await createShopper(t.db), {
    idempotencyKey: randomUUID(),
    country: "TZ",
    contact: { name: "Asha Mrema", email: "asha@example.test", phone: "+255712345678" },
    delivery: { method: "home", region, district: "Central", ward: "Ward", street: "Plot 1", extra: "", notes: "" },
    lines: lines.map((line) => ({ ...line, color: null, variant: null })),
    expectedTotalMinor: null,
  });
  if (!placed.ok) throw new Error(`order failed: ${placed.code}`);
  return placed.orderNumber;
}

const moveTo = (number: string, status: string) => send("POST", `/orders/${number}/status`, "orders.update", { status });
const report = async (name: string) => (await send("GET", `/reports/${name}?from=${today}&to=${today}`, "reports.read")).body;

beforeAll(async () => {
  t = await createTestDatabase();
  const keys = await generateKeyPair("ES256", { extractable: true });
  signer = await createServiceTokenSigner({ privateKeyPem: await exportPKCS8(keys.privateKey), keyId: "k1" });
  const verifier = await createServiceTokenVerifier({ countryCode: "TZ", publicKeysPem: { k1: await exportSPKI(keys.publicKey) } });
  service = { countryCode: "TZ", verifier, db: t.db };
  [{ today }] = (await t.db.query<{ today: string }>(`select to_char((now() at time zone 'Africa/Dar_es_Salaam')::date, 'YYYY-MM-DD') as today`)) as [{ today: string }];

  // Delivered and paid: 2 panels (TZS 28,000 each) + 1 plug (TZS 18,500), Dar es Salaam.
  const paid = await order("Dar es Salaam", [
    { product: "sample-led-panel", quantity: 2 },
    { product: "sample-top-plug", quantity: 1 },
  ]);
  for (const status of ["confirmed", "processing", "packed", "dispatched", "in_transit", "delivered"]) await moveTo(paid, status);
  // Cancelled: 1 panel, Arusha. Open: 3 plugs, Arusha.
  const cancelled = await order("Arusha", [{ product: "sample-led-panel", quantity: 1 }]);
  await moveTo(cancelled, "cancelled");
  await order("Arusha", [{ product: "sample-top-plug", quantity: 3 }]);

  // A rider's delivery (written as the owner): the paid order, delivered, with its cash.
  await t.db.query(
    `insert into deliveries (order_id, rider_id, rider_name, assigned_by, code, delivered_at, cash_collected_minor)
     select o.id, $2::uuid, 'Juma Rider', $3::uuid, '123456', now(), o.total_minor from orders o where o.order_number = $1`,
    [paid, RIDER, MANAGER],
  );
  // A stock change with a reason.
  await send("POST", "/inventory/sample-extension/adjust", "inventory.adjust", { mode: "remove", quantity: 2, reason: "damaged" });
}, 90_000);

afterAll(async () => {
  await t.pg.close();
});

describe("who may read reports", () => {
  it("only service_role runs the report functions; the API needs reports.read", async () => {
    for (const role of ["anon", "authenticated"]) {
      const callable = await t.db.query(
        `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and (p.proname like 'admin\\_report\\_%' or p.proname like 'report\\_%')
            and has_function_privilege($1, p.oid, 'execute')`,
        [role],
      );
      expect(callable, role).toEqual([]);
    }
    await expect(withAccess(t.db, ANON, (tx) => tx.query(`select admin_report_sales('TZ', current_date, current_date)`))).rejects.toThrow(/permission denied/);
    expect(await send("GET", `/reports/sales?from=${today}&to=${today}`, "orders.read")).toMatchObject({ status: 401, body: { code: "wrong_permission" } });
  });

  it("refuses a period that ends before it starts, is too long, or is not a date", async () => {
    expect((await send("GET", "/reports/sales?from=2026-11-20&to=2026-11-01", "reports.read")).status).toBe(400);
    expect((await send("GET", "/reports/sales?from=2025-01-01&to=2026-11-20", "reports.read")).status).toBe(400);
    expect((await send("GET", "/reports/sales?from=yesterday&to=2026-11-20", "reports.read")).status).toBe(400);
    expect((await send("GET", "/reports/sales", "reports.read")).status).toBe(400);
  });
});

describe("the four reports", () => {
  it("sales: placed, paid (the sale), cancelled and open, by day and by payment method", async () => {
    const sales = salesReportSchema.parse(await report("sales"));
    const paidMinor = 2 * 2_800_000 + 1_850_000;
    expect(sales.totals).toEqual({ placed: 3, paidOrders: 1, paidMinor, cancelled: 1, open: 1 });
    expect(sales.days).toEqual([{ day: today, placed: 3, paidOrders: 1, paidMinor, cancelled: 1 }]);
    expect(sales.byPayment).toEqual([{ method: "pay_on_delivery", paidOrders: 1, paidMinor }]);
    expect(sales).toMatchObject({ currency: "TZS", currencyExponent: 2 });
    // A week has a row per day, with zeros where nothing happened.
    const week = salesReportSchema.parse((await send("GET", `/reports/sales?from=${shift(today, -6)}&to=${today}`, "reports.read")).body);
    expect(week.days).toHaveLength(7);
    expect(week.days[0]).toMatchObject({ placed: 0, paidMinor: 0 });
  });

  it("top products and categories count paid orders only", async () => {
    const products = productsReportSchema.parse(await report("products"));
    expect(products.products.map((p) => [p.slug, p.units, p.amountMinor])).toEqual([
      ["sample-led-panel", 2, 5_600_000],
      ["sample-top-plug", 1, 1_850_000],
    ]);
    expect(products).toMatchObject({ units: 3, paidMinor: 7_450_000 });
    expect(products.categories.reduce((sum, c) => sum + c.amountMinor, 0)).toBe(7_450_000);
  });

  it("orders and delivery: by status, by region, and each rider's deliveries and cash", async () => {
    const orders = ordersReportSchema.parse(await report("orders"));
    expect(orders.placed).toBe(3);
    expect(orders.byStatus).toEqual({ delivered: 1, cancelled: 1, pending_payment: 1 });
    expect(orders.byRegion).toEqual([
      { region: "Arusha", orders: 2, paidMinor: 0 },
      { region: "Dar es Salaam", orders: 1, paidMinor: 7_450_000 },
    ]);
    expect(orders.riders).toEqual([{ riderId: RIDER, riderName: "Juma Rider", given: 1, delivered: 1, failedAttempts: 0, cashMinor: 7_450_000 }]);
    // No customer details in a report.
    expect(JSON.stringify(orders)).not.toMatch(/Asha|asha@|\+2557/);
  });

  it("stock: out, low, units and value now, and what moved in the period by reason", async () => {
    const stock = stockReportSchema.parse(await report("stock"));
    expect(stock.out).toBeGreaterThan(0);
    expect(stock.attention.every((a) => a.available <= a.lowStockAt)).toBe(true);
    expect(stock.valueMinor).toBeGreaterThan(0);
    const byReason = Object.fromEntries(stock.movements.map((m) => [m.reason, [m.unitsIn, m.unitsOut]]));
    // Orders took 2 + 1 + 1 + 3 units; the cancellation gave 1 back; 2 were damaged.
    expect(byReason).toEqual({ order: [0, 7], order_cancelled: [1, 0], damaged: [0, 2] });
  });
});

function shift(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
