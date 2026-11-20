import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { adminSql, countrySql, sideways, signInWithCode } from "./support/helpers";
import { ACCOUNTS } from "./support/stack";

/**
 * Categories and brands from the Central Admin (country migration 0018), end
 * to end on this machine: the website's list is there with its names, a
 * category with a group and a subcategory is added, renamed and hidden, a
 * banner is uploaded, a brand is added, and hiding a category with live
 * products warns first. Checked in the stand-in country's database and the
 * audit log.
 *
 * Runs after orders.spec.ts (file order): Tanzania's service is connected
 * there. Signs in as the Master Super Admin: the Country Super Admin's
 * sign-ins per address are used up by the other files.
 */
const SHOTS = path.join(process.cwd(), "test-results", "categories");

test.beforeAll(() => {
  mkdirSync(SHOTS, { recursive: true });
});

const region = (page: Page, name: string) => page.getByRole("region", { name, exact: true });

test("categories and brands: added, renamed, hidden, a banner, and a warning before hiding live products", async ({ page }) => {
  await signInWithCode(page, ACCOUNTS.master);
  await page.goto("/c/tz/categories");
  await expect(page.getByRole("heading", { level: 1, name: "Categories" })).toBeVisible();
  const table = page.getByRole("table", { name: "Categories" });
  // The website's own names, from migration 0018.
  await expect(table.getByRole("link", { name: "Cables & Wiring" })).toBeVisible();
  await expect(table.getByRole("link", { name: "Lighting" })).toBeVisible();

  // A new category.
  const add = region(page, "Add a category");
  await add.getByLabel("Name", { exact: true }).fill("E2E Solar");
  await add.getByLabel("Line under the name (optional)").fill("Panels and batteries");
  await add.getByLabel("Order").fill("90");
  await add.getByRole("button", { name: "Add category" }).click();
  await expect(page.getByText('Category "E2E Solar" added.').first()).toBeVisible();
  await expect(table.getByRole("link", { name: "E2E Solar" })).toBeVisible();
  expect(await countrySql(`select slug, name, description, active from categories where slug = 'e2e-solar'`)).toEqual([
    { slug: "e2e-solar", name: "E2E Solar", description: "Panels and batteries", active: true },
  ]);

  // Its group and subcategory.
  await table.getByRole("link", { name: "E2E Solar" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "E2E Solar" })).toBeVisible();
  const addGroup = region(page, "Add a group");
  await addGroup.getByLabel("Name", { exact: true }).fill("Solar Panels");
  await addGroup.getByRole("button", { name: "Add group" }).click();
  await expect(page.getByText('Group "Solar Panels" added.').first()).toBeVisible();
  const group = region(page, "Group: Solar Panels");
  await group.getByText("Add a subcategory to Solar Panels").click();
  await group.getByRole("button", { name: "Add subcategory" }).locator("xpath=ancestor::form").getByLabel("Name", { exact: true }).fill("Mono Panels");
  await group.getByRole("button", { name: "Add subcategory" }).click();
  await expect(page.getByText('Subcategory "Mono Panels" added.').first()).toBeVisible();

  // Rename the group (its address stays) and hide the subcategory.
  await region(page, "Group: Solar Panels").getByRole("button", { name: "Save group" }).locator("xpath=ancestor::form").getByLabel("Name", { exact: true }).fill("Solar PV Panels");
  await region(page, "Group: Solar Panels").getByRole("button", { name: "Save group" }).click();
  await expect(page.getByText('Group "Solar PV Panels" saved.').first()).toBeVisible();
  const renamed = region(page, "Group: Solar PV Panels");
  const subForm = renamed.getByRole("listitem").first();
  await subForm.getByLabel("On the website").selectOption("false");
  await subForm.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText('Subcategory "Mono Panels" saved (hidden from the website).').first()).toBeVisible();
  expect(
    await countrySql(
      `select g.slug, g.name, s.slug as sub, s.active from category_groups g join categories c on c.id = g.category_id
         join category_subcategories s on s.group_id = g.id where c.slug = 'e2e-solar'`,
    ),
  ).toEqual([{ slug: "solar-panels", name: "Solar PV Panels", sub: "mono-panels", active: false }]);

  // A banner photo, made smaller in the browser, shown through the console.
  const banner = region(page, "Banner");
  await banner.getByLabel("Add a banner photo").setInputFiles({ name: "solar.png", mimeType: "image/png", buffer: await page.screenshot({ clip: { x: 0, y: 0, width: 800, height: 400 } }) });
  await expect(banner.getByRole("img", { name: "The banner that will be saved" })).toBeVisible();
  await banner.getByRole("button", { name: "Save banner" }).click();
  await expect(page.getByText("Banner saved.").first()).toBeVisible();
  const shown = banner.getByRole("img", { name: "Banner of E2E Solar" });
  await expect(shown).toBeVisible();
  await expect.poll(() => shown.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({ path: path.join(SHOTS, "1280-category.png"), fullPage: true });

  // Hiding a category that has live products says so before anything is saved.
  await page.goto("/c/tz/categories");
  await page.getByRole("table", { name: "Categories" }).getByRole("link", { name: "Lighting" }).click();
  await region(page, "Category").getByLabel("On the website").selectOption("false");
  await expect(region(page, "Category").getByText(/live products? in this category will disappear from the website/)).toBeVisible();
  expect(await countrySql(`select active from categories where slug = 'lighting'`)).toEqual([{ active: true }]);

  // Brands: one added, a duplicate name refused.
  await page.goto("/c/tz/categories");
  const brands = page.getByRole("region", { name: /^Brands/ });
  await brands.getByLabel("New brand").fill("E2E SunVolt");
  await brands.getByRole("button", { name: "Add brand" }).click();
  await expect(page.getByText('Brand "E2E SunVolt" added.').first()).toBeVisible();
  await brands.getByLabel("New brand").fill("e2e sunvolt");
  await brands.getByRole("button", { name: "Add brand" }).click();
  await expect(brands.getByText("Another brand already has that name.")).toBeVisible();
  expect(await countrySql(`select name from brands where lower(name) = 'e2e sunvolt'`)).toEqual([{ name: "E2E SunVolt" }]);

  // Each accepted change is in the Central Admin's audit log.
  const audited = await adminSql<{ action: string }>(`select action from audit_logs where action in ('category.save', 'category.banner', 'brand.save') order by id`);
  expect(audited.map((row) => row.action)).toEqual(["category.save", "category.save", "category.save", "category.save", "category.save", "category.banner", "brand.save"]);

  // The same pages on a phone.
  await page.setViewportSize({ width: 375, height: 812 });
  for (const address of ["/c/tz/categories"]) {
    await page.goto(address);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await sideways(page), address).toBeLessThanOrEqual(1);
  }
  await page.getByRole("table", { name: "Categories" }).getByRole("link", { name: "E2E Solar" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "E2E Solar" })).toBeVisible();
  expect(await sideways(page)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(SHOTS, "375-category.png"), fullPage: true });
});
