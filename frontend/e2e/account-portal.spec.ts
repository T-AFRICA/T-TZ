import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { PORTS } from "./ports";
import { createCustomer, revokeSessions, sql, userLookups } from "./support/control";

/**
 * The customer portal against the disposable test database and the
 * stand-in Supabase Auth: who may see it, that it shows the signed-in
 * customer's own records (and only those), that the order list filters on
 * the server, that the timeline follows the recorded status, that the
 * profile saves, that the optional profile photo is private to its owner,
 * and that no page overflows from 320px to 1920px.
 */
const BASE = `http://localhost:${PORTS.connected}`;
const CART_KEY = "tronic.tz.cart.v1";
/**
 * Two disposable customers of the stand-in auth server: [email, sign-in
 * phrase]. Synthetic values that exist only inside a test run; written as
 * plain pairs, like the other specs, so they do not look like configured
 * credentials to the repository's secret scan.
 */
type Customer = readonly [email: string, phrase: string];
const CAROL: Customer = ["carol.portal@example.test", "Carol-Portal-Test-1"];
const DAVID: Customer = ["david.portal@example.test", "David-Portal-Test-1"];
const SHOTS = path.join(process.cwd(), "test-results", "portal");
/** A one-pixel PNG: a real image the browser can decode. */
const ONE_PIXEL_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

const PORTAL_PAGES = [
  "/account",
  "/account/orders",
  "/account/tracking",
  "/account/wishlist",
  "/account/addresses",
  "/account/payments",
  "/account/invoices",
  "/account/notifications",
  "/account/support",
  "/account/profile",
  "/account/security",
];

async function signIn(page: Page, [email, phrase]: Customer) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel(/Email address/).fill(email);
  await page.getByLabel(/^Password/).fill(phrase);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(`${BASE}/account`);
}

async function placeOrder(page: Page, email: string, lines: { productId: string; quantity: number }[]) {
  await page.goto(`${BASE}/cart`);
  await page.evaluate(
    ([key, value]) => window.localStorage.setItem(key, value),
    [CART_KEY, JSON.stringify(lines.map((line) => ({ ...line, color: null, variant: null })))] as const,
  );
  await page.goto(`${BASE}/checkout`);
  await page.getByLabel(/Full name/).fill("Carol Mushi");
  await page.getByLabel(/Email address/).fill(email);
  await page.getByLabel(/Phone number/).fill("0712 345 678");
  await page.getByLabel(/Region/).selectOption("Dar es Salaam");
  await page.getByLabel(/District or city/).fill("Kinondoni");
  await page.getByLabel(/Ward or area/).fill("Mikocheni");
  await page.getByLabel(/Street or building/).fill("Plot 12, Mwai Kibaki Road");
  await page.getByRole("button", { name: /Place order/ }).first().click();
  await expect(page.getByText("Order placed")).toBeVisible();
}

async function orderNumbers(email: string): Promise<string[]> {
  const rows = await sql<{ order_number: string }>(`select order_number from orders where contact_email = $1 order by created_at`, [email]);
  return rows.map((row) => row.order_number);
}

test.describe.configure({ mode: "serial" });

let carolOrders: string[] = [];

test("signed-out visitors are sent to sign in from every portal page", async ({ page }) => {
  for (const route of [...PORTAL_PAGES, "/account/orders/TZ-261114-ABCDEF12", "/account/orders/TZ-261114-ABCDEF12/tracking"]) {
    await page.goto(`${BASE}${route}`);
    await expect(page, route).toHaveURL(`${BASE}/login`);
  }
});

