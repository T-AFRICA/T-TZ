import { randomBytes, randomUUID } from "node:crypto";
import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  COUNTRY_ADMIN_API_PREFIX,
  createServiceTokenSigner,
  createServiceTokenVerifier,
  deliveryInfoResponseSchema,
  riderDeliveriesResponseSchema,
  riderDeliveryListResponseSchema,
  riderFiguresResponseSchema,
  riderDeliveryResponseSchema,
  type ServiceTokenSigner,
} from "@tronic/api-contracts";
import { ANON, withAccess } from "../src/db";
import { handleCountryAdminRequest, type CountryAdminResponse, type CountryAdminService } from "../src/country-admin";
import { getCustomerTracking, placeCodOrder } from "../src/orders";
import { createAuthUser, createTestDatabase, type TestDatabase } from "../src/testing";

/**
 * Deliveries by TRONIC's riders (migration 0008) through the country admin
 * API, on a disposable PGlite database. Requests are signed with a key pair
 * made up for this run and go through handleCountryAdminRequest, as the
 * storefront serves them.
 */

let t: TestDatabase;
let signer: ServiceTokenSigner;
let service: CountryAdminService;

const MANAGER = "0b6f3a52-7c1e-4f0a-9a57-3d0a5d6b9e11";
const RIDER = "6a1d2c3b-4e5f-4a60-8b71-9c8d7e6f5a41";
const OTHER_RIDER = "7b2e3d4c-5f60-4b71-9c82-ad9e8f7a6b52";
const PHONE = "+255712340001";

const image = (size = 400) => ({ contentType: "image/png" as const, data: randomBytes(size).toString("base64") });

async function send(method: "GET" | "POST", path: string, permission: string, actorId: string, body?: unknown): Promise<CountryAdminResponse> {
  const fullPath = `${COUNTRY_ADMIN_API_PREFIX}${path}`;
  const text = body === undefined ? "" : JSON.stringify(body);
  const token = await signer.sign({ countryCode: "TZ", actorId, permission, method, path: fullPath, body: text });
  return handleCountryAdminRequest(service, { method, path: fullPath, authorization: `Bearer ${token}`, body: text });
}

/** As an Order Manager, with the one permission the endpoint needs. */
function managerPermission(method: "GET" | "POST", path: string): string {
  if (path.includes("delivery") || path.startsWith("/riders")) return "deliveries.assign";
  return method === "GET" ? "orders.read" : "orders.update";
}
const asManager = (method: "GET" | "POST", path: string, body?: unknown) => send(method, path, managerPermission(method, path), MANAGER, body);
const asRider = (method: "GET" | "POST", path: string, body?: unknown, rider = RIDER) => send(method, path, "deliveries.perform", rider, body);
const moveTo = (orderNumber: string, status: string) => send("POST", `/orders/${orderNumber}/status`, "orders.update", MANAGER, { status });

async function placeOrder(): Promise<{ orderNumber: string; totalMinor: number }> {
  const result = await placeCodOrder(t.db, ANON, {
    idempotencyKey: randomUUID(),
    country: "TZ",
    contact: { name: "Neema Said", email: "neema@example.test", phone: PHONE },
    delivery: { method: "home", region: "Dar es Salaam", district: "Ilala", ward: "Upanga", street: "Plot 4, Example Rd", extra: "", notes: "Gate is blue" },
    lines: [{ product: "sample-led-panel", color: null, variant: null, quantity: 1 }],
    expectedTotalMinor: null,
  });
  if (!result.ok) throw new Error(`could not place the test order: ${result.code}`);
  return { orderNumber: result.orderNumber, totalMinor: result.totalMinor };
}

async function packedOrder(): Promise<{ orderNumber: string; totalMinor: number }> {
  const order = await placeOrder();
  for (const status of ["confirmed", "processing", "packed"]) await moveTo(order.orderNumber, status);
  return order;
}

async function customerCode(orderNumber: string, contact: string): Promise<string | null> {
  const [row] = await withAccess(t.db, ANON, (tx) => tx.query<{ result: unknown }>(`select customer_delivery_code($1, $2) as result`, [orderNumber, contact]));
  const raw: unknown = typeof row?.result === "string" ? JSON.parse(row.result) : row?.result;
  return raw && typeof raw === "object" ? String((raw as { code: unknown }).code) : null;
}

