import { randomBytes, randomUUID } from "node:crypto";
import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  COUNTRY_ADMIN_API_PREFIX,
  createServiceTokenSigner,
  createServiceTokenVerifier,
  notificationListResponseSchema,
  type NotificationList,
  type ServiceTokenSigner,
} from "@tronic/api-contracts";
import { ANON, withAccess, type Access } from "../src/db";
import { handleCountryAdminRequest, type CountryAdminResponse, type CountryAdminService } from "../src/country-admin";
import { countUnreadCustomerNotifications, listCustomerNotifications, markCustomerNotificationsRead } from "../src/notifications";
import { placeCodOrder } from "../src/orders";
import { createShopper, createTestDatabase, type TestDatabase } from "../src/testing";

/**
 * Notifications (migration 0023) on a disposable PGlite database: written
 * by the database when the event happens, read by the customer who owns
 * the order, and by staff and riders through the signed country API.
 */

type Customer = Extract<Access, { role: "authenticated" }>;

let t: TestDatabase;
let signer: ServiceTokenSigner;
let service: CountryAdminService;
let shopper: Customer;
let stranger: Customer;

const MANAGER = "0b6f3a52-7c1e-4f0a-9a57-3d0a5d6b9e11";
const OTHER_MANAGER = "1c7a4b63-8d2f-4a1b-8b68-4e1b6e7c0f22";
const KEEPER = "2d8b5c74-9e3a-4b2c-9c79-5f2c7f8d1a33";
const RIDER = "6a1d2c3b-4e5f-4a60-8b71-9c8d7e6f5a41";
const OTHER_RIDER = "7b2e3d4c-5f60-4b71-9c82-ad9e8f7a6b52";

async function send(method: "GET" | "POST", path: string, permission: string, actorId: string, body?: unknown): Promise<CountryAdminResponse> {
  const fullPath = `${COUNTRY_ADMIN_API_PREFIX}${path}`;
  const text = body === undefined ? "" : JSON.stringify(body);
  const token = await signer.sign({ countryCode: "TZ", actorId, permission, method, path: fullPath, body: text });
  return handleCountryAdminRequest(service, { method, path: fullPath, authorization: `Bearer ${token}`, body: text });
}

const PERMISSION = { orders: "orders.read", inventory: "inventory.read", rider: "deliveries.perform" } as const;
type Audience = keyof typeof PERMISSION;

async function feed(audience: Audience, actorId: string): Promise<NotificationList> {
  return notificationListResponseSchema.parse((await send("GET", `/notifications/${audience}`, PERMISSION[audience], actorId)).body);
}
const seen = async (audience: Audience, actorId: string, through: unknown) =>
  (await send("POST", `/notifications/${audience}/seen`, PERMISSION[audience], actorId, { through })).body;
const about = (list: NotificationList, orderNumber: string) => list.items.filter((item) => item.orderNumber === orderNumber).map((item) => item.kind);

const moveTo = (orderNumber: string, status: string, actorId = MANAGER) => send("POST", `/orders/${orderNumber}/status`, "orders.update", actorId, { status });
const assign = (orderNumber: string, riderId = RIDER) =>
  send("POST", `/orders/${orderNumber}/delivery`, "deliveries.assign", MANAGER, { riderId, riderName: riderId === RIDER ? "Juma Rider" : "Asha Rider" });
const asRider = (orderNumber: string, action: string, body: unknown = {}, rider = RIDER) =>
  send("POST", `/deliveries/${orderNumber}/${action}`, "deliveries.perform", rider, body);

async function placeOrder(access: Customer = shopper, product = "sample-led-panel", quantity = 1): Promise<string> {
  const result = await placeCodOrder(t.db, access, {
    idempotencyKey: randomUUID(),
    country: "TZ",
    contact: { name: "Neema Said", email: "neema@example.test", phone: "+255712340001" },
    delivery: { method: "home", region: "Dar es Salaam", district: "Ilala", ward: "Upanga", street: "Plot 4, Example Rd", extra: "", notes: "" },
    lines: [{ product, color: null, variant: null, quantity }],
    expectedTotalMinor: null,
  });
  if (!result.ok) throw new Error(`could not place the test order: ${result.code}`);
  return result.orderNumber;
}