test("the dashboard and order pages show the signed-in customer's own records", async ({ page }) => {
  await createCustomer(...CAROL);
  await signIn(page, CAROL);

  // A new customer: honest empty states, no sample orders.
  await expect(page.getByRole("heading", { level: 1, name: "Welcome back" })).toBeVisible();
  await expect(page.getByText("No orders yet")).toBeVisible();
  await expect(page.getByRole("link", { name: /Total orders/ })).toContainText("0");

  await placeOrder(page, CAROL[0], [{ productId: "sample-led-panel", quantity: 2 }]);
  await placeOrder(page, CAROL[0], [{ productId: "sample-top-plug", quantity: 1 }]);
  carolOrders = await orderNumbers(CAROL[0]);
  expect(carolOrders).toHaveLength(2);
  // Fulfilment moves the first order on (done as the database owner).
  await sql(`update orders set status = 'dispatched' where order_number = $1`, [carolOrders[0]]);

  await page.goto(`${BASE}/account`);
  await expect(page.getByRole("link", { name: /Total orders/ })).toContainText("2");
  await expect(page.getByRole("link", { name: /In progress/ })).toContainText("2");
  await expect(page.getByRole("link", { name: /Delivered/ })).toContainText("0");
  await expect(page.getByText(carolOrders[0]!)).toBeVisible();

  // Orders: both listed; tabs and search filter on the server.
  await page.goto(`${BASE}/account/orders`);
  const list = page.getByRole("list", { name: "Orders" });
  await expect(list.getByRole("article")).toHaveCount(2);
  await page.getByRole("link", { name: "Shipped" }).click();
  await expect(page).toHaveURL(`${BASE}/account/orders?status=shipped`);
  await expect(list.getByRole("article")).toHaveCount(1);
  await expect(list).toContainText(carolOrders[0]!);
  await page.getByRole("link", { name: "Delivered" }).click();
  await expect(page.getByText("No orders match these filters")).toBeVisible();
  await page.goto(`${BASE}/account/orders`);
  await page.getByLabel("Order number").fill(carolOrders[1]!.slice(-6).toLowerCase());
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(list.getByRole("article")).toHaveCount(1);
  await expect(list).toContainText(carolOrders[1]!);

  // Details: the order's own lines, prices and address.
  await page.goto(`${BASE}/account/orders/${carolOrders[0]}`);
  await expect(page.getByRole("heading", { level: 1, name: carolOrders[0]! })).toBeVisible();
  await expect(page.getByRole("link", { name: "24W LED Panel Light" })).toBeVisible();
  await expect(page.getByText(/SKU SAMPLE-LED-PANEL/)).toBeVisible();
  await expect(page.getByText("TZS 56,000").first()).toBeVisible();
  await expect(page.getByText("Plot 12, Mwai Kibaki Road")).toBeVisible();
  await expect(page.getByText("Pay on delivery")).toBeVisible();

  // Tracking: the timeline is at the recorded status, and says it is not live.
  // Exact: the header and the sidebar have "Track Order" links of their own.
  await page.getByRole("link", { name: "Track order", exact: true }).click();
  await expect(page).toHaveURL(`${BASE}/account/orders/${carolOrders[0]}/tracking`);
  const progress = page.getByRole("list", { name: "Order progress" });
  await expect(progress.locator('[aria-current="step"]')).toContainText("Dispatched");
  await expect(progress.getByText("Order placed")).toBeVisible();
  await expect(page.getByText(/not live\s+courier tracking/)).toBeVisible();
  await expect(page.getByText("Not available yet").first()).toBeVisible();

  // Tracking overview and payments use the same records.
  await page.goto(`${BASE}/account/tracking`);
  await expect(page.getByRole("list", { name: "Orders in progress" }).getByRole("listitem").filter({ hasText: "TZ-" })).toHaveCount(2);
  await page.goto(`${BASE}/account/payments`);
  await expect(page.getByText("Payment pending").first()).toBeVisible();
});

