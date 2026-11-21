import { randomBytes, randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { createServiceTokenSigner, type ServiceTokenSigner } from "@tronic/api-contracts";
import { PORTS } from "./ports";
import { sql, stockOf } from "./support/control";

/**
 * /api/admin/v1 — this country's admin API for the Central Admin, on the
 * real storefront build. Requests are signed here with the private half of
 * a key pair made up for the run (playwright.config.ts gives the storefront
 * the public half), exactly as the Central Admin signs them. The order is
 * synthetic and is cancelled again at the end, so the stock the other
 * tests count on is as it was.
 */
const CONNECTED = `http://localhost:${PORTS.connected}`;
const DISCONNECTED = `http://localhost:${PORTS.disconnected}`;
const API = "/api/admin/v1";
const ADMIN = "5b1f6c5e-3d0a-4a59-9a43-0d2f3f6f1c11";
const EMAIL = "admin.api.e2e@example.test";

let signer: ServiceTokenSigner;

test.beforeAll(async () => {
  const signingPem = process.env.E2E_CENTRAL_ADMIN_PRIVATE ?? "";
  signer = await createServiceTokenSigner({ privateKeyPem: signingPem, keyId: "e2e" });
});

async function call(
  request: APIRequestContext,
  method: "GET" | "POST",
  path: string,
  permission: string,
  body?: unknown,
  options: { base?: string; countryCode?: string } = {},
) {
  const fullPath = `${API}${path}`;
  const text = body === undefined ? "" : JSON.stringify(body);
  const token = await signer.sign({ countryCode: options.countryCode ?? "TZ", actorId: ADMIN, permission, method, path: fullPath, body: text });
  const headers = { authorization: `Bearer ${token}`, ...(text ? { "content-type": "application/json" } : {}) };
  const url = `${options.base ?? CONNECTED}${fullPath}`;
  return method === "GET" ? request.get(url, { headers }) : request.post(url, { headers, data: text });
}

test("the admin API does not exist on a deployment without the Central Admin's key", async ({ request }) => {
  expect((await request.get(`${DISCONNECTED}${API}/health`)).status()).toBe(404);
  expect((await call(request, "GET", "/health", "settings.read", undefined, { base: DISCONNECTED })).status()).toBe(404);
  expect((await call(request, "GET", "/orders", "orders.read", undefined, { base: DISCONNECTED })).status()).toBe(404);
});

test("requests must be signed for this country and for the endpoint's permission", async ({ request, page }) => {
  const unsigned = await request.get(`${CONNECTED}${API}/health`);
  expect(unsigned.status()).toBe(401);
  expect(await unsigned.json()).toEqual({ ok: false, code: "missing_token" });
  expect(unsigned.headers()["cache-control"]).toBe("no-store");
  expect(unsigned.headers()["access-control-allow-origin"]).toBeUndefined();

  expect((await call(request, "GET", "/health", "settings.read", undefined, { countryCode: "KE" })).status()).toBe(401);
  expect((await call(request, "GET", "/orders", "settings.read")).status()).toBe(401);
  expect((await call(request, "GET", "/content", "content.read")).status()).toBe(404);
  expect((await call(request, "GET", "/products", "orders.read")).status()).toBe(401);

  const health = await call(request, "GET", "/health", "settings.read");
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ ok: true, country: "TZ", dataSource: "database", database: true });

  // A browser on this site has no token: the API is not something a page can use.
  await page.goto(`${CONNECTED}/`);
  const fromPage = await page.evaluate(async (address) => (await fetch(address)).status, `${API}/orders`);
  expect(fromPage).toBe(401);
});