const kindsFor = async (access: Customer, orderNumber: string) =>
  (await listCustomerNotifications(t.db, access)).filter((n) => n.orderNumber === orderNumber).map((n) => n.kind);

beforeAll(async () => {
  t = await createTestDatabase();
  shopper = await createShopper(t.db);
  stranger = await createShopper(t.db);
  const keys = await generateKeyPair("ES256", { extractable: true });
  signer = await createServiceTokenSigner({ privateKeyPem: await exportPKCS8(keys.privateKey), keyId: "k1" });
  const verifier = await createServiceTokenVerifier({ countryCode: "TZ", publicKeysPem: { k1: await exportSPKI(keys.publicKey) } });
  service = { countryCode: "TZ", verifier, db: t.db };
}, 60_000);

afterAll(async () => {
  await t.pg.close();
});

describe("a customer's notifications", () => {
  it("follow the order from placed to delivered, newest first, and are the customer's own", async () => {
    const orderNumber = await placeOrder();
    expect(await kindsFor(shopper, orderNumber)).toEqual(["order_placed"]);

    for (const status of ["confirmed", "processing", "packed"]) await moveTo(orderNumber, status);
    await assign(orderNumber);
    await asRider(orderNumber, "pickup");
    await asRider(orderNumber, "start");
    expect((await asRider(orderNumber, "fail", { reason: "customer_absent" })).body).toMatchObject({ ok: true });

    expect(await kindsFor(shopper, orderNumber)).toEqual(["delivery_attempt", "in_transit", "dispatched", "packed", "processing", "confirmed", "order_placed"]);
    // Cash on Delivery: no separate payment notification, and nobody else's account hears of the order.
    expect(await kindsFor(stranger, orderNumber)).toEqual([]);
    expect(await listCustomerNotifications(t.db, stranger)).toEqual([]);
  });

  it("the same status change applied twice tells the customer once", async () => {
    const orderNumber = await placeOrder();
    const path = `${COUNTRY_ADMIN_API_PREFIX}/orders/${orderNumber}/status`;
    const text = JSON.stringify({ status: "confirmed" });
    const token = await signer.sign({ countryCode: "TZ", actorId: MANAGER, permission: "orders.update", method: "POST", path, body: text });
    const request = { method: "POST", path, authorization: `Bearer ${token}`, body: text };
    // The second delivery of one signed request is refused or replayed; either way nothing new happens.
    await handleCountryAdminRequest(service, request);
    await handleCountryAdminRequest(service, request);
    expect(await kindsFor(shopper, orderNumber)).toEqual(["confirmed", "order_placed"]);
  });

  it("a cancelled order says so", async () => {
    const orderNumber = await placeOrder();
    await moveTo(orderNumber, "cancelled");
    expect(await kindsFor(shopper, orderNumber)).toEqual(["cancelled", "order_placed"]);
  });

  it("are marked read by their owner only: one, then all", async () => {
    const mine = await listCustomerNotifications(t.db, shopper);
    const unread = await countUnreadCustomerNotifications(t.db, shopper);
    expect(unread).toBe(mine.length);
    expect(mine.every((n) => n.readAt === null)).toBe(true);
    const first = mine[0]!;

    // Another customer cannot mark it, and a visitor has no function to call.
    expect(await markCustomerNotificationsRead(t.db, stranger, first.id)).toBe(0);
    expect(await markCustomerNotificationsRead(t.db, stranger, null)).toBe(0);
    await expect(withAccess(t.db, ANON, (tx) => tx.query(`select customer_mark_notifications_read(null)`))).rejects.toThrow(/permission denied/);
    expect(await countUnreadCustomerNotifications(t.db, shopper)).toBe(unread);

    expect(await markCustomerNotificationsRead(t.db, shopper, first.id)).toBe(1);
    expect(await markCustomerNotificationsRead(t.db, shopper, first.id)).toBe(0);
    expect(await countUnreadCustomerNotifications(t.db, shopper)).toBe(unread - 1);
    expect((await listCustomerNotifications(t.db, shopper))[0]?.readAt).not.toBeNull();

    expect(await markCustomerNotificationsRead(t.db, shopper, null)).toBe(unread - 1);
    expect(await countUnreadCustomerNotifications(t.db, shopper)).toBe(0);
    // Hostile ids change nothing.
    for (const id of [0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 2]) expect(await markCustomerNotificationsRead(t.db, shopper, id)).toBe(0);
  });

  it("cannot be written, changed or deleted by a customer, nor read by a visitor", async () => {
    const orderId = (await t.db.query<{ id: string }>(`select id from orders limit 1`))[0]!.id;
    const asCustomer = (sql: string, params: unknown[] = []) => withAccess(t.db, shopper, (tx) => tx.query(sql, params));
    await expect(asCustomer(`insert into customer_notifications (user_id, order_id, kind) values ($1, $2, 'delivered')`, [shopper.userId, orderId])).rejects.toThrow(/permission denied/);
    await expect(asCustomer(`update customer_notifications set kind = 'delivered'`)).rejects.toThrow(/permission denied/);
    await expect(asCustomer(`delete from customer_notifications`)).rejects.toThrow(/permission denied/);
    await expect(withAccess(t.db, ANON, (tx) => tx.query(`select 1 from customer_notifications`))).rejects.toThrow(/permission denied/);
    // The staff tables are closed to both.
    for (const table of ["staff_notifications", "staff_notification_reads"]) {
      await expect(asCustomer(`select 1 from ${table}`)).rejects.toThrow(/permission denied/);
      await expect(withAccess(t.db, ANON, (tx) => tx.query(`select 1 from ${table}`))).rejects.toThrow(/permission denied/);
    }
    for (const fn of [`admin_list_notifications('TZ', 'orders', '${MANAGER}', 10)`, `admin_mark_notifications_seen('TZ', 'orders', '${MANAGER}', 1)`]) {
      await expect(asCustomer(`select ${fn}`)).rejects.toThrow(/permission denied/);
    }
  });

  it("hold no customer details, prices or delivery code", async () => {
    const columns = await t.db.query<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.columns
        where table_schema = 'public' and table_name in ('customer_notifications', 'staff_notifications')
        order by 1, 2`,
    );
    expect(columns.filter((c) => c.table_name === "customer_notifications").map((c) => c.column_name)).toEqual(["created_at", "id", "kind", "order_id", "read_at", "user_id"]);
    expect(columns.filter((c) => c.table_name === "staff_notifications").map((c) => c.column_name)).toEqual([
      "actor_id",
      "audience",
      "country_code",
      "created_at",
      "id",
      "kind",
      "order_id",
      "product_id",
      "rider_id",
    ]);
  });
});

describe("staff notifications about orders", () => {
  it("tell of a new order, a cancellation, a failed attempt and a delivery, but not the administrator's own action", async () => {
    const cancelled = await placeOrder();
    await moveTo(cancelled, "cancelled", MANAGER);
    // The manager who cancelled is not told; a colleague is.
    expect(about(await feed("orders", MANAGER), cancelled)).toEqual(["order_placed"]);
    expect(about(await feed("orders", OTHER_MANAGER), cancelled)).toEqual(["order_cancelled", "order_placed"]);

    const delivered = await placeOrder();
    for (const status of ["confirmed", "processing", "packed"]) await moveTo(delivered, status);
    await assign(delivered);
    await asRider(delivered, "pickup");
    await asRider(delivered, "start");
    await asRider(delivered, "fail", { reason: "customer_unreachable", note: "Phone off" });
    const code = (await t.db.query<{ code: string }>(`select d.code from deliveries d join orders o on o.id = d.order_id where o.order_number = $1`, [delivered]))[0]!.code;
    const total = Number((await t.db.query<{ total_minor: string }>(`select total_minor from orders where order_number = $1`, [delivered]))[0]!.total_minor);
    const image = () => ({ contentType: "image/png" as const, data: randomBytes(400).toString("base64") });
    expect((await asRider(delivered, "deliver", { code, cashCollectedMinor: total, photo: image(), signature: image() })).body).toMatchObject({ ok: true });

    expect(about(await feed("orders", MANAGER), delivered)).toEqual(["order_delivered", "delivery_failed", "order_placed"]);
    const list = await feed("orders", MANAGER);
    // What happened and to which order: no name, phone, address, amount or code.
    expect(JSON.stringify(list)).not.toMatch(/Neema|neema@|255712340001|Upanga|total|"code"/);
    expect(list.items.every((item) => item.productSlug === null && item.productName === null)).toBe(true);
  });

  it("count what is newer than what the administrator has seen, per administrator, and never go backwards", async () => {
    const before = await feed("orders", MANAGER);
    expect(before.unread).toBe(before.items.filter((item) => item.unread).length);
    expect(before.unread).toBeGreaterThan(0);
    const newest = before.items[0]!.id;

    expect(await seen("orders", MANAGER, newest)).toEqual({ ok: true, seenId: newest });
    const after = await feed("orders", MANAGER);
    expect(after).toMatchObject({ unread: 0, seenId: newest });
    expect(after.items.some((item) => item.unread)).toBe(false);
    // Each administrator has their own mark.
    expect((await feed("orders", OTHER_MANAGER)).unread).toBeGreaterThan(0);

    // An older id does not bring them back; an id from the future stops at the newest that exists.
    expect(await seen("orders", MANAGER, 1)).toEqual({ ok: true, seenId: newest });
    expect(await seen("orders", MANAGER, Number.MAX_SAFE_INTEGER)).toEqual({ ok: true, seenId: newest });
    const next = await placeOrder();
    const later = await feed("orders", MANAGER);
    expect(later.unread).toBe(1);
    expect(later.items[0]).toMatchObject({ orderNumber: next, kind: "order_placed", unread: true });

    for (const through of [-1, 1.5, "7", null, undefined]) expect(await seen("orders", MANAGER, through)).toEqual({ ok: false, code: "invalid_request" });
  });

  it("need the audience's own permission, for this country, and a signed request", async () => {
    // A token for another permission does not open the audience.
    expect((await send("GET", "/notifications/orders", "inventory.read", KEEPER)).status).toBe(401);
    expect((await send("GET", "/notifications/inventory", "orders.read", MANAGER)).status).toBe(401);
    expect((await send("GET", "/notifications/rider", "orders.read", MANAGER)).status).toBe(401);
    expect((await send("POST", "/notifications/orders/seen", "deliveries.perform", RIDER, { through: 1 })).status).toBe(401);
    // No audience of that name.
    expect((await send("GET", "/notifications/customers", "orders.read", MANAGER)).status).toBe(404);
    // Unsigned.
    const unsigned = await handleCountryAdminRequest(service, { method: "GET", path: `${COUNTRY_ADMIN_API_PREFIX}/notifications/orders`, authorization: null, body: "" });
    expect(unsigned.status).toBe(401);
    // Signed for another country.
    const path = `${COUNTRY_ADMIN_API_PREFIX}/notifications/orders`;
    const token = await signer.sign({ countryCode: "KE", actorId: MANAGER, permission: "orders.read", method: "GET", path, body: "" });
    expect((await handleCountryAdminRequest(service, { method: "GET", path, authorization: `Bearer ${token}`, body: "" })).status).toBe(401);
  });
});

describe("a rider's notifications", () => {
  it("tell the rider of a delivery given to them, moved to another rider, or cancelled; and no other rider", async () => {
    const moved = await placeOrder();
    await moveTo(moved, "confirmed");
    await assign(moved, RIDER);
    expect(about(await feed("rider", RIDER), moved)).toEqual(["delivery_assigned"]);
    expect(about(await feed("rider", OTHER_RIDER), moved)).toEqual([]);
    // Given to the same rider again: nothing new.
    await assign(moved, RIDER);
    expect(about(await feed("rider", RIDER), moved)).toEqual(["delivery_assigned"]);

    await assign(moved, OTHER_RIDER);
    expect(about(await feed("rider", RIDER), moved)).toEqual(["delivery_reassigned", "delivery_assigned"]);
    expect(about(await feed("rider", OTHER_RIDER), moved)).toEqual(["delivery_assigned"]);

    await moveTo(moved, "cancelled");
    expect(about(await feed("rider", OTHER_RIDER), moved)).toEqual(["delivery_cancelled", "delivery_assigned"]);
    expect(about(await feed("rider", RIDER), moved)).toEqual(["delivery_reassigned", "delivery_assigned"]);
  });

  it("a rider marks only their own as seen", async () => {
    const mine = await feed("rider", OTHER_RIDER);
    const others = (await feed("rider", RIDER)).unread;
    expect(mine.unread).toBeGreaterThan(0);
    expect(await seen("rider", OTHER_RIDER, mine.items[0]!.id)).toEqual({ ok: true, seenId: mine.items[0]!.id });
    expect((await feed("rider", OTHER_RIDER)).unread).toBe(0);
    expect((await feed("rider", RIDER)).unread).toBe(others);
    // A manager who is not a rider has none, whatever the other audiences hold.
    expect(await feed("rider", MANAGER)).toMatchObject({ unread: 0, items: [] });
    // The rider audience never carries order notifications of the staff.
    expect((await feed("rider", OTHER_RIDER)).items.every((item) => item.kind.startsWith("delivery_"))).toBe(true);
  });
});

describe("stock notifications", () => {
  const adjust = (slug: string, body: unknown) => send("POST", `/inventory/${slug}/adjust`, "inventory.adjust", KEEPER, body);
  const forProduct = async (slug: string) => (await feed("inventory", KEEPER)).items.filter((item) => item.productSlug === slug).map((item) => item.kind);

  it("tell once when a product reaches its low level, and once when it runs out", async () => {
    const slug = "sample-top-plug";
    expect((await adjust(slug, { mode: "set", quantity: 20, reason: "correction" })).body).toMatchObject({ ok: true });
    expect(await forProduct(slug)).toEqual([]);

    // Low level is 5: from 20 to 5 crosses it; 5 to 3 does not cross it again.
    expect((await adjust(slug, { mode: "set", quantity: 5, reason: "correction" })).body).toMatchObject({ ok: true });
    expect(await forProduct(slug)).toEqual(["stock_low"]);
    expect((await adjust(slug, { mode: "set", quantity: 3, reason: "correction" })).body).toMatchObject({ ok: true });
    expect(await forProduct(slug)).toEqual(["stock_low"]);

    // An order that takes the last units runs it out.
    await placeOrder(shopper, slug, 3);
    expect(await forProduct(slug)).toEqual(["stock_out", "stock_low"]);
    const list = await feed("inventory", KEEPER);
    expect(list.items[0]).toMatchObject({ kind: "stock_out", productSlug: slug, orderNumber: null, unread: true });
    expect(typeof list.items[0]?.productName).toBe("string");

    // Restocked above the level and sold down again: told again.
    expect((await adjust(slug, { mode: "set", quantity: 12, reason: "correction" })).body).toMatchObject({ ok: true });
    expect((await adjust(slug, { mode: "set", quantity: 4, reason: "correction" })).body).toMatchObject({ ok: true });
    expect(await forProduct(slug)).toEqual(["stock_low", "stock_out", "stock_low"]);
  });

  it("stay out of the orders audience, and orders stay out of this one", async () => {
    expect((await feed("orders", MANAGER)).items.some((item) => item.kind.startsWith("stock_"))).toBe(false);
    expect((await feed("inventory", KEEPER)).items.every((item) => item.kind.startsWith("stock_"))).toBe(true);
  });
});

describe("another country's records", () => {
  it("a notification of another country is not listed and cannot be marked", async () => {
    const [country] = await t.db.query<{ code: string }>(`select code from countries where code <> 'TZ' limit 1`);
    if (!country) return; // The test catalogue has one country only.
    const [order] = await t.db.query<{ id: string }>(`select id from orders limit 1`);
    const [row] = await t.db.query<{ id: string }>(
      `insert into staff_notifications (country_code, audience, kind, order_id) values ($1, 'orders', 'order_placed', $2) returning id`,
      [country.code, order!.id],
    );
    const foreign = Number(row!.id);
    expect((await feed("orders", KEEPER)).items.some((item) => item.id === foreign)).toBe(false);
    // Marking "through" the foreign id stops at Tanzania's newest.
    const newest = (await feed("orders", KEEPER)).items[0]!.id;
    expect(newest).toBeLessThan(foreign);
    expect(await seen("orders", KEEPER, foreign)).toEqual({ ok: true, seenId: newest });
    await t.db.query(`delete from staff_notifications where id = $1`, [foreign]);
  });
});
