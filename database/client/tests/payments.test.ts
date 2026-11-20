import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPaymentPolicy, type CountryPaymentPolicy } from "@tronic/country-config";
import {
  createPaymentService,
  type GatewayInitiateRequest,
  type GatewayInitiateResult,
  type GatewayPaymentUpdate,
  type GatewayStatusResult,
  type PaymentGateway,
} from "@tronic/payments";
import { ANON, withAccess, type Access } from "../src/db";
import { placeCodOrder } from "../src/orders";
import { databasePaymentStore } from "../src/payments";
import { createAuthUser, createShopper, createTestDatabase, type TestDatabase } from "../src/testing";

/**
 * Online payments (migration 0007) and the server's payment service, on a
 * disposable PGlite database, with a stand-in gateway defined here. The
 * stand-in signs its webhooks with a key made up for this run; nothing
 * leaves the machine and no real gateway, wallet or card is involved.
 */

let t: TestDatabase;
let alice: string;
let bob: string;
/** Orders need an account (migration 0015). */
let shopper: Access;
const WEBHOOK_KEY = randomBytes(32);

const policy: CountryPaymentPolicy = {
  ...getPaymentPolicy("TZ"),
  gateway: "test_gateway",
  methods: { mobile_money: "sandbox", card: "sandbox", bank_transfer: "unavailable", pay_on_delivery: "live" },
  mobileMoneyProviders: [
    { id: "mpesa", name: "M-Pesa", availability: "sandbox" },
    { id: "halopesa", name: "HaloPesa", availability: "unavailable" },
  ],
};

/** A stand-in for an approved gateway: records what it is asked and answers as told. */
class StandInGateway implements PaymentGateway {
  readonly id = "test_gateway";
  readonly methods = ["mobile_money", "card"] as const;
  initiated: GatewayInitiateRequest[] = [];
  nextInitiate: GatewayInitiateResult | "timeout" = { kind: "accepted", status: "pending", gatewayReference: null, redirectUrl: null };
  statuses = new Map<string, GatewayStatusResult>();

  async initiate(request: GatewayInitiateRequest): Promise<GatewayInitiateResult> {
    this.initiated.push(request);
    if (this.nextInitiate === "timeout") throw new Error("timed out");
    const answer = this.nextInitiate;
    return answer.kind === "accepted" && answer.gatewayReference === null
      ? { ...answer, gatewayReference: `GW-${randomUUID()}` }
      : answer;
  }

  async fetchStatus(lookup: { reference: string }): Promise<GatewayStatusResult> {
    return this.statuses.get(lookup.reference) ?? { found: false };
  }

  async verifyWebhook({ headers, rawBody }: { headers: Headers; rawBody: string }) {
    const given = Buffer.from(headers.get("x-test-signature") ?? "", "hex");
    const expected = createHmac("sha256", WEBHOOK_KEY).update(rawBody).digest();
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false as const, reason: "signature" as const };
    try {
      return { ok: true as const, update: JSON.parse(rawBody) as GatewayPaymentUpdate };
    } catch {
      return { ok: false as const, reason: "malformed" as const };
    }
  }
}

function webhook(update: Partial<GatewayPaymentUpdate> & { reference: string; status: GatewayPaymentUpdate["status"] }, key: Buffer = WEBHOOK_KEY) {
  const rawBody = JSON.stringify({ eventId: randomUUID(), gatewayReference: null, amountMinor: null, currency: null, failureCode: null, ...update });
  const headers = new Headers({ "x-test-signature": createHmac("sha256", key).update(rawBody).digest("hex") });
  return { headers, rawBody };
}

/** Places an order (as the checkout does today) and marks it as paid online, as checkout will once a gateway is approved. */
async function onlineOrder(method: "mobile_money" | "card", access: Access = shopper, email = "amina@example.com"): Promise<{ orderNumber: string; totalMinor: number }> {
  const result = await placeCodOrder(t.db, access, {
    idempotencyKey: randomUUID(),
    country: "TZ",
    contact: { name: "Amina Juma", email, phone: "+255712345678" },
    delivery: { method: "home", region: "Dar es Salaam", district: "Kinondoni", ward: "Mikocheni", street: "Plot 12, Example St", extra: "", notes: "" },
    lines: [{ product: "sample-led-panel", color: null, variant: null, quantity: 1 }],
    expectedTotalMinor: null,
  });
  if (!result.ok) throw new Error(`could not place the test order: ${result.code}`);
  await t.db.query(`update orders set payment_method = $1 where order_number = $2`, [method, result.orderNumber]);
  return { orderNumber: result.orderNumber, totalMinor: result.totalMinor };
}