test("an order changed through the admin API is what the customer sees when tracking it", async ({ request, page }) => {
  const stockBefore = await stockOf("sample-top-plug");
  const [placed] = await sql<{ result: { ok: boolean; order_number: string } }>(
    `select place_cod_order($1::uuid, 'TZ',
       $2::text::jsonb,
       '{"method":"home","region":"Dar es Salaam","district":"Kinondoni","ward":"Mikocheni","street":"Plot 12, Mwai Kibaki Rd","extra":"","notes":""}'::jsonb,
       '[{"product":"sample-top-plug","color":null,"variant":null,"quantity":1}]'::jsonb, null) as result`,
    [randomUUID(), JSON.stringify({ name: "Admin Api Test", email: EMAIL, phone: "+255712345000" })],
  );
  expect(placed!.result.ok).toBe(true);
  const number = placed!.result.order_number;
  expect(await stockOf("sample-top-plug")).toBe(stockBefore - 1);

  const list = await (await call(request, "GET", `/orders?q=${encodeURIComponent(EMAIL)}`, "orders.read")).json();
  expect(list).toMatchObject({ ok: true, total: 1, orders: [{ orderNumber: number, status: "pending_payment", contactName: "Admin Api Test", currency: "TZS", currencyExponent: 2 }] });

  const detail = await (await call(request, "GET", `/orders/${number}`, "orders.read")).json();
  expect(detail).toMatchObject({ ok: true, order: { orderNumber: number, nextStatuses: ["confirmed", "cancelled"], contact: { email: EMAIL } } });

  // A read permission cannot change the order, and a step cannot be skipped.
  expect((await call(request, "POST", `/orders/${number}/status`, "orders.read", { status: "confirmed" })).status()).toBe(401);
  expect(await (await call(request, "POST", `/orders/${number}/status`, "orders.update", { status: "packed" })).json()).toMatchObject({
    ok: false,
    code: "invalid_transition",
    status: "pending_payment",
  });

  expect(await (await call(request, "POST", `/orders/${number}/status`, "orders.update", { status: "confirmed" })).json()).toMatchObject({
    ok: true,
    replayed: false,
    from: "pending_payment",
    status: "confirmed",
  });
  expect(await (await call(request, "POST", `/orders/${number}/status`, "orders.update", { status: "processing", note: "Picked in the warehouse" })).json()).toMatchObject({
    ok: true,
    status: "processing",
  });
  expect(await (await call(request, "POST", `/orders/${number}/notes`, "orders.update", { body: "Internal: fragile item." })).json()).toEqual({ ok: true, replayed: false });

  // The customer-facing tracking page shows the new status, and none of the internal text.
  await page.goto(`${CONNECTED}/track-order`);
  await page.getByLabel(/Order number/).fill(number);
  await page.getByLabel(/Phone or email/).fill(EMAIL);
  await page.getByRole("button", { name: "Track order" }).click();
  await expect(page.getByText(`Order ${number}: Processing`)).toBeVisible();
  await expect(page.getByText("Picked in the warehouse")).toHaveCount(0);
  await expect(page.getByText("fragile item")).toHaveCount(0);

  // Cancelling puts the unit back in stock.
  expect(await (await call(request, "POST", `/orders/${number}/status`, "orders.update", { status: "cancelled" })).json()).toMatchObject({ ok: true, status: "cancelled" });
  expect(await stockOf("sample-top-plug")).toBe(stockBefore);
  const events = await sql<{ to_status: string; actor_id: string }>(
    `select e.to_status, e.actor_id from order_status_events e join orders o on o.id = e.order_id where o.order_number = $1 order by e.id`,
    [number],
  );
  expect(events).toEqual([
    { to_status: "confirmed", actor_id: ADMIN },
    { to_status: "processing", actor_id: ADMIN },
    { to_status: "cancelled", actor_id: ADMIN },
  ]);
});

