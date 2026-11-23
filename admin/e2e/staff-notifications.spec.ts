import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { countrySql, newSession, sideways, signIn } from "./support/helpers";
import { ACCOUNTS } from "./support/stack";

/**
 * The notifications of the Central Admin and of the rider's console, end
 * to end on this machine: the bell and its count, the list, "mark all as
 * read", and who sees what. The notifications are the ones the stand-in
 * country's database wrote while the earlier specs ran (orders.spec.ts and
 * rider.spec.ts run before this file): orders placed, Baraka's order
 * cancelled by the Country Super Admin, Juma's order given to the rider and
 * delivered by them.
 *
 * The reader is a second Order Manager (support/stack.ts, tzDesk) who did
 * none of it. That an administrator is not told about their own action is
 * checked in database/client/tests/notifications.test.ts: the accounts who
 * acted have used their sign-in attempts for this run (eight in ten
 * minutes), and the limit is not loosened for a test.
 */
const SHOTS = path.join(process.cwd(), "test-results", "notifications");
const PAGE = "/c/tz/notifications";

test.beforeAll(() => {
  mkdirSync(SHOTS, { recursive: true });
});

async function orderOf(name: string): Promise<string> {
  const [row] = await countrySql<{ order_number: string }>(`select order_number from orders where contact_name = $1`, [name]);
  return row!.order_number;
}

const bell = (page: Page) => page.getByRole("banner").getByRole("link", { name: /^Notifications for Tanzania/ });
const list = (page: Page) => page.getByRole("list", { name: "Notifications" });

