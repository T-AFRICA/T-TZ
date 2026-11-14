import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { PORTS } from "./ports";

/**
 * The phone header in a real browser (owner brief 2026-11-14): one row of
 * Menu, Logo, Search, Notification at 320, 375, 390 and 430px; the search
 * button opens the same search as the desktop header in a full-width
 * panel; and both bars slide away while scrolling down and come back.
 */
const BASE = `http://localhost:${PORTS.connected}`;
const SHOTS = path.join(process.cwd(), "test-results", "mobile-header");
const WIDTHS = [320, 375, 390, 430];

const navHidden = (page: Page) => page.evaluate(() => document.documentElement.dataset.navHidden === "true");
/** Scrolls and waits for the frame in which the bars react. */
async function scrollTo(page: Page, y: number) {
  await page.evaluate(
    (top) =>
      new Promise<void>((resolve) => {
        window.scrollTo(0, top);
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
    y,
  );
}

test.beforeAll(() => {
  mkdirSync(SHOTS, { recursive: true });
});

for (const width of WIDTHS) {
  test(`one row at ${width}px: Menu, Logo, Search, Notification, nothing overlapping`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(`${BASE}/`);
    const header = page.getByRole("banner");
    const boxes = {
      menu: await header.getByRole("button", { name: "Open menu" }).boundingBox(),
      logo: await header.getByRole("link", { name: "TRONIC Tanzania home" }).boundingBox(),
      search: await header.getByRole("button", { name: "Search products" }).boundingBox(),
      bell: await header.getByRole("link", { name: "Notifications" }).boundingBox(),
    };
    for (const [name, box] of Object.entries(boxes)) expect(box, name).not.toBeNull();
    const { menu, logo, search, bell } = boxes as { [K in keyof typeof boxes]: NonNullable<(typeof boxes)[K]> };

    // Left to right, with space between neighbours and inside the screen.
    expect(menu.x).toBeGreaterThanOrEqual(8);
    expect(logo.x - (menu.x + menu.width)).toBeGreaterThanOrEqual(8);
    expect(search.x - (logo.x + logo.width)).toBeGreaterThanOrEqual(8);
    expect(bell.x - (search.x + search.width)).toBeGreaterThanOrEqual(4);
    expect(bell.x + bell.width).toBeLessThanOrEqual(width - 8);
    // One row: the same vertical centre.
    const centre = (box: { y: number; height: number }) => box.y + box.height / 2;
    for (const box of [logo, search, bell]) expect(Math.abs(centre(box) - centre(menu))).toBeLessThanOrEqual(2);
    // The logo is centred on the screen.
    expect(Math.abs(logo.x + logo.width / 2 - width / 2)).toBeLessThanOrEqual(1);
    // Touch targets, and the same size for every control.
    for (const box of [menu, search, bell]) {
      expect(box.width).toBeGreaterThanOrEqual(40);
      expect(box.height).toBeGreaterThanOrEqual(40);
    }
    // The second search row is gone and nothing scrolls sideways.
    await expect(header.getByRole("combobox")).toBeHidden();
    const headerBox = await header.boundingBox();
    expect(headerBox!.height).toBeLessThanOrEqual(76);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: path.join(SHOTS, `${width}-header.png`) });

    // The panel is as wide as the screen at this width too.
    await header.getByRole("button", { name: "Search products" }).click();
    const panel = page.getByRole("dialog", { name: "Search products" });
    const field = panel.getByRole("combobox", { name: "Search products" });
    await expect(field).toBeFocused();
    await field.fill("led");
    const list = panel.getByRole("listbox", { name: "Product suggestions" });
    await expect(list).toBeVisible();
    const listBox = await list.boundingBox();
    expect(listBox!.x).toBeGreaterThanOrEqual(0);
    expect(listBox!.x + listBox!.width).toBeLessThanOrEqual(width);
    expect(listBox!.width).toBeGreaterThanOrEqual(width - 40);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.waitForTimeout(300); // the drop-in has finished
    await page.screenshot({ path: path.join(SHOTS, `${width}-search.png`) });
  });
}