test("a rider's delivery goes through this route with a full-size photo and signature; the order number and contact never show the code", async ({ request, page }) => {
  const stockBefore = await stockOf("sample-top-plug");
  const [placed] = await sql<{ result: { ok: boolean; order_number: string; total_minor: number } }>(
    `select place_cod_order($1::uuid, 'TZ',
       $2::text::jsonb,
       '{"method":"home","region":"Dar es Salaam","district":"Ilala","ward":"Upanga","street":"Plot 4, Example Rd","extra":"","notes":""}'::jsonb,
       '[{"product":"sample-top-plug","color":null,"variant":null,"quantity":1}]'::jsonb, null) as result`,
    [randomUUID(), JSON.stringify({ name: "Rider Route Test", email: "rider.route@example.test", phone: "+255712345001" })],
  );
  const number = placed!.result.order_number;
  for (const status of ["confirmed", "processing", "packed"]) {
    expect(await (await call(request, "POST", `/orders/${number}/status`, "orders.update", { status })).json()).toMatchObject({ ok: true, status });
  }
  expect(await (await call(request, "POST", `/orders/${number}/delivery`, "deliveries.assign", { riderId: ADMIN, riderName: "Route Rider" })).json()).toMatchObject({ ok: true });
  expect(await (await call(request, "POST", `/deliveries/${number}/pickup`, "deliveries.perform", {})).json()).toMatchObject({ ok: true, status: "dispatched" });
  expect(await (await call(request, "POST", `/deliveries/${number}/start`, "deliveries.perform", {})).json()).toMatchObject({ ok: true, status: "in_transit" });

  // Tracking with the order number and the checkout email, both of which the
  // rider is shown, gives the status and says where the code is. It never
  // shows the code (security audit 2026-11-21, F-01): that is in the
  // signed-in account only.
  const [{ code }] = (await sql<{ code: string }>(`select d.code from deliveries d join orders o on o.id = d.order_id where o.order_number = $1`, [number])) as [{ code: string }];
  await page.goto(`${CONNECTED}/track-order`);
  await page.getByLabel(/Order number/).fill(number);
  await page.getByLabel(/Phone or email/).fill("rider.route@example.test");
  await page.getByRole("button", { name: "Track order" }).click();
  await expect(page.getByText(new RegExp(`Order ${number}`))).toBeVisible();
  await expect(page.getByText(/The delivery code to give the rider is in your account/)).toBeVisible();
  await expect(page.getByRole("link", { name: "sign in and open the order" })).toHaveAttribute("href", "/account/orders");
  await expect(page.getByRole("heading", { name: "Your delivery code" })).toHaveCount(0);
  await expect(page.getByText(code, { exact: true })).toHaveCount(0);
  expect(await page.content()).not.toContain(code);

  // Other endpoints keep the small limit; only "delivered" may carry the proofs.
  // (A body over the delivery limit is refused from its length before it is
  // read, and the server closes the connection; that is not asserted here.)
  expect((await call(request, "POST", `/orders/${number}/notes`, "orders.update", { body: "x".repeat(20_000) })).status()).toBe(413);

  // A phone photo near the 1 MB limit and a signature, as the admin sends them.
  const proofs = {
    code,
    cashCollectedMinor: placed!.result.total_minor,
    photo: { contentType: "image/jpeg", data: randomBytes(1_000_000).toString("base64") },
    signature: { contentType: "image/png", data: randomBytes(60_000).toString("base64") },
  };
  const delivered = await call(request, "POST", `/deliveries/${number}/deliver`, "deliveries.perform", proofs);
  expect(delivered.status()).toBe(200);
  expect(await delivered.json()).toEqual({ ok: true, replayed: false, status: "delivered", paymentStatus: "paid" });
  expect(await sql(`select p.kind, octet_length(p.bytes) as size from delivery_proofs p join orders o on o.id = p.order_id where o.order_number = $1 order by p.kind`, [number])).toEqual([
    { kind: "photo", size: 1_000_000 },
    { kind: "signature", size: 60_000 },
  ]);

  // The delivered unit is gone from stock; put it back for the other tests.
  await sql(`update stock_levels s set available = available + 1 from products p where p.id = s.product_id and p.slug = 'sample-top-plug' and s.country_code = 'TZ'`);
  expect(await stockOf("sample-top-plug")).toBe(stockBefore);
});