async function order(orderNumber: string) {
  const [row] = await t.db.query<{ status: string; payment_status: string }>(
    `select status, payment_status from orders where order_number = $1`,
    [orderNumber],
  );
  return row!;
}

function setup() {
  const gateway = new StandInGateway();
  const store = databasePaymentStore(t.db);
  const service = createPaymentService({ policy, gateway, store });
  return { gateway, store, service };
}

const mpesa = { method: "mobile_money" as const, walletProvider: "mpesa" as const, payerPhone: "+255712345678", returnUrl: null };

beforeAll(async () => {
  t = await createTestDatabase();
  alice = await createAuthUser(t.db, "alice@example.test");
  bob = await createAuthUser(t.db, "bob@example.test");
  shopper = await createShopper(t.db, "amina@example.com");
}, 60_000);

afterAll(async () => {
  await t.pg.close();
});

describe("starting a payment", () => {
  it("copies the amount from the order, sends a prompt once, and confirms the order only on a signed success", async () => {
    const { gateway, service } = setup();
    const { orderNumber, totalMinor } = await onlineOrder("mobile_money");
    const key = randomUUID();

    const started = await service.startPayment({ orderNumber, idempotencyKey: key, ...mpesa });
    expect(started).toMatchObject({ ok: true, next: "await_confirmation", payment: { status: "pending", amountMinor: totalMinor, currency: "TZS" } });
    expect(gateway.initiated).toHaveLength(1);
    expect(gateway.initiated[0]).toMatchObject({ amountMinor: totalMinor, walletProvider: "mpesa", payerPhone: "+255712345678" });
    if (!started.ok) throw new Error("not started");
    const reference = started.payment.reference;
    expect(reference).toMatch(/^TZP-[0-9A-F]{12}$/);
    expect(await order(orderNumber)).toEqual({ status: "pending_payment", payment_status: "pending" });

    // A double click: same key, same payment, the gateway is not asked again.
    const again = await service.startPayment({ orderNumber, idempotencyKey: key, ...mpesa });
    expect(again).toMatchObject({ ok: true, payment: { reference } });
    expect(gateway.initiated).toHaveLength(1);
    // Another attempt while this one is open is refused, not charged.
    expect(await service.startPayment({ orderNumber, idempotencyKey: randomUUID(), ...mpesa })).toMatchObject({
      ok: false,
      reason: "payment_in_progress",
      payment: { reference },
    });

    const success = webhook({ reference, status: "successful", amountMinor: totalMinor, currency: "TZS", gatewayReference: started.payment.gatewayReference });
    // Another payment's gateway id never settles this one.
    const other = await onlineOrder("mobile_money");
    const otherStarted = await service.startPayment({ orderNumber: other.orderNumber, idempotencyKey: randomUUID(), ...mpesa });
    if (!otherStarted.ok) throw new Error("not started");
    expect(
      await service.handleWebhook(webhook({ reference, status: "successful", amountMinor: totalMinor, currency: "TZS", gatewayReference: otherStarted.payment.gatewayReference })),
    ).toMatchObject({ httpStatus: 422, result: { code: "reference_mismatch" } });
    expect(await service.handleWebhook(success)).toMatchObject({ httpStatus: 200, result: { ok: true, changed: true, orderStatus: "confirmed", orderPaymentStatus: "paid" } });
    expect(await order(orderNumber)).toEqual({ status: "confirmed", payment_status: "paid" });
    // The same webhook again changes nothing.
    expect(await service.handleWebhook(success)).toMatchObject({ httpStatus: 200, result: { ok: true, changed: false, replayed: true } });
    // Paid orders take no further payment.
    expect(await service.startPayment({ orderNumber, idempotencyKey: randomUUID(), ...mpesa })).toEqual({ ok: false, reason: "already_paid" });
  });

  it("refuses methods, wallets and orders that are not set up for it", async () => {
    const { service } = setup();
    const cod = await placeCodOrder(t.db, shopper, {
      idempotencyKey: randomUUID(),
      country: "TZ",
      contact: { name: "Juma Ali", email: "juma@example.com", phone: "+255712345679" },
      delivery: { method: "home", region: "Arusha", district: "Arusha", ward: "Kaloleni", street: "Sokoine Rd 5", extra: "", notes: "" },
      lines: [{ product: "sample-led-panel", color: null, variant: null, quantity: 1 }],
      expectedTotalMinor: null,
    });
    if (!cod.ok) throw new Error("no order");
    expect(await service.startPayment({ orderNumber: cod.orderNumber, idempotencyKey: randomUUID(), ...mpesa })).toEqual({ ok: false, reason: "invalid" });
    const { orderNumber } = await onlineOrder("mobile_money");
    expect(await service.startPayment({ orderNumber, idempotencyKey: randomUUID(), ...mpesa, walletProvider: "halopesa" })).toEqual({
      ok: false,
      reason: "wallet_unavailable",
    });
    expect(await service.startPayment({ orderNumber, idempotencyKey: randomUUID(), ...mpesa, method: "bank_transfer" as never })).toEqual({
      ok: false,
      reason: "method_unavailable",
    });
    expect(await service.startPayment({ orderNumber: "TZ-000000-NOTHERE1", idempotencyKey: randomUUID(), ...mpesa })).toEqual({ ok: false, reason: "not_found" });
    // Tanzania's real policy has no online method yet.
    const live = createPaymentService({ policy: getPaymentPolicy("TZ"), gateway: new StandInGateway(), store: databasePaymentStore(t.db) });
    expect(await live.startPayment({ orderNumber, idempotencyKey: randomUUID(), ...mpesa })).toEqual({ ok: false, reason: "method_unavailable" });
  });

  it("a card payment continues on the gateway's hosted page", async () => {
    const { gateway, service } = setup();
    gateway.nextInitiate = { kind: "accepted", status: "pending", gatewayReference: "GW-CARD", redirectUrl: "https://gateway.example.test/pay/1" };
    const { orderNumber } = await onlineOrder("card");
    expect(await service.startPayment({ orderNumber, idempotencyKey: randomUUID(), method: "card", walletProvider: null, payerPhone: null, returnUrl: "https://tronic.example.test/checkout/return" })).toMatchObject({
      ok: true,
      next: "redirect",
      url: "https://gateway.example.test/pay/1",
      payment: { method: "card", walletProvider: null },
    });
    expect(gateway.initiated[0]).toMatchObject({ walletProvider: null, payerPhone: null });
  });
});

