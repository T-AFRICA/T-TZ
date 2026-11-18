import { randomUUID } from "node:crypto";
import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  COUNTRY_ADMIN_API_PREFIX,
  createServiceTokenSigner,
  createServiceTokenVerifier,
  orderDetailResponseSchema,
  orderListResponseSchema,
  orderStatusChangeResponseSchema,
  type ServiceTokenSigner,
} from "@tronic/api-contracts";
import { ANON, withAccess } from "../src/db";
import { handleCountryAdminRequest, type CountryAdminResponse, type CountryAdminService } from "../src/country-admin";
import { listCustomerOrders, placeCodOrder, trackOrder } from "../src/orders";
import { createAuthUser, createTestDatabase, type TestDatabase } from "../src/testing";

/**
 * Order administration (migration 0006) and the country side of the country
 * admin API, on a disposable PGlite database. Requests are signed with a key
 * pair made up for this run and go through handleCountryAdminRequest, the
 * same function the storefront serves, so the token checks, the input
 * checks and the database rules are tested together.
 */

let t: TestDatabase;
let signer: ServiceTokenSigner;
let service: CountryAdminService;
let customer: string;

const ADMIN = "0b6f3a52-7c1e-4f0a-9a57-3d0a5d6b9e11";
const PANEL = "sample-led-panel";
const PLUG = "sample-top-plug";