test("the search panel searches, shows the quick view, and closes clearly", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/`);
  const trigger = page.getByRole("banner").getByRole("button", { name: "Search products" });
  const panel = page.getByRole("dialog", { name: "Search products" });

  await trigger.click();
  const field = panel.getByRole("combobox", { name: "Search products" });
  await expect(field).toBeFocused();
  // Empty: popular categories. By name: products with prices.
  await expect(panel.getByRole("navigation", { name: "Popular categories" })).toBeVisible();
  await field.fill("led panel");
  const options = panel.getByRole("option");
  await expect(options.first()).toContainText("24W LED Panel Light");
  await expect(options.first()).toContainText("TZS");
  // By SKU.
  await field.fill("SAMPLE-TOP-PLUG");
  await expect(options.first()).toContainText("13A Top Plug");

  // A tapped result opens the product quick view without leaving the page.
  await options.first().getByRole("link").click();
  const quickView = page.getByRole("dialog").filter({ hasText: "13A Top Plug" }).last();
  await expect(quickView).toBeVisible();
  await expect(page).toHaveURL(`${BASE}/`);
  await page.keyboard.press("Escape");

  // The clear close action; focus returns to the search button.
  await panel.getByRole("button", { name: "Close search" }).click();
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();

  // Escape closes it too (first the suggestions, then the panel).
  await trigger.click();
  await expect(field).toBeFocused();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();

  // "View all results" goes to the results page and the panel steps aside.
  await trigger.click();
  await field.fill("led");
  await panel.getByRole("option").last().getByRole("link").click();
  await expect(page).toHaveURL(`${BASE}/search?q=led`);
  await expect(panel).toBeHidden();
});

test("both bars slide away while scrolling down and come back", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto(`${BASE}/`);
  const header = page.getByRole("banner");
  const bottomBar = page.getByRole("navigation", { name: "Primary" });
  await expect(header).toBeInViewport();
  await expect(bottomBar).toBeInViewport();
  expect(await navHidden(page)).toBe(false);

  // Down: both go, together.
  await scrollTo(page, 500);
  await scrollTo(page, 900);
  expect(await navHidden(page)).toBe(true);
  await expect(header).not.toBeInViewport();
  await expect(bottomBar).not.toBeInViewport();

  // Up: both are back at once.
  await scrollTo(page, 820);
  expect(await navHidden(page)).toBe(false);
  await expect(header).toBeInViewport();
  await expect(bottomBar).toBeInViewport();

  // Down again, then stop: back after about half a second.
  await scrollTo(page, 1500);
  expect(await navHidden(page)).toBe(true);
  await page.waitForTimeout(250);
  expect(await navHidden(page)).toBe(true);
  await expect.poll(() => navHidden(page), { timeout: 2_000 }).toBe(false);
  await expect(header).toBeInViewport();

  // With the search panel open the header stays, whatever the page does.
  await scrollTo(page, 1900);
  await expect.poll(() => navHidden(page), { timeout: 2_000 }).toBe(false);
  await header.getByRole("button", { name: "Search products" }).click();
  await expect(page.getByRole("dialog", { name: "Search products" })).toBeVisible();
  await scrollTo(page, 2400);
  expect(await navHidden(page)).toBe(false);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  // Nothing moved sideways and no layout shifted: a transform only.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test("the desktop header is unchanged: its own search field, and it never slides away", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${BASE}/`);
  const header = page.getByRole("banner");
  await expect(header.getByRole("combobox", { name: "Search products" })).toBeVisible();
  await expect(header.getByRole("button", { name: "Search products" })).toBeHidden();
  await scrollTo(page, 600);
  await scrollTo(page, 1200);
  expect(await navHidden(page)).toBe(false);
  await expect(header).toBeInViewport();
});