describe("gateway answers", () => {
  it("a declined prompt fails the payment, and the customer can try again", async () => {
    const { gateway, service } = setup();
    const { orderNumber } = await onlineOrder("mobile_money");
    gateway.nextInitiate = { kind: "declined", failureCode: "invalid_number" };
    const declined = await service.startPayment({ orderNumber, idempotencyKey: randomUUID(), ...mpesa });
    expect(declined).toMatchObject({ ok: false, reason: "declined", failureCode: "invalid_number", payment: { status: "failed" } });
    expect(await order(orderNumber)).toEqual({ status: "pending_payment", payment_status: "failed" });

    gateway.nextInitiate = { kind: "accepted", status: "pending", gatewayReference: null, redirectUrl: null };
    const retry = await service.startPayment({ orderNumber, idempotencyKey: randomUUID(), ...mpesa });
    expect(retry).toMatchObject({ ok: true, payment: { status: "pending" } });
    expect(await order(orderNumber)).toEqual({ status: "pending_payment", payment_status: "pending" });
    if (!retry.ok) throw new Error("no retry");
    expect(await service.handleWebhook(webhook({ reference: retry.payment.reference, status: "cancelled", failureCode: "customer_cancelled" }))).toMatchObject({
      httpStatus: 200,
      result: { ok: true, payment: { status: "cancelled" }, orderPaymentStatus: "failed" },
    });
  });

  it("ignores unsigned and wrongly signed webhooks, and refuses a wrong amount, currency or reference", async () => {
    const { service } = setup();
    const { orderNumber, totalMinor } = await onlineOrder("mobile_money");
    const started = await service.startPayment({ orderNumber, idempotencyKey: randomUUID(), ...mpesa });
    if (!started.ok) throw new Error("not started");
    const reference = started.payment.reference;
    const good = { reference, status: "successful" as const, amountMinor: totalMinor, currency: "TZS" };

    expect(await service.handleWebhook(webhook(good, randomBytes(32)))).toEqual({ httpStatus: 401, result: null });
    expect(await service.handleWebhook({ headers: new Headers(), rawBody: JSON.stringify(good) })).toEqual({ httpStatus: 401, result: null });
    expect(await service.handleWebhook(webhook({ ...good, amountMinor: 100 }))).toMatchObject({ httpStatus: 422, result: { ok: false, code: "amount_mismatch" } });
    expect(await service.handleWebhook(webhook({ ...good, currency: "KES" }))).toMatchObject({ httpStatus: 422, result: { code: "amount_mismatch" } });
    expect(await service.handleWebhook(webhook({ ...good, amountMinor: null }))).toMatchObject({ httpStatus: 422, result: { code: "amount_missing" } });
    expect(await service.handleWebhook(webhook({ ...good, gatewayReference: "GW-SOMEONE-ELSE" }))).toMatchObject({ httpStatus: 422, result: { code: "reference_mismatch" } });
    expect(await service.handleWebhook(webhook({ ...good, reference: "TZP-000000000000" }))).toMatchObject({ httpStatus: 404 });
    expect(await order(orderNumber)).toEqual({ status: "pending_payment", payment_status: "pending" });

    // Every refusal is on record, with codes only.
    const rejected = await t.db.query<{ detail: string }>(
      `select e.detail from payment_events e join payments p on p.id = e.payment_id where p.reference = $1 and e.outcome = 'rejected' order by e.id`,
      [reference],
    );
    expect(rejected.map((row) => row.detail)).toEqual(["amount_mismatch", "amount_mismatch", "amount_missing", "reference_mismatch"]);

    // A finished payment cannot go back.
    await service.handleWebhook(webhook(good));
    expect(await service.handleWebhook(webhook({ reference, status: "failed" }))).toMatchObject({ httpStatus: 422, result: { code: "invalid_transition", status: "successful" } });
    expect(await service.handleWebhook(webhook({ reference, status: "refunded", amountMinor: totalMinor, currency: "TZS" }))).toMatchObject({
      httpStatus: 200,
      result: { payment: { status: "refunded" }, orderPaymentStatus: "refunded" },
    });
  });

  it("a payment for an order cancelled meanwhile is recorded and flagged for a refund", async () => {
    const { service } = setup();
    const { orderNumber, totalMinor } = await onlineOrder("mobile_money");
    const started = await service.startPayment({ orderNumber, idempotencyKey: randomUUID(), ...mpesa });
    if (!started.ok) throw new Error("not started");
    await t.db.query(`update orders set status = 'cancelled' where order_number = $1`, [orderNumber]);
    expect(await service.handleWebhook(webhook({ reference: started.payment.reference, status: "successful", amountMinor: totalMinor, currency: "TZS" }))).toMatchObject({
      result: { ok: true, orderStatus: "cancelled", orderPaymentStatus: "paid", notice: "order_cancelled_refund_needed" },
    });
  });
});