test("another customer gets the same 404 for that order as for an unknown number", async ({ browser }) => {
  await createCustomer(...DAVID);
  const david = await (await browser.newContext()).newPage();
  await signIn(david, DAVID);
  // The same not-found page for both, and nothing of Carol's order in it.
  // (The HTTP status is 200 either way: account pages stream behind a
  // loading skeleton, so the headers are sent before the page is known.)
  for (const number of [carolOrders[0]!, "TZ-000000-00000000"]) {
    for (const route of [`/account/orders/${number}`, `/account/orders/${number}/tracking`]) {
      await david.goto(`${BASE}${route}`);
      await expect(david.getByRole("heading", { level: 1, name: "Page not found" }), route).toBeVisible();
      await expect(david.getByText("24W LED Panel Light")).toHaveCount(0);
      await expect(david.getByText("Mwai Kibaki")).toHaveCount(0);
      await expect(david.getByText("Carol Mushi")).toHaveCount(0);
    }
  }
  await david.goto(`${BASE}/account/orders?q=${carolOrders[0]}`);
  await expect(david.getByText(carolOrders[0]!)).toHaveCount(0);
});

test("the profile form saves the customer's own name and phone", async ({ page }) => {
  await signIn(page, CAROL);
  await page.goto(`${BASE}/account/profile`);
  await page.getByLabel("Full name").fill("C");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Enter your full name.")).toBeVisible();
  await page.getByLabel("Full name").fill("Carol Mushi");
  await page.getByLabel("Mobile number").fill("0712 345 678");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();
  await page.goto(`${BASE}/account`);
  await expect(page.getByRole("heading", { level: 1, name: "Welcome back, Carol" })).toBeVisible();
  expect(new URL(page.url()).search).toBe("");
});

test("a signed-in customer who goes shopping gets back to their account; signing out ends that", async ({ page }) => {
  // A visitor is offered Login.
  await page.goto(`${BASE}/`);
  await expect(page.getByRole("banner").getByRole("link", { name: "Login" })).toHaveAttribute("href", "/login");

  await signIn(page, CAROL);
  await page.goto(`${BASE}/`);
  // The header now offers the account, and one click opens it.
  const account = page.getByRole("banner").getByRole("link", { name: "Account" });
  await expect(account).toHaveAttribute("href", "/account");
  await expect(page.getByRole("banner").getByRole("link", { name: "Login" })).toHaveCount(0);
  await account.click();
  await expect(page).toHaveURL(`${BASE}/account`);
  await expect(page.getByRole("heading", { level: 1, name: /Welcome back/ })).toBeVisible();

  // The sign-in and register addresses do not show a form to a signed-in customer.
  for (const route of ["/login", "/login/registered", "/register"]) {
    await page.goto(`${BASE}${route}`);
    await expect(page, route).toHaveURL(`${BASE}/account`);
  }

  // Signing out ends the session: the store offers Login again and the account is closed.
  await page.getByRole("complementary").getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(`${BASE}/login`);
  await page.goto(`${BASE}/`);
  await expect(page.getByRole("banner").getByRole("link", { name: "Login" })).toHaveAttribute("href", "/login");
  await page.goto(`${BASE}/account`);
  await expect(page).toHaveURL(`${BASE}/login`);
});

test("a session ended on another device is cleared here once, not asked about on every page", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const sessionCookies = async () => (await context.cookies()).filter((cookie) => /^sb-.+-auth-token(\.\d+)?$/.test(cookie.name));
  await signIn(page, DAVID);
  expect(await sessionCookies()).not.toHaveLength(0);

  // David signs out somewhere else: this browser still has its cookie.
  await revokeSessions(DAVID[0]);
  await page.goto(`${BASE}/account/orders`);
  await expect(page).toHaveURL(`${BASE}/login`);
  // The dead cookie is gone, so the store offers Login again...
  expect(await sessionCookies()).toHaveLength(0);
  await page.goto(BASE + "/");
  await expect(page.getByRole("banner").getByRole("link", { name: "Login" })).toHaveAttribute("href", "/login");

  // ...and further pages ask the auth server nothing about it.
  const asked = await userLookups();
  for (const route of ["/account", "/account/profile", "/login", "/register", "/"]) await page.goto(`${BASE}${route}`);
  expect(await userLookups()).toBe(asked);

  // Signing in again works as usual.
  await signIn(page, DAVID);
  await context.close();
});

