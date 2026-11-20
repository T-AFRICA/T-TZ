import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { countrySql, expectRefused, sideways, signIn } from "./support/helpers";
import { ACCOUNTS } from "./support/stack";

/**
 * Reports, end to end on this machine, as Tanzania's Finance / Reporting
 * Viewer (reports and orders only). Runs after orders.spec.ts (file order):
 * Tanzania is connected there, one synthetic order is delivered (so paid)
 * and one is cancelled. The expected figures are read from the stand-in
 * country's own database, not written into the test.
 */
const SHOTS = path.join(process.cwd(), "test-results", "reports");

test.beforeAll(() => {
  mkdirSync(SHOTS, { recursive: true });
});

const tzs = (minor: number) => `TZS ${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(minor / 100)}`;

async function openTab(page: Page, name: string) {
  await page.getByRole("navigation", { name: "Report" }).getByRole("link", { name }).click();
  await expect(page.getByRole("navigation", { name: "Report" }).getByRole("link", { name })).toHaveAttribute("aria-current", "page");
}

test("the Finance viewer reads sales, products, orders and stock, with charts, tables and CSV files", async ({ page }) => {
  const [paid] = await countrySql<{ orders: number; minor: string }>(
    `select count(*)::int as orders, coalesce(sum(total_minor), 0)::text as minor from orders where payment_status = 'paid'`,
  );
  const [placed] = await countrySql<{ n: number }>(`select count(*)::int as n from orders`);
  expect(paid!.orders).toBeGreaterThan(0);
  const paidMinor = Number(paid!.minor);

  await signIn(page, ACCOUNTS.tzFinance);
  await page.goto("/c/tz/reports");
  await expect(page.getByRole("heading", { level: 1, name: "Reports" })).toBeVisible();
  await expect(page.getByText(/cannot be shown right now/)).toHaveCount(0);

  // Sales: the paid orders' total, and a column for each of the last 30 days.
  const main = page.locator("main");
  await expect(main).toContainText(tzs(paidMinor));
  await expect(main).toContainText(`From ${paid!.orders} paid order`);
  await expect(main).toContainText(`${placed!.n}`);
  const byDay = page.getByRole("region", { name: "Sales by day" });
  await expect(byDay.getByRole("figure", { name: "Sales by day" }).getByRole("listitem")).toHaveCount(30);
  await byDay.getByText("Show the figures as a table").click();
  await expect(byDay.getByRole("table")).toContainText(tzs(paidMinor));
  await page.screenshot({ path: path.join(SHOTS, "sales.png"), fullPage: true });

  // The CSV of what is on the screen, with no customer details.
  const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download CSV" }).click()]);
  expect(file.suggestedFilename()).toMatch(/^tronic-tz-sales-\d{4}-\d{2}-\d{2}-to-\d{4}-\d{2}-\d{2}\.csv$/);
  const csv = readFileSync((await file.path())!, "utf8");
  expect(csv).toContain("TRONIC Tanzania: Sales report");
  expect(csv).toContain((paidMinor / 100).toFixed(2));
  expect(csv).not.toMatch(/@example\.test|\+2557/);

  // Products & categories: the paid lines, ranked; categories as parts of the whole.
  await openTab(page, "Products & categories");
  await expect(page.getByRole("list", { name: "Top products by sales" }).getByRole("listitem").first()).toBeVisible();
  await expect(page.getByRole("figure", { name: "Share of sales by category" })).toContainText("100%");

  // Orders & delivery: where they stand now, by region.
  await openTab(page, "Orders & delivery");
  const standing = page.getByRole("figure", { name: "Orders by status" });
  await expect(standing).toContainText("Delivered");
  await expect(standing).toContainText("Cancelled");
  await expect(page.getByRole("list", { name: "Orders by region" })).toContainText("Dar es Salaam");

  // Stock: what orders took and the cancellation gave back.
  await openTab(page, "Stock");
  const changes = page.getByRole("region", { name: "Stock changes in the period" });
  await expect(changes).toContainText("Order placed");
  await expect(changes).toContainText("Order cancelled");
  await page.screenshot({ path: path.join(SHOTS, "stock.png"), fullPage: true });

  // A period that cannot be shown says so and shows the last 30 days instead.
  await page.goto("/c/tz/reports?tab=sales&from=2026-11-20&to=2026-11-01");
  await expect(page.getByText("That period cannot be shown")).toBeVisible();
  const refused = await page.request.get("/c/tz/reports/export?tab=sales&from=2020-01-01&to=2026-11-01");
  expect(refused.status()).toBe(400);

  // A phone: nothing scrolls sideways.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/c/tz/reports");
  await expect(page.getByRole("region", { name: "Sales by day" })).toBeVisible();
  expect(await sideways(page)).toBe(0);
  await page.screenshot({ path: path.join(SHOTS, "sales-375.png"), fullPage: true });

  // Nothing else: the role has no products, inventory or settings.
  await expectRefused(page, "/c/tz/inventory");
});
