import { expect, test, type Page } from "@playwright/test";
import { PORTS } from "./ports";
import { createCustomer, setPriceMinor, setStock, sql, stockOf } from "./support/control";

/**
 * The complete Cash on Delivery flow against the disposable test database:
 * catalogue → cart → checkout → order saved, then the edge cases (price
 * change, stock, duplicate submission) and order privacy between customers.
 * Every check of "saved" reads the database itself.
 */
const BASE = `http://localhost:${PORTS.connected}`;
const PANEL = { slug: "sample-led-panel", name: "24W LED Panel Light", priceMinor: 2_800_000 };
const CART_KEY = "tronic.tz.cart.v1";

interface OrderRow {
  order_number: string;
  user_id: string | null;
  status: string;
  total_minor: string | number;
  contact_email: string;
}

async function ordersFor(email: string): Promise<OrderRow[]> {
  return sql<OrderRow>(
    `select order_number, user_id, status, total_minor, contact_email from orders where contact_email = $1 order by created_at`,
    [email],
  );
}

async function fillCheckout(page: Page, email: string) {
  await page.getByLabel(/Full name/).fill("Asha Mrema");
  await page.getByLabel(/Email address/).fill(email);
  await page.getByLabel(/Phone number/).fill("0712 345 678");
  await page.getByLabel(/Region/).selectOption("Dar es Salaam");
  await page.getByLabel(/District or city/).fill("Kinondoni");
  await page.getByLabel(/Ward or area/).fill("Mikocheni");
  await page.getByLabel(/Street or building/).fill("Plot 12, Mwai Kibaki Road");
}

async function placeOrder(page: Page) {
  await page.getByRole("button", { name: /Place order/ }).first().click();
}

/** Starts at checkout with these cart lines (the cart lives in localStorage). */
async function checkoutWith(page: Page, lines: { productId: string; quantity: number }[]) {
  await page.goto(`${BASE}/cart`);
  await page.evaluate(
    ([key, value]) => window.localStorage.setItem(key, value),
    [CART_KEY, JSON.stringify(lines.map((line) => ({ ...line, color: null, variant: null })))] as const,
  );
  await page.goto(`${BASE}/checkout`);
  await expect(page.getByRole("complementary", { name: "Order summary" })).toBeVisible();
}

/** A registered customer of the stand-in auth server: synthetic values that exist only inside a test run. */
const SHOPPER = ["shopper.flow@example.test", "Shopper-Flow-Test-1"] as const;

async function signIn(page: Page, email: string, phrase: string, landing = `${BASE}/account`) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel(/Email address/).fill(email);
  await page.getByLabel(/^Password/).fill(phrase);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(landing);
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await createCustomer(...SHOPPER);
});

test("signed out, checkout sends the visitor to sign in or register and back; nothing can be ordered without an account", async ({ page }) => {
  const next = `${BASE}/login?next=${encodeURIComponent("/checkout")}`;
  await page.goto(`${BASE}/cart`);
  await page.evaluate(([key, value]) => window.localStorage.setItem(key, value), [CART_KEY, JSON.stringify([{ productId: PANEL.slug, quantity: 1, color: null, variant: null }])] as const);
  await page.goto(`${BASE}/checkout`);
  await expect(page).toHaveURL(next);
  await expect(page.getByText(/Sign in or create an account to place your order/)).toBeVisible();

  // Registration keeps where to go back to: the form, the sign-in link, and the page after it.
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(`${BASE}/register?next=${encodeURIComponent("/checkout")}`);
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", `/login?next=${encodeURIComponent("/checkout")}`);
  await page.getByLabel(/Full name/).fill("Neema Mushi");
  await page.getByLabel(/Email address/).fill("new.flow@example.test");
  await page.getByLabel(/Mobile number/).fill("0712 345 679");
  await page.getByLabel(/^Password/).fill("Register-Flow-Test-1");
  await page.getByLabel(/Confirm password/).fill("Register-Flow-Test-1");
  await page.getByRole("checkbox", { name: /I agree/ }).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(`${BASE}/login/registered?next=${encodeURIComponent("/checkout")}`);
  await expect(page.getByText(/Check your email/)).toBeVisible();

  // Nothing was ordered on the way.
  expect(await sql(`select 1 from orders where contact_email = 'new.flow@example.test'`)).toEqual([]);

  // Signing in returns to checkout with the cart kept and the account's email filled in.
  await page.goto(next);
  await page.getByLabel(/Email address/).fill(SHOPPER[0]);
  await page.getByLabel(/^Password/).fill(SHOPPER[1]);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(`${BASE}/checkout`);
  await expect(page.getByRole("complementary", { name: "Order summary" })).toContainText("TZS 28,000");
  await expect(page.getByLabel(/Email address/)).toHaveValue(SHOPPER[0]);
});