describe("lost answers and expiry", () => {
  it("a timed-out request is not a failure: a status check settles it later", async () => {
    const { gateway, service } = setup();
    const { orderNumber, totalMinor } = await onlineOrder("mobile_money");
    gateway.nextInitiate = "timeout";
    const started = await service.startPayment({ orderNumber, idempotencyKey: randomUUID(), ...mpesa });
    expect(started).toMatchObject({ ok: true, next: "unknown", payment: { status: "not_initiated" } });
    if (!started.ok) throw new Error("not started");
    const reference = started.payment.reference;

    expect(await service.reconcile(reference)).toMatchObject({ outcome: "still_waiting" });
    gateway.statuses.set(reference, { found: true, status: "successful", eventId: "evt-1", gatewayReference: "GW-LATE", amountMinor: totalMinor, currency: "TZS", failureCode: null });
    expect(await service.reconcile(reference)).toMatchObject({ outcome: "settled", payment: { status: "successful", gatewayReference: "GW-LATE" } });
    expect(await order(orderNumber)).toEqual({ status: "confirmed", payment_status: "paid" });
    expect(await service.reconcile(reference)).toMatchObject({ outcome: "done" });
  });

  it("expires a payment past its time only when the gateway has no record of it", async () => {
    const { gateway, service } = setup();
    const { orderNumber } = await onlineOrder("mobile_money");
    const started = await service.startPayment({ orderNumber, idempotencyKey: randomUUID(), ...mpesa });
    if (!started.ok) throw new Error("not started");
    const reference = started.payment.reference;
    await t.db.query(`update payments set expires_at = now() - interval '1 minute' where reference = $1`, [reference]);

    // The gateway still has it in progress: not expired, still waiting.
    gateway.statuses.set(reference, { found: true, status: "processing", eventId: null, gatewayReference: null, amountMinor: null, currency: null, failureCode: null });
    expect(await service.reconcileDue()).toEqual([expect.objectContaining({ reference, outcome: "still_waiting" })]);
    // Processing payments are never expired locally.
    expect(await service.reconcileDue()).toEqual([]);
    gateway.statuses.set(reference, { found: true, status: "expired", eventId: null, gatewayReference: null, amountMinor: null, currency: null, failureCode: "expired" });
    expect(await service.reconcile(reference)).toMatchObject({ outcome: "settled", payment: { status: "expired" } });

    const second = await service.startPayment({ orderNumber, idempotencyKey: randomUUID(), ...mpesa });
    if (!second.ok) throw new Error("not started");
    await t.db.query(`update payments set expires_at = now() - interval '1 minute' where reference = $1`, [second.payment.reference]);
    expect(await service.reconcile(second.payment.reference)).toMatchObject({ outcome: "expired", payment: { status: "expired" } });
    expect(await order(orderNumber)).toEqual({ status: "pending_payment", payment_status: "failed" });
  });
});