async function failure(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

async function stock(slug: string): Promise<number> {
  const [row] = await t.db.query<{ available: number }>(
    `select s.available from stock_levels s join products p on p.id = s.product_id where p.slug = $1 and s.country_code = 'TZ'`,
    [slug],
  );
  return row!.available;
}

async function placeOrder(name: string, email: string, access: Parameters<typeof placeCodOrder>[1] = ANON): Promise<string> {
  const result = await placeCodOrder(t.db, access, {
    idempotencyKey: randomUUID(),
    country: "TZ",
    contact: { name, email, phone: "+255712345678" },
    delivery: { method: "home", region: "Dar es Salaam", district: "Kinondoni", ward: "Mikocheni", street: "Plot 12, Mwai Kibaki Rd", extra: "", notes: "" },
    lines: [
      { product: PANEL, color: null, variant: null, quantity: 2 },
      { product: PLUG, color: null, variant: null, quantity: 1 },
    ],
    expectedTotalMinor: null,
  });
  if (!result.ok) throw new Error(`could not place the test order: ${result.code}`);
  return result.orderNumber;
}

/** Sends a signed request the way the Central Admin does. `as` overrides what the token says. */
async function send(
  method: "GET" | "POST",
  path: string,
  permission: string,
  body?: unknown,
  as: { countryCode?: string; actorId?: string; signedBody?: string; token?: string } = {},
): Promise<CountryAdminResponse & { token: string }> {
  const fullPath = `${COUNTRY_ADMIN_API_PREFIX}${path}`;
  const text = body === undefined ? "" : JSON.stringify(body);
  const token =
    as.token ??
    (await signer.sign({ countryCode: as.countryCode ?? "TZ", actorId: as.actorId ?? ADMIN, permission, method, path: fullPath, body: as.signedBody ?? text }));
  const response = await handleCountryAdminRequest(service, { method, path: fullPath, authorization: `Bearer ${token}`, body: text });
  return { ...response, token };
}

const moveTo = (orderNumber: string, status: string, note?: string) =>
  send("POST", `/orders/${orderNumber}/status`, "orders.update", { status, ...(note ? { note } : {}) });

beforeAll(async () => {
  t = await createTestDatabase();
  customer = await createAuthUser(t.db, "customer@example.test");
  const keys = await generateKeyPair("ES256", { extractable: true });
  signer = await createServiceTokenSigner({ privateKeyPem: await exportPKCS8(keys.privateKey), keyId: "k1" });
  const verifier = await createServiceTokenVerifier({ countryCode: "TZ", publicKeysPem: { k1: await exportSPKI(keys.publicKey) } });
  service = { countryCode: "TZ", verifier, db: t.db };
}, 60_000);

afterAll(async () => {
  await t.pg.close();
});

describe("who may use the order administration", () => {
  it("is nobody among customers and visitors: no table, no function", async () => {
    for (const role of ["anon", "authenticated"]) {
      const tables = await t.db.query<{ name: string }>(
        `select c.relname as name from pg_class c where c.relname in ('order_status_events', 'order_notes')
            and (has_table_privilege($1, c.oid, 'select') or has_table_privilege($1, c.oid, 'insert'))`,
        [role],
      );
      expect(tables, role).toEqual([]);
      const functions = await t.db.query<{ name: string }>(
        `select p.proname as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and (p.proname like 'admin\\_%' or p.proname = 'order_next_statuses')
            and has_function_privilege($1, p.oid, 'execute')`,
        [role],
      );
      expect(functions, role).toEqual([]);
    }
    const number = await placeOrder("Asha Mrema", "asha@example.test");
    expect(await failure(() => withAccess(t.db, ANON, (tx) => tx.query(`select admin_get_order('TZ', $1)`, [number])))).toMatch(/permission denied/);
    expect(
      await failure(() =>
        withAccess(t.db, { role: "authenticated", userId: customer }, (tx) =>
          tx.query(`select admin_update_order_status('TZ', $1, 'confirmed', null, $2::uuid, gen_random_uuid())`, [number, customer]),
        ),
      ),
    ).toMatch(/permission denied/);
  });

  it("refuses a request without a token, for another country, with another permission, or changed after signing", async () => {
    const number = await placeOrder("Asha Mrema", "asha@example.test");
    const path = `${COUNTRY_ADMIN_API_PREFIX}/orders/${number}`;
    expect(await handleCountryAdminRequest(service, { method: "GET", path, authorization: null, body: "" })).toEqual({
      status: 401,
      body: { ok: false, code: "missing_token" },
    });
    // Signed for Kenya: Tanzania does not answer it, whatever the path says.
    expect(await send("GET", `/orders/${number}`, "orders.read", undefined, { countryCode: "KE" })).toMatchObject({ status: 401, body: { code: "wrong_country" } });
    expect(await send("GET", `/orders/${number}?country=KE`, "orders.read", undefined, { countryCode: "KE" })).toMatchObject({ status: 401 });
    // A token for reading orders cannot change one, and one for settings cannot read orders.
    expect(await send("POST", `/orders/${number}/status`, "orders.read", { status: "confirmed" })).toMatchObject({ status: 401, body: { code: "wrong_permission" } });
    expect(await send("GET", `/orders/${number}`, "settings.read")).toMatchObject({ status: 401, body: { code: "wrong_permission" } });
    // The body was signed as "confirmed" and arrives as "cancelled".
    expect(
      await send("POST", `/orders/${number}/status`, "orders.update", { status: "cancelled" }, { signedBody: JSON.stringify({ status: "confirmed" }) }),
    ).toMatchObject({ status: 401, body: { code: "wrong_request" } });
    const [row] = await t.db.query<{ status: string }>(`select status from orders where order_number = $1`, [number]);
    expect(row!.status).toBe("pending_payment");
  });

  it("answers 404 for an address that is not part of the API", async () => {
    expect(await send("GET", "/customers", "customers.read")).toMatchObject({ status: 404 });
    expect(await send("POST", "/orders", "orders.update", {})).toMatchObject({ status: 404 });
  });
});

describe("reading orders", () => {
  it("lists the country's orders, newest first, with counts, a status filter and a search", async () => {
    await t.db.query(`delete from orders`);
    const first = await placeOrder("Asha Mrema", "asha@example.test");
    const second = await placeOrder("Baraka Juma", "baraka@example.test", { role: "authenticated", userId: customer });
    await moveTo(second, "confirmed");

    const all = orderListResponseSchema.parse((await send("GET", "/orders", "orders.read")).body);
    expect(all.total).toBe(2);
    expect(all.orders.map((order) => order.orderNumber)).toEqual([second, first]);
    expect(all.counts).toEqual({ pending_payment: 1, confirmed: 1 });
    expect(all.orders[1]).toMatchObject({ contactName: "Asha Mrema", status: "pending_payment", itemCount: 3, currency: "TZS", currencyExponent: 2 });
    // TZS 28,000 x 2 + TZS 18,500, in minor units.
    expect(all.orders[1]!.totalMinor).toBe(2 * 2_800_000 + 1_850_000);

    const confirmed = orderListResponseSchema.parse((await send("GET", "/orders?status=confirmed", "orders.read")).body);
    expect(confirmed.orders.map((order) => order.orderNumber)).toEqual([second]);
    expect(confirmed.counts).toEqual(all.counts);

    for (const q of ["baraka", "baraka@example.test", second.toLowerCase()]) {
      const found = orderListResponseSchema.parse((await send("GET", `/orders?q=${encodeURIComponent(q)}`, "orders.read")).body);
      expect(found.orders.map((order) => order.orderNumber), q).toEqual([second]);
    }
    // Search text is matched as typed: a wildcard is not a wildcard.
    expect(orderListResponseSchema.parse((await send("GET", "/orders?q=%25", "orders.read")).body).total).toBe(0);
    expect((await send("GET", "/orders?status=shipped", "orders.read")).status).toBe(400);
    expect((await send("GET", "/orders?page=0", "orders.read")).status).toBe(400);
  });

  it("gives an order in full, and says not found for an unknown number or one of another country", async () => {
    const number = await placeOrder("Asha Mrema", "asha@example.test");
    const detail = orderDetailResponseSchema.parse((await send("GET", `/orders/${number}`, "orders.read")).body);
    expect(detail).toMatchObject({
      ok: true,
      order: {
        orderNumber: number,
        status: "pending_payment",
        paymentStatus: "pending",
        paymentMethod: "pay_on_delivery",
        registeredCustomer: false,
        contact: { name: "Asha Mrema", email: "asha@example.test", phone: "+255712345678" },
        delivery: { method: "home", region: "Dar es Salaam", street: "Plot 12, Mwai Kibaki Rd" },
        nextStatuses: ["confirmed", "cancelled"],
        events: [],
        notes: [],
      },
    });
    if (detail.ok) {
      expect(detail.order.lines.map((line) => [line.quantity, line.lineTotalMinor])).toEqual([
        [2, 5_600_000],
        [1, 1_850_000],
      ]);
    }
    expect((await send("GET", "/orders/TZ-000000-ABCDEF12", "orders.read")).body).toEqual({ ok: false, code: "not_found" });
    expect((await send("GET", "/orders/not-a-number", "orders.read")).body).toEqual({ ok: false, code: "not_found" });

    // The same order, asked of a deployment that serves Kenya: it is not Kenya's.
    const keys = await generateKeyPair("ES256", { extractable: true });
    const kenyaSigner = await createServiceTokenSigner({ privateKeyPem: await exportPKCS8(keys.privateKey), keyId: "k1" });
    const kenya: CountryAdminService = {
      countryCode: "KE",
      verifier: await createServiceTokenVerifier({ countryCode: "KE", publicKeysPem: { k1: await exportSPKI(keys.publicKey) } }),
      db: t.db,
    };
    const path = `${COUNTRY_ADMIN_API_PREFIX}/orders/${number}`;
    const token = await kenyaSigner.sign({ countryCode: "KE", actorId: ADMIN, permission: "orders.read", method: "GET", path, body: "" });
    expect((await handleCountryAdminRequest(kenya, { method: "GET", path, authorization: `Bearer ${token}`, body: "" })).body).toEqual({ ok: false, code: "not_found" });
  });
});

describe("changing an order's status", () => {
  it("moves one step at a time to delivered, records each step, and marks Cash on Delivery as paid at the end", async () => {
    const number = await placeOrder("Baraka Juma", "baraka@example.test", { role: "authenticated", userId: customer });
    // Skipping ahead is refused, with where the order is and where it may go.
    expect(orderStatusChangeResponseSchema.parse((await moveTo(number, "packed")).body)).toEqual({
      ok: false,
      code: "invalid_transition",
      status: "pending_payment",
      nextStatuses: ["confirmed", "cancelled"],
    });

    const steps = ["confirmed", "processing", "packed", "dispatched", "in_transit", "delivered"];
    let previous = "pending_payment";
    for (const step of steps) {
      const result = orderStatusChangeResponseSchema.parse((await moveTo(number, step, step === "dispatched" ? "Handed to the rider" : undefined)).body);
      expect(result, step).toMatchObject({ ok: true, replayed: false, from: previous, status: step, paymentStatus: step === "delivered" ? "paid" : "pending" });
      previous = step;
    }
    // Finished: nothing further, not even a cancellation or a step back.
    for (const step of ["cancelled", "in_transit", "delivered"]) {
      expect((await moveTo(number, step)).body, step).toMatchObject({ ok: false, code: "invalid_transition", status: "delivered", nextStatuses: [] });
    }

    const detail = orderDetailResponseSchema.parse((await send("GET", `/orders/${number}`, "orders.read")).body);
    if (!detail.ok) throw new Error("order not found");
    expect(detail.order.events.map((event) => [event.fromStatus, event.toStatus])).toEqual([
      ["pending_payment", "confirmed"],
      ["confirmed", "processing"],
      ["processing", "packed"],
      ["packed", "dispatched"],
      ["dispatched", "in_transit"],
      ["in_transit", "delivered"],
    ]);
    expect(detail.order.events[3]).toMatchObject({ note: "Handed to the rider", actorId: ADMIN });
    expect(detail.order.registeredCustomer).toBe(true);

    // The customer sees the new status in their account and through order tracking.
    const mine = await listCustomerOrders(t.db, { role: "authenticated", userId: customer });
    expect(mine.find((order) => order.orderNumber === number)).toMatchObject({ status: "delivered" });
    expect(await trackOrder(t.db, number, "baraka@example.test")).toMatchObject({ found: true, status: "delivered" });
    const [stored] = await t.db.query<{ payment_status: string }>(`select payment_status from orders where order_number = $1`, [number]);
    expect(stored!.payment_status).toBe("paid");
  });

  it("puts the reserved stock back when an order is cancelled, once, and not after dispatch", async () => {
    const before = { panel: await stock(PANEL), plug: await stock(PLUG) };
    const number = await placeOrder("Asha Mrema", "asha@example.test");
    expect({ panel: await stock(PANEL), plug: await stock(PLUG) }).toEqual({ panel: before.panel - 2, plug: before.plug - 1 });

    await moveTo(number, "confirmed");
    const cancelled = await moveTo(number, "cancelled", "Customer asked to cancel");
    expect(cancelled.body).toMatchObject({ ok: true, from: "confirmed", status: "cancelled", paymentStatus: "pending" });
    expect({ panel: await stock(PANEL), plug: await stock(PLUG) }).toEqual(before);

    // The same signed request arriving again changes nothing and answers as before.
    const path = `${COUNTRY_ADMIN_API_PREFIX}/orders/${number}/status`;
    const again = await handleCountryAdminRequest(service, {
      method: "POST",
      path,
      authorization: `Bearer ${cancelled.token}`,
      body: JSON.stringify({ status: "cancelled", note: "Customer asked to cancel" }),
    });
    expect(again.body).toMatchObject({ ok: true, replayed: true, status: "cancelled" });
    // A new request to cancel a cancelled order is refused.
    expect((await moveTo(number, "cancelled")).body).toMatchObject({ ok: false, code: "invalid_transition", nextStatuses: [] });
    expect({ panel: await stock(PANEL), plug: await stock(PLUG) }).toEqual(before);
    const [events] = await t.db.query<{ n: number }>(
      `select count(*)::int as n from order_status_events e join orders o on o.id = e.order_id where o.order_number = $1 and e.to_status = 'cancelled'`,
      [number],
    );
    expect(events!.n).toBe(1);

    // Once dispatched, an order can no longer be cancelled.
    const sent = await placeOrder("Asha Mrema", "asha@example.test");
    for (const step of ["confirmed", "processing", "packed", "dispatched"]) await moveTo(sent, step);
    expect((await moveTo(sent, "cancelled")).body).toMatchObject({ ok: false, code: "invalid_transition", status: "dispatched", nextStatuses: ["in_transit"] });
    expect(await stock(PANEL)).toBe(before.panel - 2);
  });

  it("rejects malformed input without changing anything", async () => {
    const number = await placeOrder("Asha Mrema", "asha@example.test");
    for (const body of [{ status: "shipped" }, { status: "confirmed", note: "x".repeat(301) }, {}, { status: 5 }]) {
      expect((await send("POST", `/orders/${number}/status`, "orders.update", body)).body, JSON.stringify(body).slice(0, 40)).toEqual({ ok: false, code: "invalid_request" });
    }
    expect((await send("POST", "/orders/TZ-000000-ABCDEF12/status", "orders.update", { status: "confirmed" })).body).toEqual({ ok: false, code: "not_found" });
    const [row] = await t.db.query<{ status: string }>(`select status from orders where order_number = $1`, [number]);
    expect(row!.status).toBe("pending_payment");
  });
});

describe("internal notes", () => {
  it("are added by an administrator, shown in the order, and never visible to the customer", async () => {
    const number = await placeOrder("Baraka Juma", "baraka@example.test", { role: "authenticated", userId: customer });
    const added = await send("POST", `/orders/${number}/notes`, "orders.update", { body: "  Called the customer; deliver after 2 pm.  " });
    expect(added.body).toEqual({ ok: true, replayed: false });
    expect((await send("POST", `/orders/${number}/notes`, "orders.read", { body: "x" })).status).toBe(401);
    expect((await send("POST", `/orders/${number}/notes`, "orders.update", { body: "   " })).body).toEqual({ ok: false, code: "invalid_request" });
    expect((await send("POST", `/orders/${number}/notes`, "orders.update", { body: "x".repeat(1001) })).body).toEqual({ ok: false, code: "invalid_request" });

    const detail = orderDetailResponseSchema.parse((await send("GET", `/orders/${number}`, "orders.read")).body);
    if (!detail.ok) throw new Error("order not found");
    expect(detail.order.notes).toMatchObject([{ body: "Called the customer; deliver after 2 pm.", actorId: ADMIN }]);

    expect(
      await failure(() => withAccess(t.db, { role: "authenticated", userId: customer }, (tx) => tx.query(`select body from order_notes`))),
    ).toMatch(/permission denied/);
  });
});

describe("a country database that is not set up for the admin", () => {
  it("says the order administration is missing, and that the database refused the role, instead of a bare error", async () => {
    const bare = await createTestDatabase({ seed: false });
    try {
      const country: CountryAdminService = { ...service, db: bare.db };
      const ask = async (method: "GET" | "POST", path: string, permission: string, body?: unknown) => {
        const fullPath = `${COUNTRY_ADMIN_API_PREFIX}${path}`;
        const text = body === undefined ? "" : JSON.stringify(body);
        const token = await signer.sign({ countryCode: "TZ", actorId: ADMIN, permission, method, path: fullPath, body: text });
        return handleCountryAdminRequest(country, { method, path: fullPath, authorization: `Bearer ${token}`, body: text });
      };
      // As if migration 0006 had not been run.
      await bare.db.query(`drop function admin_list_orders(char, text, text, integer, integer)`);
      expect((await ask("GET", "/health", "settings.read")).body).toMatchObject({ ok: true, database: true, orderAdmin: false });
      expect(await ask("GET", "/orders", "orders.read")).toEqual({ status: 503, body: { ok: false, code: "order_admin_missing" } });
      // As if the role the functions run as could not execute them.
      await bare.db.query(`revoke execute on function admin_get_order(char, text) from service_role`);
      expect(await ask("GET", "/orders/TZ-000000-ABCDEF12", "orders.read")).toEqual({ status: 503, body: { ok: false, code: "database_permission" } });
    } finally {
      await bare.pg.close();
    }
    // Builds a database of its own, like the other tests that do (CI took over 5 s).
  }, 60_000);
});

describe("health and the sample catalogue", () => {
  it("reports the country, the data source and whether the database answers", async () => {
    expect((await send("GET", "/health", "settings.read")).body).toMatchObject({ ok: true, country: "TZ", dataSource: "database", database: true, orderAdmin: true });
  });

  it("has no orders to administer while a deployment runs on the sample catalogue", async () => {
    const mock: CountryAdminService = { ...service, db: null };
    const sign = (path: string, permission: string) =>
      signer.sign({ countryCode: "TZ", actorId: ADMIN, permission, method: "GET", path: `${COUNTRY_ADMIN_API_PREFIX}${path}`, body: "" });
    const ask = async (path: string, permission: string) =>
      handleCountryAdminRequest(mock, { method: "GET", path: `${COUNTRY_ADMIN_API_PREFIX}${path}`, authorization: `Bearer ${await sign(path, permission)}`, body: "" });
    expect((await ask("/health", "settings.read")).body).toMatchObject({ ok: true, dataSource: "mock", database: null });
    expect(await ask("/orders", "orders.read")).toEqual({ status: 503, body: { ok: false, code: "orders_not_connected" } });
  });
});