const assign = (orderNumber: string, riderId = RIDER, riderName = "Juma Rider") =>
  asManager("POST", `/orders/${orderNumber}/delivery`, { riderId, riderName });

beforeAll(async () => {
  t = await createTestDatabase();
  await createAuthUser(t.db, "someone@example.test");
  const keys = await generateKeyPair("ES256", { extractable: true });
  signer = await createServiceTokenSigner({ privateKeyPem: await exportPKCS8(keys.privateKey), keyId: "k1" });
  const verifier = await createServiceTokenVerifier({ countryCode: "TZ", publicKeysPem: { k1: await exportSPKI(keys.publicKey) } });
  service = { countryCode: "TZ", verifier, db: t.db };
}, 60_000);

afterAll(async () => {
  await t.pg.close();
});

describe("assigning a delivery", () => {
  it("gives a confirmed order to a rider, can change rider before pickup, and refuses unpaid or finished orders", async () => {
    const order = await placeOrder();
    expect((await assign(order.orderNumber)).body).toEqual({ ok: false, code: "not_assignable", status: "pending_payment" });
    await moveTo(order.orderNumber, "confirmed");
    expect((await assign(order.orderNumber, OTHER_RIDER, "Asha Rider")).body).toEqual({ ok: true, riderId: OTHER_RIDER, riderName: "Asha Rider" });
    expect((await assign(order.orderNumber)).body).toEqual({ ok: true, riderId: RIDER, riderName: "Juma Rider" });

    const info = deliveryInfoResponseSchema.parse((await asManager("GET", `/orders/${order.orderNumber}/delivery`)).body);
    expect(info).toMatchObject({ ok: true, delivery: { riderId: RIDER, riderName: "Juma Rider", proofs: [], attempts: [], codeLocked: false } });
    // Administrators never receive the customer's code.
    expect(JSON.stringify(info)).not.toMatch(/"code"/);

    expect((await asManager("POST", `/orders/TZ-000000-NOTHERE1/delivery`, { riderId: RIDER, riderName: "Juma" })).body).toEqual({ ok: false, code: "not_found" });
    expect((await asManager("POST", `/orders/${order.orderNumber}/delivery`, { riderId: "not-a-uuid", riderName: "Juma" })).body).toEqual({ ok: false, code: "invalid_request" });
  });

  it("needs deliveries.assign: a rider's token cannot assign", async () => {
    const order = await packedOrder();
    const response = await send("POST", `/orders/${order.orderNumber}/delivery`, "deliveries.perform", RIDER, { riderId: RIDER, riderName: "Me" });
    expect(response.status).toBe(401);
  });
});