test("a product made through the admin API: its photo stays private as a draft, shows once live, and both go when hidden", async ({ request, page }) => {
  const slug = "admin-api-e2e-bulb";
  const options = (await (await call(request, "GET", "/catalogue/options", "products.read")).json()) as {
    categories: { slug: string; id: string; groups: { id: string; subcategories: { id: string }[] }[] }[];
  };
  const lighting = options.categories.find((category) => category.slug === "lighting")!;
  const group = lighting.groups.find((candidate) => candidate.subcategories.length > 0)!;
  const product = {
    name: "Admin API E2E Bulb",
    sku: "E2E-API-BULB",
    description: "Made by the storefront browser tests.",
    brandId: null,
    categoryId: lighting.id,
    groupId: group.id,
    subcategoryId: group.subcategories[0]!.id,
    variantLabel: null,
    priceMinor: 1_234_500,
    wasPriceMinor: null,
    specifications: [{ label: "Power", value: "9 W" }],
    variants: [],
    colors: [],
  };
  const created = await call(request, "POST", "/products", "products.create", { slug, product });
  expect(await created.json(), `HTTP ${created.status()}`).toEqual({ ok: true, replayed: false, slug, status: "draft" });

  // A real photo, as the admin sends it (base64 of a PNG).
  await page.goto(`${CONNECTED}/`);
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: 320, height: 200 } });
  const added = (await (await call(request, "POST", `/products/${slug}/images`, "products.update", { contentType: "image/png", data: png.toString("base64"), alt: "The bulb" })).json()) as {
    ok: boolean;
    imageId: string;
  };
  expect(added.ok).toBe(true);
  // Not public while it is a draft.
  expect((await request.get(`${CONNECTED}/media/products/${added.imageId}`)).status()).toBe(404);
  // Product pages stream, so the answer is read from the page, not the status code.
  const productHeading = page.getByRole("heading", { level: 1, name: "Admin API E2E Bulb" });
  const shownOnStorefront = async () => {
    await page.goto(`${CONNECTED}/products/${slug}`);
    await page.getByRole("heading", { level: 1 }).first().waitFor();
    return productHeading.count();
  };
  expect(await shownOnStorefront()).toBe(0);

  await call(request, "POST", `/products/${slug}/stock`, "inventory.adjust", { available: 4 });
  expect(await (await call(request, "POST", `/products/${slug}/status`, "products.publish", { publish: true })).json()).toMatchObject({ ok: true, status: "live" });

  const media = await request.get(`${CONNECTED}/media/products/${added.imageId}`);
  expect(media.status()).toBe(200);
  expect(media.headers()["content-type"]).toBe("image/png");
  expect(media.headers()["cache-control"]).toBe("public, max-age=31536000, immutable");
  expect(Buffer.from(await media.body()).equals(png)).toBe(true);

  // The storefront shows it (its catalogue is read again after the change; allow its short cache).
  await expect.poll(shownOnStorefront, { timeout: 25_000, intervals: [1_000, 2_000, 5_000] }).toBe(1);
  await expect(page.getByText("TZS 12,345").first()).toBeVisible();
  const photo = page.locator(`img[src*="${added.imageId}"]`).first();
  await expect(photo).toBeVisible();
  await expect.poll(() => photo.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);

  // Hidden: the page and the photo are gone; the product stays in the database.
  expect(await (await call(request, "POST", `/products/${slug}/status`, "products.publish", { publish: false })).json()).toMatchObject({ ok: true, status: "hidden" });
  expect((await request.get(`${CONNECTED}/media/products/${added.imageId}`)).status()).toBe(404);
  await expect.poll(shownOnStorefront, { timeout: 25_000, intervals: [1_000, 2_000, 5_000] }).toBe(0);
  expect(await sql(`select active from products where slug = $1`, [slug])).toEqual([{ active: false }]);
});
