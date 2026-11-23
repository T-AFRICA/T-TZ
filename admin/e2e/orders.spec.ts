import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { PORTS } from "./ports";
import { adminSql, countrySql, expectRefused, newSession, sideways, signIn, signInWithCode } from "./support/helpers";
import { ACCOUNTS } from "./support/stack";

/**
 * Orders, end to end on this machine: the admin console in a real browser,
 * its signed requests to the stand-in for Tanzania's backend
 * (support/country.ts: the same handler the storefront serves, in front of
 * a disposable country database), and that database's own order rules.
 *
 * Runs after console.spec.ts and shares its test databases: Tanzania's
 * service is still registered at the dead address that test left behind.
 * The orders are synthetic (support/country.ts).
 */
const SHOTS = path.join(process.cwd(), "test-results", "orders");
const COUNTRY = `https://127.0.0.1:${PORTS.country}`;
const ORDERS = "/c/tz/orders";

test.beforeAll(() => {
  mkdirSync(SHOTS, { recursive: true });
});

const orderRows = (page: Page) => page.getByRole("table", { name: "Orders" }).locator("tbody tr");

async function orderNumberOf(name: string): Promise<string> {
  const [row] = await countrySql<{ order_number: string }>(`select order_number from orders where contact_name = $1`, [name]);
  return row!.order_number;
}

async function stockOf(slug: string): Promise<number> {
  const [row] = await countrySql<{ available: number }>(
    `select s.available from stock_levels s join products p on p.id = s.product_id where p.slug = $1 and s.country_code = 'TZ'`,
    [slug],
  );
  return row!.available;
}

/** Opens the confirm dialog of a "next step" button and confirms it, with an optional note. */
async function takeStep(page: Page, button: string, note?: string) {
  await page.getByRole("region", { name: "Next step" }).getByRole("button", { name: button }).click();
  const dialog = page.getByRole("dialog");
  if (note) await dialog.getByLabel(/optional, internal/).fill(note);
  await dialog.getByRole("button", { name: button }).click();
}

test("while the country cannot be reached, Orders says so and shows nothing", async ({ page }) => {
  await signIn(page, ACCOUNTS.tzOrders);
  await page.goto(ORDERS);
  await expect(page.getByRole("heading", { level: 1, name: "Orders" })).toBeVisible();
  await expect(page.getByText("Tanzania's orders cannot be shown right now")).toBeVisible();
  await expect(page.getByText("The country service could not be reached.")).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  // An Order Manager cannot see or change the service registration.
  await expect(page.getByRole("link", { name: "Service connection" })).toHaveCount(0);
});