describe("who can see payments", () => {
  it("a customer sees the payments of their own orders, without the event log; nobody else sees them", async () => {
    const { service } = setup();
    const own = await onlineOrder("mobile_money", { role: "authenticated", userId: alice }, "alice@example.test");
    const started = await service.startPayment({ orderNumber: own.orderNumber, idempotencyKey: randomUUID(), ...mpesa });
    if (!started.ok) throw new Error("not started");

    const asAlice = await withAccess(t.db, { role: "authenticated", userId: alice }, (tx) =>
      tx.query<{ reference: string; status: string }>(`select reference, status, amount_minor, currency from payments`),
    );
    expect(asAlice).toEqual([expect.objectContaining({ reference: started.payment.reference, status: "pending" })]);
    expect(await withAccess(t.db, { role: "authenticated", userId: bob }, (tx) => tx.query(`select reference from payments`))).toEqual([]);

    const refused = async (access: Access, sql: string) => {
      try {
        await withAccess(t.db, access, (tx) => tx.query(sql));
        return "allowed";
      } catch (error) {
        return error instanceof Error && /permission denied/.test(error.message) ? "denied" : String(error);
      }
    };
    const aliceAccess: Access = { role: "authenticated", userId: alice };
    expect(await refused(aliceAccess, `select payer_phone from payments`)).toBe("denied");
    expect(await refused(aliceAccess, `select * from payment_events`)).toBe("denied");
    expect(await refused(ANON, `select reference from payments`)).toBe("denied");
    expect(await refused(aliceAccess, `update payments set status = 'successful'`)).toBe("denied");
    expect(await refused(aliceAccess, `select payment_apply_update('x', 'test_gateway', 'webhook', null, 'successful', null, 1, 'TZS', null)`)).toBe("denied");
    expect(await refused(ANON, `select payment_start('TZ', 'x', 'card', 'test_gateway', null, null, gen_random_uuid(), now() + interval '1 hour')`)).toBe("denied");
  });
});