test("a signed-in customer: catalogue → cart → checkout → confirmed order that exists in the database, linked to them", async ({ page }) => {
  const email = "guest.flow@example.test";
  const stockBefore = await stockOf(PANEL.slug);
  await signIn(page, ...SHOPPER);

  // The panel's own subcategory: the Lighting category has more than one page of products.
  await page.goto(`${BASE}/categories/lighting/indoor-lighting/panel-lights`);
  await page.getByRole("link", { name: PANEL.name }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: PANEL.name })).toBeVisible();
  await page.getByRole("button", { name: "Add to Cart" }).first().click();
  await page.goto(`${BASE}/cart`);
  await expect(page.getByText(PANEL.name).first()).toBeVisible();
  await page.getByRole("link", { name: "Proceed to checkout" }).click();
  await expect(page).toHaveURL(`${BASE}/checkout`);

  const summary = page.getByRole("complementary", { name: "Order summary" });
  await expect(summary).toContainText("TZS 28,000");
  await fillCheckout(page, email);
  await placeOrder(page);

  await expect(page.getByText("Order placed")).toBeVisible();
  const confirmation = await page.getByRole("status").filter({ hasText: "Your order number is" }).textContent();
  const orderNumber = /TZ-\d{6}-[0-9A-F]{8}/.exec(confirmation ?? "")?.[0];
  expect(orderNumber).toBeTruthy();
  await expect(page.getByText("TZS 28,000")).toBeVisible();
  expect(new URL(page.url()).search).toBe("");

  const [order] = await ordersFor(email);
  const [account] = await sql<{ id: string }>(`select id from auth.users where email = $1`, [SHOPPER[0]]);
  expect(order).toMatchObject({ order_number: orderNumber, user_id: account!.id, status: "pending_payment" });
  await expect(page.getByRole("link", { name: "Track your order" })).toHaveAttribute("href", `/account/orders/${orderNumber}`);
  expect(Number(order!.total_minor)).toBe(PANEL.priceMinor);
  const lines = await sql<{ product_slug: string; quantity: number; unit_price_minor: string }>(
    `select product_slug, quantity, unit_price_minor from order_lines l join orders o on o.id = l.order_id where o.order_number = $1`,
    [orderNumber],
  );
  expect(lines.map((l) => [l.product_slug, Number(l.quantity), Number(l.unit_price_minor)])).toEqual([[PANEL.slug, 1, PANEL.priceMinor]]);
  expect(await stockOf(PANEL.slug)).toBe(stockBefore - 1);

  // The cart is emptied only after the order is saved.
  expect(await page.evaluate((key) => window.localStorage.getItem(key), CART_KEY)).toBe("[]");
});

test("a price change between quote and order is shown and nothing is saved until confirmed", async ({ page }) => {
  const email = "price.change@example.test";
  await signIn(page, ...SHOPPER);
  try {
    await checkoutWith(page, [{ productId: PANEL.slug, quantity: 2 }]);
    await expect(page.getByRole("complementary", { name: "Order summary" })).toContainText("TZS 56,000");
    await fillCheckout(page, email);
    await setPriceMinor(PANEL.slug, 3_000_000);
    await placeOrder(page);
    await expect(page.getByText(/Prices changed since you opened checkout/)).toContainText("TZS 60,000");
    expect(await ordersFor(email)).toHaveLength(0);
    await expect(page.getByRole("complementary", { name: "Order summary" })).toContainText("TZS 60,000");

    await placeOrder(page);
    await expect(page.getByText("Order placed")).toBeVisible();
    const orders = await ordersFor(email);
    expect(orders).toHaveLength(1);
    expect(Number(orders[0]!.total_minor)).toBe(6_000_000);
  } finally {
    await setPriceMinor(PANEL.slug, PANEL.priceMinor);
  }
});

test("unavailable stock is refused without an order or a stock change", async ({ page }) => {
  const email = "no.stock@example.test";
  await signIn(page, ...SHOPPER);
  const before = await stockOf(PANEL.slug);
  try {
    await checkoutWith(page, [{ productId: PANEL.slug, quantity: 2 }]);
    await fillCheckout(page, email);
    await setStock(PANEL.slug, 1);
    await placeOrder(page);
    await expect(page.getByText(/no longer available in the quantity you chose/)).toBeVisible();
    await expect(page.getByText("Order placed")).toHaveCount(0);
    expect(await ordersFor(email)).toHaveLength(0);
    expect(await stockOf(PANEL.slug)).toBe(1);
  } finally {
    await setStock(PANEL.slug, before);
  }
});

test("a submission whose answer is lost is retried with the same key and saved once", async ({ page }) => {
  const email = "lost.answer@example.test";
  await signIn(page, ...SHOPPER);
  await checkoutWith(page, [{ productId: PANEL.slug, quantity: 1 }]);
  await fillCheckout(page, email);

  // The first Place order reaches the server and is saved, but its answer
  // never reaches the browser (as on a dropped mobile connection).
  let dropped = false;
  await page.route(`${BASE}/checkout`, async (route) => {
    const request = route.request();
    if (!dropped && request.method() === "POST" && request.headers()["next-action"] && (request.postData() ?? "").includes(email)) {
      dropped = true;
      await route.fetch();
      await route.abort("connectionreset");
      return;
    }
    await route.continue();
  });

  await placeOrder(page);
  await expect(page.getByText(/it will not be placed twice/)).toBeVisible();
  expect(await ordersFor(email)).toHaveLength(1);

  await placeOrder(page);
  await expect(page.getByText("Order placed")).toBeVisible();
  const orders = await ordersFor(email);
  expect(orders).toHaveLength(1);
  await expect(page.getByRole("status").filter({ hasText: "Your order number is" })).toContainText(orders[0]!.order_number);
});

