import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { adminSql, countrySql, sideways, signInWithCode } from "./support/helpers";
import { ACCOUNTS } from "./support/stack";

/**
 * Products from the Central Admin (country migration 0016), end to end on
 * this machine: a Country Super Admin lists the catalogue, creates a draft,
 * is told it cannot go live without a photo, adds one (made smaller in the
 * browser), sets the stock, publishes, edits the price and hides it. Every
 * change is checked in the stand-in country's own database and in the
 * Central Admin's audit log.
 *
 * Runs after orders.spec.ts (file order): Tanzania's service is connected there.
 */
const SHOTS = path.join(process.cwd(), "test-results", "products");
const SLUG = "e2e-smart-bulb-12w";

test.beforeAll(() => {
  mkdirSync(SHOTS, { recursive: true });
});

const region = (page: Page, name: string) => page.getByRole("region", { name, exact: true });

async function confirm(page: Page, panel: string, button: string, confirmLabel = button) {
  await region(page, panel).getByRole("button", { name: button, exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: confirmLabel, exact: true }).click();
}

async function countryProduct() {
  const [row] = await countrySql<{ active: boolean; price_minor: string; was_price_minor: string | null; available: number; in_stock: boolean; images: string }>(
    `select p.active, pr.price_minor, pr.was_price_minor, s.available, pr.in_stock, (select count(*) from product_images i where i.product_id = p.id) as images
       from products p
       join product_country_prices pr on pr.product_id = p.id and pr.country_code = 'TZ'
       left join stock_levels s on s.product_id = p.id and s.country_code = 'TZ'
      where p.slug = $1`,
    [SLUG],
  );
  return row;
}