test("Master Super Admin connects Tanzania and the signed connection check passes", async ({ page }) => {
  await signInWithCode(page, ACCOUNTS.master);
  await page.goto("/c/tz/settings");
  await page.getByLabel("Country API address").fill(COUNTRY);
  await page.getByLabel("Allow the Central Admin to call this service").check();
  await page.getByRole("button", { name: "Save registration" }).click();
  await expect(page.getByText("Service registration saved.").first()).toBeVisible();

  await page.getByRole("button", { name: "Check connection" }).click();
  await expect(page.getByText(/Tanzania's service answered in \d+ ms\. Orders are connected\./).first()).toBeVisible();
  const [check] = await adminSql<{ ok: boolean; status_code: number }>(
    `select ok, status_code from country_health_checks where country_id = 'tz' order by id desc limit 1`,
  );
  expect(check).toEqual({ ok: true, status_code: 200 });
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Countries" }).getByRole("row").filter({ hasText: "Tanzania" })).toContainText("Connected");

  // A second person for a later test: Customer Support may read orders, not change them.
  await page.goto("/c/tz/staff");
  await page.getByLabel("Email address", { exact: true }).fill(ACCOUNTS.stranger);
  await page.getByLabel("Role", { exact: true }).selectOption({ label: "Customer Support" });
  await page.getByRole("button", { name: "Give role" }).click();
  await expect(page.getByText(/Invitation recorded\. stranger@example\.test gets the Customer Support role/).first()).toBeVisible();
});

test("Order Manager lists, searches and opens Tanzania's orders", async ({ page }) => {
  await signIn(page, ACCOUNTS.tzOrders);
  await page.goto(ORDERS);
  await expect(orderRows(page)).toHaveCount(4);
  const chips = page.getByRole("navigation", { name: "Order status" });
  await expect(chips.getByRole("link", { name: /^All/ })).toHaveText(/All\s*4/);
  await expect(chips.getByRole("link", { name: /^Awaiting confirmation/ })).toHaveText(/Awaiting confirmation\s*4/);
  await expect(chips.getByRole("link", { name: /^Delivered/ })).toHaveText(/Delivered\s*0/);
  // Amounts are the country's own, in its own currency: 2 x TZS 28,000 and 3 x TZS 18,500.
  await expect(orderRows(page).filter({ hasText: "Asha Mrema" })).toContainText("TZS 56,000");
  await expect(orderRows(page).filter({ hasText: "Baraka Juma" })).toContainText("TZS 55,500");
  await page.screenshot({ path: path.join(SHOTS, "orders-list.png"), fullPage: true });

  await page.getByRole("search").getByRole("searchbox").fill("baraka");
  await page.getByRole("search").getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/\/c\/tz\/orders\?q=baraka$/);
  await expect(orderRows(page)).toHaveCount(1);
  await page.goto(`${ORDERS}?status=delivered`);
  await expect(page.getByText("No orders match")).toBeVisible();
  // A status that does not exist is ignored, not passed on.
  await page.goto(`${ORDERS}?status=shipped`);
  await expect(orderRows(page)).toHaveCount(4);

  const asha = await orderNumberOf("Asha Mrema");
  await orderRows(page).filter({ hasText: "Asha Mrema" }).getByRole("link", { name: asha }).click();
  await expect(page).toHaveURL(new RegExp(`/c/tz/orders/${asha}$`));
  await expect(page.getByRole("heading", { level: 1, name: `Order ${asha}` })).toBeVisible();
  await expect(page.getByRole("region", { name: "Customer" })).toContainText("asha@example.test");
  await expect(page.getByRole("region", { name: "Customer" })).toContainText("+255712000001");
  await expect(page.getByRole("region", { name: "Customer" })).toContainText("WhatsApp / phone");
  await expect(page.getByRole("region", { name: "Customer" }).getByRole("link", { name: "Message on WhatsApp" })).toHaveAttribute("href", "https://wa.me/255712000001");
  await expect(page.getByRole("region", { name: "Delivery and payment" })).toContainText("Cash on Delivery · Payment pending");
  await expect(page.getByRole("region", { name: "Items" })).toContainText("24W LED Panel Light");
  await expect(page.getByRole("region", { name: "Items" })).toContainText("TZS 56,000");

  // An order that does not exist looks like any page that does not exist.
  await expectRefused(page, `${ORDERS}/TZ-000000-ABCDEF12`);
  await expectRefused(page, `${ORDERS}/not-an-order`);
});

test("Order Manager moves an order step by step; the country, the customer's tracking and the audit log follow", async ({ page }) => {
  await signIn(page, ACCOUNTS.tzOrders);
  const asha = await orderNumberOf("Asha Mrema");
  await page.goto(`${ORDERS}/${asha}`);
  const next = page.getByRole("region", { name: "Next step" });
  // Only the next step and a cancellation are on offer.
  await expect(next.getByRole("button")).toHaveText(["Confirm order", "Cancel order"]);

  await takeStep(page, "Confirm order", "Stock checked by phone");
  await expect(page.getByText(`Order ${asha} is now "Confirmed".`).first()).toBeVisible();
  await expect(next.getByRole("button")).toHaveText(["Start processing", "Cancel order"]);
  const history = page.getByRole("list", { name: "Order history" });
  await expect(history).toContainText("Awaiting confirmation → Confirmed");
  await expect(history).toContainText("You");
  await expect(history).toContainText("Stock checked by phone");

  // The change is in Tanzania's own database, made by this administrator.
  const [manager] = await adminSql<{ user_id: string }>(`select user_id from admin_profiles where email = $1`, [ACCOUNTS.tzOrders]);
  expect(await countrySql(`select o.status, e.from_status, e.to_status, e.note, e.actor_id from orders o join order_status_events e on e.order_id = o.id where o.order_number = $1`, [asha])).toEqual([
    { status: "confirmed", from_status: "pending_payment", to_status: "confirmed", note: "Stock checked by phone", actor_id: manager!.user_id },
  ]);
  // And in the Central Admin's audit log.
  const [logged] = await adminSql<{ action: string; actor_email: string; country_id: string; target_id: string; summary: Record<string, unknown> }>(
    `select action, actor_email, country_id, target_id, summary from audit_logs order by id desc limit 1`,
  );
  expect(logged).toMatchObject({ action: "order.status_change", actor_email: ACCOUNTS.tzOrders, country_id: "tz", target_id: asha });
  expect(logged!.summary).toMatchObject({ from: "pending_payment", to: "confirmed" });

  await takeStep(page, "Start processing");
  await expect(next.getByRole("button")).toHaveText(["Mark as packed", "Cancel order"]);
  await takeStep(page, "Mark as packed");
  await expect(next.getByRole("button")).toHaveText(["Mark as dispatched", "Cancel order"]);
  await expect(page.locator("main").getByText("Packed", { exact: true }).first()).toBeVisible();

  // What the customer gets from order tracking (number plus the email used at checkout).
  const [tracked] = await countrySql<{ result: { found: boolean; status: string } }>(`select track_order($1, 'asha@example.test') as result`, [asha]);
  expect(tracked!.result).toMatchObject({ found: true, status: "packed" });

  await takeStep(page, "Mark as dispatched");
  // Once dispatched, cancelling is no longer offered.
  await expect(next.getByRole("button")).toHaveText(["Mark as in transit"]);
  await takeStep(page, "Mark as in transit");
  await takeStep(page, "Mark as delivered");
  await expect(next).toContainText("This order is finished.");
  await expect(next.getByRole("button")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Delivery and payment" })).toContainText("Cash on Delivery · Paid");
  await page.screenshot({ path: path.join(SHOTS, "order-delivered.png"), fullPage: true });
  expect(await countrySql(`select status, payment_status from orders where order_number = $1`, [asha])).toEqual([{ status: "delivered", payment_status: "paid" }]);

  // Internal note: stored in the country, never part of what tracking returns.
  await page.getByLabel("Add an internal note").fill("Customer asked for a stamped invoice.");
  await page.getByRole("button", { name: "Add note" }).click();
  await expect(page.getByRole("list", { name: "Internal notes" })).toContainText("Customer asked for a stamped invoice.");
  await page.getByRole("button", { name: "Add note" }).click();
  await expect(page.getByText("Write the note first")).toBeVisible();
  const [again] = await countrySql<{ result: Record<string, unknown> }>(`select track_order($1, 'asha@example.test') as result`, [asha]);
  expect(JSON.stringify(again!.result)).not.toContain("stamped invoice");
});

test("cancelling an order puts its stock back, once", async ({ page }) => {
  // A Country Super Admin holds orders.update too.
  await signInWithCode(page, ACCOUNTS.tzSuper);
  const baraka = await orderNumberOf("Baraka Juma");
  const before = await stockOf("sample-top-plug");

  await page.goto(`${ORDERS}/${baraka}`);
  await page.getByRole("region", { name: "Next step" }).getByRole("button", { name: "Cancel order" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("its stock becomes available again");
  await dialog.getByLabel(/Reason/).fill("Customer changed their mind");
  await dialog.getByRole("button", { name: "Cancel order" }).click();
  await expect(page.getByText(`Order ${baraka} cancelled. Its stock is available again.`).first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Next step" })).toContainText("This order is finished.");
  expect(await stockOf("sample-top-plug")).toBe(before + 3);

  await page.goto(`${ORDERS}?status=cancelled`);
  await expect(orderRows(page)).toHaveCount(1);
  await expect(orderRows(page)).toContainText("Baraka Juma");
  await expect(page.getByRole("navigation", { name: "Order status" }).getByRole("link", { name: /^Cancelled/ })).toHaveText(/Cancelled\s*1/);
  await page.screenshot({ path: path.join(SHOTS, "orders-cancelled.png"), fullPage: true });
});

test("Customer Support reads orders but cannot change them; another country's admin cannot reach them at all", async ({ page, browser }) => {
  // The invitation from the earlier test becomes a role at first sign-in.
  await signIn(page, ACCOUNTS.stranger);
  await page.goto(ORDERS);
  await expect(orderRows(page)).toHaveCount(4);
  const neema = await orderNumberOf("Neema Kessy");
  await page.goto(`${ORDERS}/${neema}`);
  await expect(page.getByRole("region", { name: "Next step" })).toContainText("Your role can see orders but not change them.");
  await expect(page.getByRole("region", { name: "Next step" }).getByRole("button")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add note" })).toHaveCount(0);
  expect(await countrySql(`select status from orders where order_number = $1`, [neema])).toEqual([{ status: "pending_payment" }]);

  // Kenya's Super Admin: Tanzania's orders do not exist for them, and Kenya has no service yet.
  const kenya = await newSession(browser);
  await signInWithCode(kenya, ACCOUNTS.keSuper);
  await expectRefused(kenya, ORDERS);
  await expectRefused(kenya, `${ORDERS}/${neema}`);
  await kenya.goto("/c/ke/orders");
  await expect(kenya.getByText("Kenya's orders cannot be shown right now")).toBeVisible();
  await expect(kenya.getByText("No service address is registered for this country.")).toBeVisible();
  await kenya.context().close();
  const refusals = await adminSql<{ n: number }>(
    `select count(*)::int as n from security_events e join admin_profiles p on p.user_id = e.actor_id
      where p.email = $1 and e.kind = 'country_denied' and e.country_id = 'tz'`,
    [ACCOUNTS.keSuper],
  );
  expect(refusals[0]!.n).toBeGreaterThanOrEqual(2);
});

test("orders fit a phone screen", async ({ browser }) => {
  const page = await newSession(browser, 375, 812);
  await signInWithCode(page, ACCOUNTS.tzSuper);
  const asha = await orderNumberOf("Asha Mrema");
  for (const address of [ORDERS, `${ORDERS}/${asha}`]) {
    await page.goto(address);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await sideways(page), address).toBeLessThanOrEqual(1);
  }
  await page.screenshot({ path: path.join(SHOTS, "375-order.png"), fullPage: true });
  await page.context().close();
});

test("the country dashboard counts Tanzania's own orders, sales and stock for a Country Super Admin", async ({ page }) => {
  await signInWithCode(page, ACCOUNTS.tzSuper);
  await page.goto("/c/tz");
  await expect(page.getByRole("heading", { level: 1, name: "Tanzania" })).toBeVisible();
  await expect(page.getByText("Unavailable", { exact: true })).toHaveCount(0);
  // From the earlier tests: four orders, Asha's delivered and paid (TZS 56,000), Baraka's cancelled.
  await expect(page.getByRole("link", { name: /^Orders\s*4\b/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Open orders\s*2\b/ })).toBeVisible();
  await expect(page.getByText("TZS 56,000", { exact: true })).toBeVisible();
  await expect(page.getByText("Products on sale")).toBeVisible();
  await expect(page.getByText("Stock to refill")).toBeVisible();
  await page.screenshot({ path: path.join(SHOTS, "country-dashboard.png"), fullPage: true });
  // A module whose part of the country API does not exist yet says that, and shows no sample rows.
  await page.goto("/c/tz/content");
  await expect(page.getByRole("heading", { level: 1, name: "Website content" })).toBeVisible();
  await expect(page.getByText("Website content for Tanzania cannot be shown yet")).toBeVisible();
  await expect(page.getByText(/service is connected, but the website content part of the country API has not been built yet/)).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);

  // Customer Support has no reports: the figures say so instead of showing numbers.
  // (Not the Order Manager: sign-ins per address are limited, and later tests need theirs.)
  const manager = await newSession(page.context().browser()!);
  await signIn(manager, ACCOUNTS.stranger);
  await manager.goto("/c/tz");
  await expect(manager.getByText("Your role does not include the country's reports.").first()).toBeVisible();
  // Customer Support reads the customer directory from the country.
  await manager.goto("/c/tz/customers");
  await expect(manager.getByRole("heading", { level: 1, name: "Customers" })).toBeVisible();
  await expect(manager.getByText(/cannot be shown right now/)).toHaveCount(0);
  await expect(manager.getByRole("region", { name: /customers?$/ })).toBeVisible();
  await manager.context().close();
});
