import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { adminSql, countrySql, expectRefused, newSession, sideways, signIn, signInWithCode } from "./support/helpers";
import { ACCOUNTS } from "./support/stack";

/**
 * The Global Combined Reports, end to end on this machine: a Master Super
 * Admin sees every country's own figures added up, types the US dollar
 * rate that turns Tanzania's sales into dollars, sorts, switches currency
 * and downloads the CSV; nobody else reaches the page or the file.
 *
 * Runs last (file order): Tanzania is connected and has paid orders from
 * the earlier specs; the other countries are not connected and must show
 * as such, never with a figure. The reader is a second Master Super Admin
 * (support/stack.ts, groupFinance): the first has used its sign-in attempts
 * for this run and the limit is not loosened for a test.
 */
const SHOTS = path.join(process.cwd(), "test-results", "global-reports");
const RATE = 2650;

test.beforeAll(() => {
  mkdirSync(SHOTS, { recursive: true });
});

/** The widths the layout is checked at, and three more that stand for a 1366px laptop zoomed to 150%, 125% and 80%. */
const WIDTHS = [320, 375, 390, 430, 768, 1024, 1280, 1366, 1440, 1920, 911, 1093, 1708];

/** How far an element's top is below the console's sticky bar: never negative, or the bar covers it. */
const clearOfBar = (page: Page, selector: string) =>
  page.evaluate((target) => {
    const bar = document.querySelector("header.sticky")?.getBoundingClientRect();
    const element = document.querySelector(target)?.getBoundingClientRect();
    return bar && element ? Math.round(element.top - bar.bottom) : -1;
  }, selector);

const dollars = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