describe("a rider's delivery", () => {
  it("goes picked up, on the way, delivered with the customer's code, both proofs and the cash; once", async () => {
    const { orderNumber, totalMinor } = await packedOrder();
    await assign(orderNumber);

    const mine = riderDeliveryListResponseSchema.parse((await asRider("GET", "/deliveries")).body);
    expect(mine.deliveries.map((d) => d.orderNumber)).toContain(orderNumber);
    expect(riderDeliveryListResponseSchema.parse((await asRider("GET", "/deliveries", undefined, OTHER_RIDER)).body).deliveries.map((d) => d.orderNumber)).not.toContain(orderNumber);

    const detail = riderDeliveryResponseSchema.parse((await asRider("GET", `/deliveries/${orderNumber}`)).body);
    expect(detail).toMatchObject({ ok: true, delivery: { contact: { name: "Neema Said", phone: PHONE }, cashToCollectMinor: totalMinor, delivery: { notes: "Gate is blue" } } });
    expect(JSON.stringify(detail)).not.toMatch(/"code"/);
    // Another rider gets the same answer as for an unknown order.
    expect((await asRider("GET", `/deliveries/${orderNumber}`, undefined, OTHER_RIDER)).body).toEqual({ ok: false, code: "not_found" });
    expect((await asRider("POST", `/deliveries/${orderNumber}/pickup`, {}, OTHER_RIDER)).body).toEqual({ ok: false, code: "not_found" });

    // The customer has no code before the order leaves.
    expect(await customerCode(orderNumber, PHONE)).toBeNull();
    expect((await asRider("POST", `/deliveries/${orderNumber}/start`, {})).body).toEqual({ ok: false, code: "wrong_step", status: "packed" });
    expect((await asRider("POST", `/deliveries/${orderNumber}/pickup`, {})).body).toEqual({ ok: true, replayed: false, status: "dispatched", paymentStatus: "pending" });
    // Picked up: no other rider can be given it now.
    expect((await assign(orderNumber, OTHER_RIDER, "Asha")).body).toEqual({ ok: false, code: "not_assignable", status: "dispatched" });
    expect((await asRider("POST", `/deliveries/${orderNumber}/start`, {})).body).toMatchObject({ ok: true, status: "in_transit" });

    const code = await customerCode(orderNumber, PHONE);
    expect(code).toMatch(/^[0-9]{6}$/);
    expect(await customerCode(orderNumber, "neema@example.test")).toBe(code);
    expect(await customerCode(orderNumber, "+255700000000")).toBeNull();
    const wrong = code === "000000" ? "111111" : "000000";

    const proofs = { photo: image(), signature: image(300) };
    expect((await asRider("POST", `/deliveries/${orderNumber}/deliver`, { code: wrong, cashCollectedMinor: totalMinor, ...proofs })).body).toEqual({ ok: false, code: "wrong_code", attemptsLeft: 4 });
    expect((await asRider("POST", `/deliveries/${orderNumber}/deliver`, { code, cashCollectedMinor: totalMinor, photo: proofs.photo })).body).toEqual({ ok: false, code: "proof_missing" });
    expect((await asRider("POST", `/deliveries/${orderNumber}/deliver`, { code, cashCollectedMinor: totalMinor - 100, ...proofs })).body).toEqual({ ok: false, code: "cash_mismatch" });

    const finalBody = { code, cashCollectedMinor: totalMinor, ...proofs };
    const fullPath = `${COUNTRY_ADMIN_API_PREFIX}/deliveries/${orderNumber}/deliver`;
    const text = JSON.stringify(finalBody);
    const token = await signer.sign({ countryCode: "TZ", actorId: RIDER, permission: "deliveries.perform", method: "POST", path: fullPath, body: text });
    const delivered = await handleCountryAdminRequest(service, { method: "POST", path: fullPath, authorization: `Bearer ${token}`, body: text });
    // Cash on Delivery: paid at delivery.
    expect(delivered.body).toEqual({ ok: true, replayed: false, status: "delivered", paymentStatus: "paid" });
    expect(await customerCode(orderNumber, PHONE)).toBeNull();

    const info = deliveryInfoResponseSchema.parse((await asManager("GET", `/orders/${orderNumber}/delivery`)).body);
    expect(info).toMatchObject({ ok: true, delivery: { cashCollectedMinor: totalMinor, proofs: ["photo", "signature"] } });
    const photo = (await asManager("GET", `/orders/${orderNumber}/delivery/proofs/photo`)).body as { ok: boolean; proof: { data: string } };
    expect(photo.ok).toBe(true);
    expect(photo.proof.data).toBe(proofs.photo.data);
    expect((await asManager("GET", `/orders/${orderNumber}/delivery/proofs/receipt`)).body).toEqual({ ok: false, code: "not_found" });

    // The order history names the rider for each step.
    const [steps] = await t.db.query<{ n: number }>(
      `select count(*)::int as n from order_status_events e join orders o on o.id = e.order_id where o.order_number = $1 and e.actor_id = $2`,
      [orderNumber, RIDER],
    );
    expect(steps?.n).toBe(3);
  });

  it("locks the order for 15 minutes after five wrong codes", async () => {
    const { orderNumber, totalMinor } = await packedOrder();
    await assign(orderNumber);
    await asRider("POST", `/deliveries/${orderNumber}/pickup`, {});
    await asRider("POST", `/deliveries/${orderNumber}/start`, {});
    const code = await customerCode(orderNumber, PHONE);
    const wrong = code === "000000" ? "111111" : "000000";
    const body = { code: wrong, cashCollectedMinor: totalMinor, photo: image(), signature: image() };
    const answers = [];
    for (let attempt = 0; attempt < 5; attempt += 1) answers.push((await asRider("POST", `/deliveries/${orderNumber}/deliver`, body)).body);
    expect(answers.slice(0, 4).map((answer) => (answer as { attemptsLeft: number }).attemptsLeft)).toEqual([4, 3, 2, 1]);
    expect(answers[4]).toMatchObject({ ok: false, code: "code_locked" });
    // Even the right code waits now.
    expect((await asRider("POST", `/deliveries/${orderNumber}/deliver`, { ...body, code })).body).toMatchObject({ ok: false, code: "code_locked" });
    expect(deliveryInfoResponseSchema.parse((await asManager("GET", `/orders/${orderNumber}/delivery`)).body)).toMatchObject({ delivery: { codeLocked: true } });
  });

  it("records a failed attempt with a reason; the order stays with the rider", async () => {
    const { orderNumber } = await packedOrder();
    await assign(orderNumber);
    expect((await asRider("POST", `/deliveries/${orderNumber}/fail`, { reason: "customer_absent" })).body).toEqual({ ok: false, code: "wrong_step", status: "packed" });
    await asRider("POST", `/deliveries/${orderNumber}/pickup`, {});
    expect((await asRider("POST", `/deliveries/${orderNumber}/fail`, { reason: "other" })).body).toEqual({ ok: false, code: "invalid_request" });
    expect((await asRider("POST", `/deliveries/${orderNumber}/fail`, { reason: "customer_unreachable", note: "Phone off, tried twice" })).body).toEqual({
      ok: true,
      replayed: false,
      status: "dispatched",
      paymentStatus: "pending",
    });
    const detail = riderDeliveryResponseSchema.parse((await asRider("GET", `/deliveries/${orderNumber}`)).body);
    expect(detail).toMatchObject({ delivery: { status: "dispatched", attempts: [{ reason: "customer_unreachable", note: "Phone off, tried twice" }] } });
    expect((await asRider("POST", `/deliveries/${orderNumber}/teleport`, {})).body).toEqual({ ok: false, code: "invalid_request" });
  });
});

