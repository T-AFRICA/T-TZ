import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
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
  await expect(summary).toContainText(`Total orders${placed!.n}`);
  await expect(summary).toContainText("Needs a US dollar rate");
  await expect(tanzania).toContainText("TZS");
  await expect(tanzania).toContainText("no rate");
  // A country that is not connected has no figures, and says why.
  for (const name of ["Kenya", "Uganda", "Rwanda"]) {
    await expect(table.getByRole("row").filter({ hasText: name })).toContainText("No figures:");
  }

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
  await expect(summary).toContainText(`Paid sales${dollars(expectedCents)}`);
  await expect(summary).toContainText(`Paid orders${paid!.orders}`);
  await expect(summary).toContainText("Top countryTanzania");
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

  // A phone: nothing runs off the side.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/reports");
  await expect(page.getByRole("heading", { level: 1, name: "Global Combined Reports" })).toBeVisible();
  expect(await sideways(page)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(SHOTS, "375-global-reports.png"), fullPage: true });
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