test("a Master Super Admin reads the combined figures, sets the dollar rate, sorts, switches currency and downloads the CSV", async ({ page }) => {
  const [paid] = await countrySql<{ orders: number; minor: string; exponent: number }>(
    `select count(*)::int as orders, coalesce(sum(o.total_minor), 0)::text as minor,
            (select c.exponent from currencies c where c.code = 'TZS')::int as exponent
       from orders o where o.payment_status = 'paid'`,
  );
  const [placed] = await countrySql<{ n: number }>(`select count(*)::int as n from orders`);
  expect(paid!.orders).toBeGreaterThan(0);
  const expectedCents = Math.round((Number(paid!.minor) / 10 ** paid!.exponent / RATE) * 100);

  await signInWithCode(page, ACCOUNTS.groupFinance);

  // The Overview that sign-in lands on counts the connected country from its own summary: counts added up,
  // sales in the country's own currency (never dollars here), and the countries left out named.
  const [open] = await countrySql<{ n: number }>(`select count(*)::int as n from orders where status not in ('delivered', 'cancelled')`);
  const figures = page.getByRole("region", { name: "Business figures" });
  await expect(figures.locator("[data-figure]")).toHaveCount(6);
  await expect(figures.getByText("Unavailable", { exact: true })).toHaveCount(0);
  await expect(figures.locator('[data-figure="orders"]')).toHaveText(new RegExp(`^Orders\\s*${placed!.n}\\s*All time`));
  await expect(figures.locator('[data-figure="pending"]')).toHaveText(new RegExp(`^Pending orders\\s*${open!.n}\\s*Not delivered`));
  await expect(figures.locator('[data-figure="sales"]')).toContainText("Tanzania");
  await expect(figures.locator('[data-figure="sales"]')).toContainText(`TZS ${(Number(paid!.minor) / 10 ** paid!.exponent).toLocaleString("en-GB")}`);
  await expect(figures).toContainText("Counted from 1 of 5 countries");
  await expect(figures).toContainText("Kenya (not connected)");
  await expect(figures).not.toContainText("$");
  await expect(figures.getByRole("link", { name: "Open Global reports" })).toHaveAttribute("href", "/reports");
  expect(await sideways(page)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(SHOTS, "overview-figures.png"), fullPage: true });

  await page.getByRole("navigation", { name: "Console" }).getByRole("link", { name: "Global reports" }).click();
  await expect(page).toHaveURL(/\/reports$/);
  await expect(page.getByRole("heading", { level: 1, name: "Global Combined Reports" })).toBeVisible();

  const summary = page.getByRole("region", { name: "Summary" });
  const table = page.getByRole("region", { name: "Country performance" });
  const tanzania = table.getByRole("row").filter({ hasText: "Tanzania" });

  // Each country carries its flag, from its confirmed ISO code; Congo, whose code is not confirmed, a neutral globe.
  const highlights = page.getByRole("region", { name: "Country highlights" });
  for (const code of ["TZ", "KE", "UG", "RW"]) {
    await expect(highlights.locator(`[data-flag="${code}"] svg`)).toBeVisible();
    await expect(table.locator(`[data-flag="${code}"] svg`)).toBeVisible();
  }
  await expect(highlights.getByRole("listitem").filter({ hasText: "Congo" }).locator('[data-flag="none"]')).toBeVisible();
  await expect(highlights.getByRole("listitem").filter({ hasText: "Tanzania" }).locator("[data-flag]")).toHaveAttribute("data-flag", "TZ");
  await highlights.screenshot({ path: path.join(SHOTS, "country-flags.png") });

  // Before a rate: counts are added up, money stays in shillings and out of the dollar totals.
  await expect(page.getByText("Some sales are not in the dollar totals")).toBeVisible();
  await expect(page.getByRole("link", { name: "Set exchange rate" }).first()).toHaveAttribute("href", "#rates");
  const kpi = (slug: string) => summary.locator(`[data-kpi="${slug}"]`);
  await expect(summary.locator("[data-kpi]")).toHaveCount(8);
  await expect(kpi("total-orders")).toContainText(String(placed!.n));
  // A dollar figure without a rate says "Not configured", never a zero or a dash that could pass for a figure; the local amount stays in sight.
  for (const slug of ["paid-sales", "average-order", "top-country"]) {
    await expect(kpi(slug)).toHaveAttribute("data-state", "not_configured");
    await expect(kpi(slug)).toContainText("Not configured");
    await expect(kpi(slug)).not.toContainText("$");
  }
  await expect(kpi("paid-sales")).toContainText("Needs a US dollar rate");
  await expect(kpi("paid-sales")).toContainText("TZS");
  await expect(kpi("paid-orders")).toHaveAttribute("data-state", "value");
  await expect(page.getByRole("region", { name: "Sales by country" })).toContainText("Not configured");
  await expect(page.getByRole("region", { name: "Revenue share" })).toContainText("Not configured");
  await expect(tanzania).toContainText("TZS");
  await expect(tanzania).toContainText("no rate");
  await expect(tanzania).toContainText("Connected");
  await expect(table.getByText("The US dollar totals do not include Tanzania")).toBeVisible();
  // The status chart: the country's own statuses, each in one of four groups, adding up to the orders placed.
  const [status] = await countrySql<{ awaiting: number; progress: number; delivered: number; cancelled: number }>(
    `select count(*) filter (where status = 'pending_payment')::int as awaiting,
            count(*) filter (where status in ('confirmed', 'processing', 'packed', 'dispatched', 'in_transit'))::int as progress,
            count(*) filter (where status = 'delivered')::int as delivered,
            count(*) filter (where status = 'cancelled')::int as cancelled
       from orders`,
  );
  expect(status!.awaiting + status!.progress + status!.delivered + status!.cancelled).toBe(placed!.n);
  await expect(page.getByRole("figure", { name: "Orders by status and country" })).toContainText(
    `Tanzania: Awaiting confirmation: ${status!.awaiting}, In progress: ${status!.progress}, Delivered: ${status!.delivered}, Cancelled: ${status!.cancelled}`,
  );
  // A country that is not connected has no figures, and says why.
  for (const name of ["Kenya", "Uganda", "Rwanda"]) {
    await expect(table.getByRole("row").filter({ hasText: name })).toContainText("No figures:");
    // A planned country is "Not connected", never "Connected" and never a failure; it has no figures and no details to open.
    await expect(table.getByRole("row").filter({ hasText: name }).getByText("Not connected", { exact: true })).toBeVisible();
    await expect(highlights.getByRole("listitem").filter({ hasText: name })).toContainText("Not connected");
    await expect(highlights.getByRole("listitem").filter({ hasText: name }).getByRole("link")).toHaveCount(0);
  }
  await expect(page.getByText(/Connection failed/)).toHaveCount(0);

  // The search box hides rows that are already on the page; the total stays the total of every country.
  const search = table.getByRole("searchbox", { name: "Search countries" });
  await search.fill("ken");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(table.locator("tbody tr")).toContainText("Kenya");
  await expect(table.getByText("1 of 5 countries shown")).toBeVisible();
  await expect(table.locator("tfoot")).toContainText("Total (1 of 5 countries)");
  await search.fill("tzs");
  await expect(table.locator("tbody tr")).toContainText("Tanzania");
  await search.fill("<script>");
  await expect(table.locator("tbody tr")).toContainText("No country matches");
  await search.fill("");
  await expect(table.locator("tbody tr")).toHaveCount(5);

  // A rate that is not a number is refused and nothing is saved.
  const rates = page.getByRole("region", { name: "US dollar rates" });
  const field = rates.getByLabel("Tanzania: TZS for 1 US dollar");
  await field.fill("about 2650");
  await field.press("Enter");
  await expect(rates.getByText(/Enter how many TZS one US dollar is/)).toBeVisible();
  expect(await adminSql(`select 1 from country_exchange_rates`)).toHaveLength(0);

  // The rate, typed with a thousands comma.
  await field.fill("2,650");
  await field.press("Enter");
  await expect(page.getByText("Saved for Tanzania: 1 USD = 2,650 TZS.").first()).toBeVisible();
  await expect(rates).toContainText("1 USD = 2,650 TZS, set");
  const [stored] = await adminSql<{ units_per_usd: string; currency: string }>(`select units_per_usd::text, currency from country_exchange_rates where country_id = 'tz'`);
  expect(stored).toEqual({ units_per_usd: "2650.000000", currency: "TZS" });
  const [audit] = await adminSql<{ summary: { before: string | null; after: string } }>(
    `select summary from audit_logs where action = 'country.exchange_rate' and country_id = 'tz' order by id desc limit 1`,
  );
  expect(audit!.summary).toMatchObject({ before: null, after: "2650.000000", currency: "TZS" });

  // Now in dollars, everywhere.
  await page.goto("/reports");
  await expect(page.getByText("Some sales are not in the dollar totals")).toHaveCount(0);
  await expect(kpi("paid-sales")).toContainText(dollars(expectedCents));
  await expect(kpi("paid-sales")).toHaveAttribute("data-state", "value");
  await expect(kpi("paid-sales")).not.toContainText("Partial");
  await expect(kpi("paid-orders")).toContainText(String(paid!.orders));
  await expect(kpi("top-country")).toContainText("Tanzania");
  await expect(kpi("top-country").locator('[data-flag="TZ"]')).toBeVisible();
  await expect(page.getByText("Last synchronised")).toBeVisible();
  await expect(tanzania).toContainText(dollars(expectedCents));
  await expect(tanzania).toContainText("100.0%");
  await expect(table.getByRole("row").filter({ hasText: /^Total/ })).toContainText(dollars(expectedCents));
  for (const chart of ["Paid sales by country, in US dollars", "Orders placed per day", "Share of paid sales by country", "Orders by status and country"]) {
    await expect(page.getByRole("figure", { name: chart })).toBeVisible();
  }
  await expect(page.getByRole("region", { name: "Best-selling products" }).getByRole("row")).not.toHaveCount(1);
  await expect(page.getByRole("region", { name: "Executive insights" })).toContainText("Highest sales");
  await expect(page.getByRole("region", { name: "Executive insights" })).toContainText("Tanzania");
  // No customer details anywhere on the page.
  await expect(page.locator("main")).not.toContainText(/@example\.test|\+255|Juma Said|Asha Mrema/);
  expect(await sideways(page)).toBeLessThanOrEqual(1);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: path.join(SHOTS, "1440-global-reports.png"), fullPage: true });

  // Sorting is in the address, so it survives a reload and needs no script.
  await table.getByRole("link", { name: /^Orders/ }).click();
  await expect(page).toHaveURL(/sort=orders&dir=desc#countries$/);
  await expect(table.getByRole("columnheader", { name: /^Orders/ })).toHaveAttribute("aria-sort", "descending");
  await expect(table.getByRole("row").nth(1)).toContainText("Tanzania");
  // The link ends at the table: the console's sticky bar does not cover the table's heading.
  await expect.poll(() => clearOfBar(page, "#countries")).toBeGreaterThanOrEqual(0);
  await expect.poll(() => clearOfBar(page, "#countries")).toBeLessThan(300);
  await table.getByRole("link", { name: /^Paid orders/ }).click();
  await expect(page).toHaveURL(/sort=paidOrders&dir=desc#countries$/);
  await expect(table.getByRole("columnheader", { name: /^Paid orders/ })).toHaveAttribute("aria-sort", "descending");
  await expect(table.getByRole("row").nth(1)).toContainText("Tanzania");

  // Refresh asks the countries again and keeps the page and its settings.
  await page.getByRole("link", { name: "Refresh" }).click();
  await expect(page).toHaveURL(/sort=paidOrders&dir=desc/);
  await expect(page.getByRole("heading", { level: 1, name: "Global Combined Reports" })).toBeVisible();
  await expect(kpi("paid-sales")).toContainText(dollars(expectedCents));
  // Reset goes back to the last 30 days, all countries, dollars, by rank.
  await page.getByRole("link", { name: "Reset" }).click();
  await expect(page).toHaveURL(/\/reports$/);
  await expect(page.getByRole("link", { name: "Reset" })).toHaveCount(0);

  // Local currency: shillings again, and no mixed-currency total.
  await page.getByRole("group", { name: "Currency view" }).getByRole("link", { name: "Local" }).click();
  await expect(page).toHaveURL(/view=local/);
  await expect(tanzania).toContainText("TZS");
  await expect(tanzania).not.toContainText("$");
  await expect(page.getByText("Money totals need one currency")).toBeVisible();

  // One country only.
  await page.locator('select[name="country"]').selectOption("tz");
  await page.getByRole("button", { name: "Show" }).click();
  await expect(page).toHaveURL(/country=tz/);
  await expect(table.getByRole("row").filter({ hasText: "Kenya" })).toHaveCount(0);
  // A country that is not one of the administrator's is ignored, not trusted.
  await page.goto("/reports?country=zz");
  await expect(table.getByRole("row").filter({ hasText: "Kenya" })).toHaveCount(1);

  // The CSV: same figures, exact local amount, the rate beside it.
  const today = new Date().toISOString().slice(0, 10);
  const file = await page.request.get(`/reports/export?from=${today}&to=${today}`);
  expect(file.status()).toBe(200);
  expect(file.headers()["content-type"]).toContain("text/csv");
  expect(file.headers()["content-disposition"]).toContain(`tronic-global-${today}-to-${today}.csv`);
  const csv = await file.text();
  expect(csv).toContain("TRONIC: Global Combined Reports");
  expect(csv).toMatch(new RegExp(`1,Tanzania,active,yes,TZS,2650,${placed!.n},${paid!.orders},`));
  expect(csv).toContain((expectedCents / 100).toFixed(2));
  expect(csv).not.toMatch(/@example\.test|\+255/);
  expect((await page.request.get("/reports/export")).status()).toBe(400);
  expect((await page.request.get(`/reports/export?from=${today}&to=${today}&country=zz`)).status()).toBe(404);

  // Every width from a small phone to a wide desktop, and a laptop zoomed in and out: nothing runs off the
  // side, the sticky bar never covers the title, and the filters can be reached.
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto("/reports");
    await expect(page.getByRole("heading", { level: 1, name: "Global Combined Reports" }), String(width)).toBeVisible();
    expect(await sideways(page), `sideways at ${width}`).toBeLessThanOrEqual(1);
    expect(await clearOfBar(page, "h1"), `title under the bar at ${width}`).toBeGreaterThan(0);
    await expect(page.getByRole("group", { name: "Period" }).getByRole("link", { name: "30 days" }), String(width)).toHaveAttribute("aria-current", "true");
    await expect(summary.locator("[data-kpi]").first(), String(width)).toBeVisible();
    const fields = page.locator('input[name="from"]');
    if (width < 768) {
      // On a phone the date range and country fold behind one button that says what is chosen.
      const toggle = page.getByRole("button", { name: /Date range and country/ });
      await expect(toggle, String(width)).toHaveAttribute("aria-expanded", "false");
      await expect(fields).toBeHidden();
      // Pressed again if the page's script had not taken over yet.
      await expect(async () => {
        await toggle.click();
        await expect(toggle).toHaveAttribute("aria-expanded", "true", { timeout: 1000 });
      }).toPass();
    }
    await expect(fields, String(width)).toBeVisible();
    await expect(page.getByRole("button", { name: "Show" }), String(width)).toBeVisible();
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/reports");
  await expect(page.getByRole("heading", { level: 1, name: "Global Combined Reports" })).toBeVisible();
  await page.screenshot({ path: path.join(SHOTS, "375-global-reports.png"), fullPage: true });
  // A chosen country is said on the phone's filter button, and its fields are open.
  await page.goto("/reports?country=tz");
  await expect(page.getByRole("button", { name: /Date range and country/ })).toContainText("Tanzania");
  await expect(page.locator('select[name="country"]')).toHaveValue("tz");
});

test("nobody but a Master Super Admin reaches the combined reports or the file", async ({ browser }) => {
  const manager = await newSession(browser);
  await signIn(manager, ACCOUNTS.tzDesk);
  await expect(manager.getByRole("navigation", { name: "Console" }).getByRole("link", { name: "Global reports" })).toHaveCount(0);
  await expectRefused(manager, "/reports");
  const today = new Date().toISOString().slice(0, 10);
  const file = await manager.request.get(`/reports/export?from=${today}&to=${today}`);
  expect(file.status()).toBe(404);
  expect(await file.text()).toBe("Not found");
  // Both refusals are on record.
  const events = await adminSql<{ what: string }>(
    `select detail ->> 'what' as what from security_events where kind = 'permission_denied' and detail ->> 'what' = 'global reports'`,
  );
  expect(events.length).toBeGreaterThanOrEqual(2);
  // The country's own Reports page is still theirs to open or not, by their role (an Order Manager has no reports.read).
  await expectRefused(manager, "/c/tz/reports");
  await manager.context().close();

  // Signed out: sent to sign in.
  const visitor = await newSession(browser);
  await visitor.goto("/reports");
  await expect(visitor).toHaveURL(/\/sign-in/);
  await visitor.context().close();
});