describe("who can reach deliveries", () => {
  it("customers and visitors reach only their code; no table, no rider function", async () => {
    const refused = async (sql: string) => {
      try {
        await withAccess(t.db, ANON, (tx) => tx.query(sql));
        return "allowed";
      } catch (error) {
        return error instanceof Error && /permission denied/.test(error.message) ? "denied" : String(error);
      }
    };
    expect(await refused(`select code from deliveries`)).toBe("denied");
    expect(await refused(`select * from delivery_proofs`)).toBe("denied");
    expect(await refused(`select rider_list_deliveries('TZ', gen_random_uuid())`)).toBe("denied");
    expect(await refused(`select admin_assign_delivery('TZ', 'x', gen_random_uuid(), 'x', gen_random_uuid())`)).toBe("denied");
    expect(await refused(`select customer_delivery_code('TZ-000000-NOTHERE1', '+255712340001')`)).toBe("allowed");
  });
});

describe("riders' figures", () => {
  it("counts each rider's deliveries, failed attempts and today's cash, for whoever assigns deliveries", async () => {
    const figures = await asManager("GET", "/riders");
    expect(figures.status).toBe(200);
    const body = riderFiguresResponseSchema.parse(figures.body);
    expect(body).toMatchObject({ currency: "TZS", currencyExponent: 2 });
    const mine = body.riders[RIDER]!;
    // From the tests above: one delivered today with its cash, one locked, one with a failed attempt.
    expect(mine.deliveredToday).toBeGreaterThanOrEqual(1);
    expect(mine.delivered7Days).toBe(mine.deliveredToday);
    expect(mine.cashTodayMinor).toBeGreaterThan(0);
    expect(mine.open).toBeGreaterThanOrEqual(2);
    expect(mine.failed7Days).toBeGreaterThanOrEqual(1);
    expect(mine.lastDeliveredAt).not.toBeNull();
    expect(JSON.stringify(body)).not.toMatch(/"code"/);

    const history = riderDeliveriesResponseSchema.parse((await asManager("GET", `/riders/${RIDER}`)).body);
    expect(history.deliveries.some((d) => d.status === "delivered" && d.cashCollectedMinor !== null)).toBe(true);
    expect(history.attempts.map((a) => a.reason)).toContain("customer_unreachable");
    expect(JSON.stringify(history)).not.toMatch(/"code"/);
    // A rider with no orders has an empty history; a rider cannot read anyone's figures.
    expect(riderDeliveriesResponseSchema.parse((await asManager("GET", `/riders/${randomUUID()}`)).body).deliveries).toEqual([]);
    expect((await send("GET", "/riders", "deliveries.perform", RIDER)).status).toBe(401);
    expect((await asManager("GET", "/riders/not-a-uuid")).status).toBe(400);
  });
});