test("customers see only their own orders; guests track with number plus contact", async ({ browser }) => {
  await createCustomer("alice.e2e@example.test", "Alice-Secret-1");
  await createCustomer("bob.e2e@example.test", "Bob-Secret-1");

  const alice = await (await browser.newContext()).newPage();
  await signIn(alice, "alice.e2e@example.test", "Alice-Secret-1");
  await checkoutWith(alice, [{ productId: PANEL.slug, quantity: 1 }]);
  await fillCheckout(alice, "alice.e2e@example.test");
  await placeOrder(alice);
  await expect(alice.getByText("Order placed")).toBeVisible();
  const [aliceOrder] = await ordersFor("alice.e2e@example.test");
  expect(aliceOrder!.user_id).not.toBeNull();

  await alice.goto(`${BASE}/account/orders`);
  await expect(alice.getByRole("list", { name: "Orders" })).toContainText(aliceOrder!.order_number);

  const bob = await (await browser.newContext()).newPage();
  await signIn(bob, "bob.e2e@example.test", "Bob-Secret-1");
  await expect(bob.getByText("No orders yet")).toBeVisible();
  await expect(bob.getByText(aliceOrder!.order_number)).toHaveCount(0);

  // A guest with the number but the wrong contact learns nothing.
  const guest = await (await browser.newContext()).newPage();
  await guest.goto(`${BASE}/track-order`);
  await guest.getByLabel(/Order number/).fill(aliceOrder!.order_number);
  await guest.getByLabel(/Phone or email/).fill("bob.e2e@example.test");
  await guest.getByRole("button", { name: "Track order" }).click();
  await expect(guest.getByText(/couldn't find an order/)).toBeVisible();
  await guest.getByLabel(/Phone or email/).fill("alice.e2e@example.test");
  await guest.getByRole("button", { name: "Track order" }).click();
  await expect(guest.getByRole("status").filter({ hasText: "Order " })).toContainText(`Order ${aliceOrder!.order_number}: Pending payment`);
  expect(new URL(guest.url()).search).toBe("");
});

test("a typed quantity above ten goes through the product page, the cart, checkout and the saved order, up to 500 units", async ({ page }) => {
  const email = "bulk.flow@example.test";
  const stockBefore = await stockOf(PANEL.slug);
  await setStock(PANEL.slug, 500);
  try {
    await signIn(page, ...SHOPPER);
    await page.goto(`${BASE}/products/${PANEL.slug}`);
    await expect(page.getByRole("heading", { level: 1, name: PANEL.name })).toBeVisible();

    // The number between − and + can be typed (owner decision 2026-11-21).
    const quantity = page.getByRole("textbox", { name: "Quantity" }).first();
    await quantity.fill("120");
    await quantity.press("Enter");
    await expect(quantity).toHaveValue("120");
    await page.screenshot({ path: "test-results/quantity/product.png" });
    await page.getByRole("button", { name: "Add to Cart" }).first().click();

    await page.goto(`${BASE}/cart`);
    const inCart = page.getByRole("textbox", { name: `Units of ${PANEL.name}` });
    await expect(inCart).toHaveValue("120");
    // Over the limit becomes the limit: 500.
    await inCart.fill("999");
    await inCart.press("Enter");
    await expect(inCart).toHaveValue("500");
    await expect(page.getByRole("group", { name: `Quantity of ${PANEL.name}` }).getByRole("button", { name: "Increase quantity" })).toBeDisabled();
    await page.screenshot({ path: "test-results/quantity/cart.png" });

    await page.getByRole("link", { name: "Proceed to checkout" }).click();
    await expect(page).toHaveURL(`${BASE}/checkout`);
    // 500 × TZS 28,000, priced by the server.
    await expect(page.getByRole("complementary", { name: "Order summary" })).toContainText("TZS 14,000,000");
    await fillCheckout(page, email);
    await placeOrder(page);
    await expect(page.getByText("Order placed")).toBeVisible();

    const [order] = await ordersFor(email);
    expect(Number(order!.total_minor)).toBe(500 * PANEL.priceMinor);
    const lines = await sql<{ quantity: number }>(
      `select l.quantity from order_lines l join orders o on o.id = l.order_id where o.order_number = $1`,
      [order!.order_number],
    );
    expect(lines.map((line) => Number(line.quantity))).toEqual([500]);
    expect(await stockOf(PANEL.slug)).toBe(0);
  } finally {
    await setStock(PANEL.slug, stockBefore);
  }
});