test("an Order Manager sees what happened to orders and stock, with a count on the bell, and marks it read", async ({ page, browser }) => {
  const juma = await orderOf("Juma Said");
  const baraka = await orderOf("Baraka Juma");
  // A product reaches its low-stock level and another runs out (done as the country's database owner).
  await countrySql(`update stock_levels set available = low_stock_at + 20 where product_id = (select id from products where slug = 'sample-led-panel')`);
  await countrySql(`update stock_levels set available = low_stock_at where product_id = (select id from products where slug = 'sample-led-panel')`);

  await signIn(page, ACCOUNTS.tzDesk);
  await page.goto("/c/tz/orders");
  await expect(bell(page)).toHaveAccessibleName(/\d+ unread$/);
  const unread = Number(/(\d+) unread$/.exec((await bell(page).getAttribute("aria-label")) ?? "")?.[1]);
  expect(unread).toBeGreaterThan(2);
  await expect(page.getByTestId("notification-badge")).toHaveText(String(unread));

  await bell(page).click();
  await expect(page).toHaveURL(new RegExp(`${PAGE}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();
  await expect(page.getByRole("region", { name: `${unread} unread` })).toBeVisible();
  await expect(bell(page)).toHaveAttribute("aria-current", "page");

  // What the rider and the super admin did.
  await expect(list(page)).toContainText(`Order ${juma} was delivered.`);
  await expect(list(page)).toContainText(`Order ${baraka} was cancelled by another administrator.`);
  await expect(list(page)).toContainText("was placed and is waiting to be confirmed.");
  await expect(list(page)).toContainText("24W LED Panel Light has reached its low-stock level.");
  // No customer details, amounts or delivery code in a notification.
  await expect(list(page)).not.toContainText(/Juma Said|\+255|TZS|@example\.test/);
  // A rider's own notifications are not the staff's.
  await expect(list(page)).not.toContainText("was given to you");
  expect(await sideways(page)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(SHOTS, "manager-notifications.png"), fullPage: true });

  // A notification opens what it is about.
  const delivered = list(page).getByRole("listitem").filter({ hasText: `Order ${juma} was delivered.` });
  await expect(delivered.getByRole("link", { name: /^Open/ })).toHaveAttribute("href", `/c/tz/orders/${juma}`);
  const lowStock = list(page).getByRole("listitem").filter({ hasText: "has reached its low-stock level" });
  await expect(lowStock.getByRole("link", { name: /^Open/ })).toHaveAttribute("href", "/c/tz/inventory/sample-led-panel");

  await page.getByRole("button", { name: "Mark all as read" }).click();
  await expect(page.getByRole("region", { name: "All read" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark all as read" })).toHaveCount(0);
  await expect(page.getByTestId("notification-badge")).toHaveCount(0);
  await expect(bell(page)).toHaveAccessibleName("Notifications for Tanzania");
  // It is the manager's own mark, kept by the country: still read after a reload, on any page.
  await page.goto("/c/tz/orders");
  await expect(bell(page)).toBeVisible();
  await expect(page.getByTestId("notification-badge")).toHaveCount(0);

  // Something new arrives: counted again.
  await countrySql(`update stock_levels set available = 0 where product_id = (select id from products where slug = 'sample-led-panel')`);
  await page.goto(PAGE);
  await expect(page.getByRole("region", { name: "1 unread" })).toBeVisible();
  await expect(list(page).getByRole("listitem").first()).toContainText("24W LED Panel Light has run out.");
  await expect(page.getByTestId("notification-badge")).toHaveText("1");

  // Another administrator has their own mark, and sees only what their role covers.
  const finance = await newSession(browser);
  await signIn(finance, ACCOUNTS.tzFinance);
  await finance.goto(PAGE);
  await expect(finance.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();
  await expect(finance.getByRole("region", { name: /^\d+ unread$/ })).toBeVisible();
  await expect(list(finance)).toContainText(`Order ${juma} was delivered.`);
  // Finance reads orders, not stock.
  await expect(list(finance)).not.toContainText(/low-stock|has run out/);
  await finance.context().close();
});

test("a rider, on a phone, sees the deliveries given to them and nothing of the staff's", async ({ browser }) => {
  const juma = await orderOf("Juma Said");
  const rider = await newSession(browser, 375, 812);
  await signIn(rider, ACCOUNTS.tzRider);
  await rider.goto("/c/tz");
  await expect(bell(rider)).toHaveAccessibleName(/\d+ unread$/);
  await bell(rider).click();
  await expect(rider).toHaveURL(new RegExp(`${PAGE}$`));
  await expect(rider.getByText("Deliveries given to you, moved to another rider or cancelled")).toBeVisible();

  const given = list(rider).getByRole("listitem").filter({ hasText: `Order ${juma} was given to you.` });
  await expect(given).toHaveCount(1);
  await expect(given.getByRole("link", { name: /^Open/ })).toHaveAttribute("href", `/c/tz/deliveries/${juma}`);
  await expect(list(rider)).not.toContainText(/was placed|was delivered|low-stock|another administrator/);
  expect(await sideways(rider)).toBeLessThanOrEqual(1);
  await rider.screenshot({ path: path.join(SHOTS, "375-rider-notifications.png"), fullPage: true });

  await rider.getByRole("button", { name: "Mark all as read" }).click();
  await expect(rider.getByRole("region", { name: "All read" })).toBeVisible();
  await expect(rider.getByTestId("notification-badge")).toHaveCount(0);

  // Another country is not theirs: the count answers like a page that does not exist.
  const other = await rider.request.get("/c/ke/notifications/count");
  expect(other.status()).toBe(404);
  expect(await other.json()).toEqual({ unread: 0 });
  await rider.context().close();
});

test("signed out, the count gives nothing away", async ({ browser }) => {
  const visitor = await newSession(browser);
  const response = await visitor.request.get("/c/tz/notifications/count", { maxRedirects: 0 });
  // The proxy sends a signed-out request to sign in; the handler itself would answer 404.
  expect([404, 303, 307, 302]).toContain(response.status());
  if (response.status() === 404) expect(await response.json()).toEqual({ unread: 0 });
  await visitor.context().close();
});