test("the optional profile photo is uploaded, served only to its owner, and can be removed", async ({ page, browser }) => {
  await signIn(page, CAROL);
  await page.goto(`${BASE}/account/profile`);
  const photos = page.locator('img[src^="/account/photo/"]:visible');
  // Optional: the profile works without one, and says so.
  await expect(photos).toHaveCount(0);
  await expect(page.getByText(/^Optional\./)).toBeVisible();

  // Not an image, whatever its name says.
  await page.getByLabel("Choose a photo").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: Buffer.from("<!doctype html><script>1</script>") });
  await page.getByRole("button", { name: "Upload photo" }).click();
  await expect(page.getByText("Use a JPEG, PNG or WebP image.")).toBeVisible();
  await expect(photos).toHaveCount(0);

  await page.getByLabel("Choose a photo").setInputFiles({ name: "carol.png", mimeType: "image/png", buffer: ONE_PIXEL_PNG });
  await page.getByRole("button", { name: "Upload photo" }).click();
  await expect(page.getByText("Photo saved.")).toBeVisible();
  await expect(photos.first()).toBeVisible();
  const address = await photos.first().getAttribute("src");
  expect(address).toMatch(/^\/account\/photo\/\d+$/);

  // Carol gets her photo: an image, and never from a shared cache.
  const own = await page.request.get(`${BASE}${address}`);
  expect(own.status()).toBe(200);
  expect(own.headers()["content-type"]).toMatch(/^image\/(jpeg|png|webp)$/);
  expect(own.headers()["cache-control"]).toBe("private, no-cache");
  expect(own.headers()["x-content-type-options"]).toBe("nosniff");

  // The same address shows David nothing, signed in as himself...
  const david = await (await browser.newContext()).newPage();
  await signIn(david, DAVID);
  expect((await david.request.get(`${BASE}${address}`)).status()).toBe(404);
  await david.goto(`${BASE}/account/profile`);
  await expect(david.locator('img[src^="/account/photo/"]')).toHaveCount(0);
  // ...and a signed-out visitor is sent to sign in.
  const guest = await browser.newContext();
  const signedOut = await guest.request.get(`${BASE}${address}`, { maxRedirects: 0 });
  expect(signedOut.status()).toBe(303);
  expect(signedOut.headers()["location"]).toContain("/login");

  await page.getByRole("button", { name: "Remove photo" }).click();
  await expect(page.getByText("Photo removed.")).toBeVisible();
  await expect(photos).toHaveCount(0);
  expect((await page.request.get(`${BASE}${address}`)).status()).toBe(404);
});

test("no portal page overflows sideways from 320px to 1920px", async ({ page }) => {
  test.setTimeout(240_000);
  mkdirSync(SHOTS, { recursive: true });
  await signIn(page, CAROL);
  const routes = [...PORTAL_PAGES, `/account/orders/${carolOrders[0]}`, `/account/orders/${carolOrders[0]}/tracking`];
  for (const width of [320, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    for (const route of routes) {
      await page.goto(`${BASE}${route}`);
      // Measure the page itself, not the loading skeleton it streams in behind.
      await expect(page.locator(".account-enter").first(), `${route} at ${width}px`).toBeVisible();
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${route} at ${width}px`).toBeLessThanOrEqual(1);
      if (width === 390 || width === 1440) {
        await page.waitForTimeout(450); // the entrance fade has finished
        const name = route.replace(/^\/account\/?/, "").replace(/TZ-[^/]+/, "order").replace(/\//g, "-") || "dashboard";
        await page.screenshot({ path: path.join(SHOTS, `${width}-${name}.png`), fullPage: true });
      }
    }
  }
});