describe("live tracking", () => {
  it("takes the rider's location only while the order is on its way, and shows the customer the step times, the rider and the path", async () => {
    const { orderNumber } = await packedOrder();
    expect((await asManager("POST", `/orders/${orderNumber}/delivery`, { riderId: RIDER, riderName: "Juma Rider", riderPhone: "+255712000222" })).body).toMatchObject({ ok: true });
    const point = { lat: -6.8161, lng: 39.2803, accuracy: 12 };

    // Not yet picked up: no location is taken, and the customer sees the steps only.
    expect((await asRider("POST", `/deliveries/${orderNumber}/location`, point)).body).toEqual({ ok: false, code: "not_on_the_way" });
    const before = await customerTracking(orderNumber, PHONE);
    expect(before).toMatchObject({ status: "packed", rider: null, path: [] });
    expect(before!.events.map((e) => e.status)).toEqual(["confirmed", "processing", "packed"]);

    await asRider("POST", `/deliveries/${orderNumber}/pickup`, {});
    expect((await asRider("POST", `/deliveries/${orderNumber}/location`, point)).body).toEqual({ ok: true, saved: true });
    // A second point within 10 seconds is not kept.
    expect((await asRider("POST", `/deliveries/${orderNumber}/location`, { ...point, lat: -6.81 })).body).toEqual({ ok: true, saved: false });
    // Another rider's phone, nonsense and a missing order are refused.
    expect((await asRider("POST", `/deliveries/${orderNumber}/location`, point, OTHER_RIDER)).body).toEqual({ ok: false, code: "not_found" });
    expect((await asRider("POST", `/deliveries/${orderNumber}/location`, { lat: 120, lng: 39 })).body).toEqual({ ok: false, code: "invalid_request" });

    const on = await customerTracking(orderNumber, PHONE);
    expect(on).toMatchObject({ status: "dispatched", rider: { name: "Juma", phone: "+255712000222" } });
    expect(on!.path).toEqual([expect.objectContaining({ lat: -6.8161, lng: 39.2803, accuracy: 12 })]);
    expect(on!.events.at(-1)).toMatchObject({ status: "dispatched" });
    // Someone with the wrong contact sees nothing at all.
    expect(await customerTracking(orderNumber, "+255700000001")).toBeNull();

    // Delivered: the rider and the path are no longer shown.
    await asRider("POST", `/deliveries/${orderNumber}/start`, {});
    const code = await customerCode(orderNumber, PHONE);
    const total = (await t.db.query<{ total_minor: number }>(`select total_minor from orders where order_number = $1`, [orderNumber]))[0]!.total_minor;
    await asRider("POST", `/deliveries/${orderNumber}/deliver`, { code, cashCollectedMinor: Number(total), photo: image(), signature: image() });
    expect(await customerTracking(orderNumber, PHONE)).toMatchObject({ status: "delivered", rider: null, path: [] });
    expect((await asRider("POST", `/deliveries/${orderNumber}/location`, point)).body).toEqual({ ok: false, code: "not_on_the_way" });
  });

  it("keeps the location table private", async () => {
    await expect(withAccess(t.db, ANON, (tx) => tx.query(`select * from delivery_locations`))).rejects.toThrow(/permission denied/);
    await expect(
      withAccess(t.db, ANON, (tx) => tx.query(`select rider_report_location('TZ', 'x', gen_random_uuid(), 0, 0, null)`)),
    ).rejects.toThrow(/permission denied/);
  });
});

async function customerTracking(orderNumber: string, contact: string) {
  return getCustomerTracking(t.db, ANON, orderNumber, contact);
}