test("a Country Super Admin creates a draft, adds a photo and stock, publishes, edits and hides a product", async ({ page }) => {
  await signInWithCode(page, ACCOUNTS.tzSuper);

  // The catalogue, live from the country: every product, the sample mark, the statuses.
  await page.goto("/c/tz/products");
  await expect(page.getByRole("heading", { level: 1, name: "Products" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Products" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Live\s*\d+/ })).toBeVisible();
  await page.getByLabel("Name or SKU").fill("panel");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("table", { name: "Products" }).getByRole("link", { name: "24W LED Panel Light" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Products" }).getByText("Sample").first()).toBeVisible();

  // A new product: a draft, nothing on the storefront yet.
  await page.getByRole("link", { name: "New product" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "New product" })).toBeVisible();
  const details = region(page, "Details");
  // A refusal keeps what was typed.
  await details.getByLabel("Name", { exact: true }).fill("E2E Smart Bulb 12W");
  await details.getByLabel("SKU").fill("e2e-bulb-12w");
  await details.getByLabel("Price (TZS)").fill("abc");
  await details.getByRole("button", { name: "Create draft" }).click();
  await expect(details.getByText("Enter the price, e.g. 28000")).toBeVisible();
  await expect(details.getByText("Choose where the product belongs")).toBeVisible();
  await expect(details.getByLabel("Name", { exact: true })).toHaveValue("E2E Smart Bulb 12W");

  const placement = await details
    .locator("select[name=placement] option")
    .evaluateAll((options) => (options as HTMLOptionElement[]).find((option) => /^Lighting › .+ › .+/.test(option.textContent ?? ""))?.value ?? "");
  expect(placement).not.toBe("");
  await details.getByLabel("Where it belongs").selectOption(placement);
  await details.getByLabel("Price (TZS)").fill("45,000");
  await details.getByLabel("Earlier price (TZS, optional)").fill("50000");
  await details.getByLabel("Option name (optional)").fill("Wattage");
  await details.getByLabel("Options").fill("9W, 12W");
  await details.getByLabel("Colours").fill("Warm white #FFE9B0");
  await details.getByLabel("Specifications").fill("Power: 12 W\nBase: E27");
  await details.getByRole("button", { name: "Create draft" }).click();
  await expect(page).toHaveURL(new RegExp(`/c/tz/products/${SLUG}\\?created=1$`));
  await expect(page.getByRole("heading", { level: 1, name: "E2E Smart Bulb 12W" })).toBeVisible();
  await expect(page.getByText("Draft created")).toBeVisible();
  expect(await countryProduct()).toMatchObject({ active: false, available: 0, in_stock: false });
  expect(Number((await countryProduct())!.price_minor)).toBe(4_500_000);

  // Not without a photo: the country says what is missing.
  await confirm(page, "On the website", "Publish");
  await expect(page.getByRole("dialog").getByText("It cannot go live yet. It needs at least one photo.")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();

  // A photo, made smaller in the browser, shown through the console.
  const photos = region(page, "Photos");
  await photos.getByLabel("Add a photo").setInputFiles({ name: "bulb.png", mimeType: "image/png", buffer: await page.screenshot({ clip: { x: 0, y: 0, width: 600, height: 400 } }) });
  await expect(photos.getByRole("img", { name: "The photo that will be added" })).toBeVisible();
  await photos.getByLabel("What the photo shows (optional)").fill("The bulb, lit");
  await photos.getByRole("button", { name: "Add photo" }).click();
  await expect(page.getByText("Photo added.").first()).toBeVisible();
  const shown = photos.getByRole("list", { name: "Photos" }).getByRole("img", { name: "The bulb, lit" });
  await expect(shown).toBeVisible();
  await expect.poll(() => shown.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);

  // Stock, on the Inventory page (country migration 0017): units in with a reason, a refused removal,
  // a low-stock level, the history. Then back to the product to make it live.
  await region(page, "Stock").getByRole("link", { name: "Change stock and see its history" }).click();
  await expect(page).toHaveURL(new RegExp(`/c/tz/inventory/${SLUG}$`));
  const change = region(page, "Change the stock");
  await change.getByLabel("Units", { exact: true }).fill("9");
  await change.getByLabel("Reason").selectOption({ label: "Received from supplier" });
  await change.getByLabel(/^Note/).fill("Delivery note 1452");
  await change.getByRole("button", { name: "Save stock change" }).click();
  await expect(page.getByText("+9 (Received from supplier). 9 in stock now.").first()).toBeVisible();
  await change.getByLabel("Remove units").check();
  await change.getByLabel("Units", { exact: true }).fill("20");
  await change.getByRole("button", { name: "Save stock change" }).click();
  await expect(change.getByText("There are only 9 units to remove.")).toBeVisible();
  await region(page, "Low-stock level").getByLabel("Low at (units)").fill("10");
  await region(page, "Low-stock level").getByRole("button", { name: "Set level" }).click();
  await expect(page.getByText("Counted as low at 10 units or fewer.").first()).toBeVisible();
  await expect(region(page, "In stock").getByText("Low", { exact: true })).toBeVisible();
  const history = page.getByRole("table", { name: "Stock history" });
  await expect(history.getByRole("row")).toHaveCount(2);
  await expect(history).toContainText("+9");
  await expect(history).toContainText("Delivery note 1452");
  expect(await countrySql(`select change, reason, note from stock_movements m join products p on p.id = m.product_id where p.slug = $1`, [SLUG])).toEqual([
    { change: 9, reason: "received", note: "Delivery note 1452" },
  ]);
  await page.getByRole("link", { name: "Product", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "E2E Smart Bulb 12W" })).toBeVisible();
  await confirm(page, "On the website", "Publish");
  await expect(page.getByText(/^Published\./).first()).toBeVisible();
  await expect(region(page, "On the website").getByRole("button", { name: "Hide from the website" })).toBeVisible();
  expect(await countryProduct()).toMatchObject({ active: true, available: 9, in_stock: true });

  // An edit: the new price lands in the country.
  await details.getByLabel("Price (TZS)").fill("42000");
  await details.getByLabel("Earlier price (TZS, optional)").fill("");
  await details.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(/^Saved\./).first()).toBeVisible();
  const edited = await countryProduct();
  expect(Number(edited!.price_minor)).toBe(4_200_000);
  expect(edited!.was_price_minor).toBeNull();
  await expect(region(page, "Recent changes").getByText("Product edited")).toBeVisible();
  await page.screenshot({ path: path.join(SHOTS, "1280-product.png"), fullPage: true });

  // Hidden again: off the storefront, kept in the country.
  await confirm(page, "On the website", "Hide from the website", "Hide product");
  await expect(region(page, "On the website").getByRole("button", { name: "Publish", exact: true })).toBeVisible();
  const hidden = await countryProduct();
  expect(hidden!.active).toBe(false);
  expect(Number(hidden!.images)).toBe(1);

  // Each accepted change is in the Central Admin's audit log, with the permission it needed.
  const audited = await adminSql<{ action: string }>(`select action from audit_logs where target_type = 'product' and target_id = $1 order by id`, [SLUG]);
  expect(audited.map((row) => row.action)).toEqual([
    "product.create",
    "product.image_add",
    "inventory.adjust",
    "inventory.low_stock",
    "product.publish",
    "product.update",
    "product.hide",
  ]);

  // The same pages on a phone (same session: sign-ins per address are limited).
  await page.setViewportSize({ width: 375, height: 812 });
  for (const address of ["/c/tz/products", "/c/tz/products/new", "/c/tz/inventory", `/c/tz/inventory/${SLUG}`, `/c/tz/products/${SLUG}`]) {
    await page.goto(address);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await sideways(page), address).toBeLessThanOrEqual(1);
  }
  await page.screenshot({ path: path.join(SHOTS, "375-product.png"), fullPage: true });
});
