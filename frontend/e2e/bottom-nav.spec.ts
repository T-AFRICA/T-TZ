import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { PORTS } from "./ports";

/**
 * The phone tab bar in a real browser (owner request 2026-11-16): a rounded
 * bar that floats above the bottom edge; Products opens the list of every
 * product; the bar slides away while the page scrolls down and returns when
 * scrolling stops; and the purchase panel of a product page follows it
 * instead of being covered or left with an empty strip.
 */
const BASE = `http://localhost:${PORTS.connected}`;
const SHOTS = path.join(process.cwd(), "test-results", "bottom-nav");
const WIDTHS = [320, 375, 390, 430];
const PANEL = { slug: "sample-led-panel", name: "24W LED Panel Light" };

const navHidden = (page: Page) => page.evaluate(() => document.documentElement.dataset.navHidden === "true");
const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
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
/** The slide is a 300ms transform: wait until the element has stopped moving. */
async function settledBox(page: Page, locator: ReturnType<Page["locator"]>) {
  let last = await locator.boundingBox();
  for (let i = 0; i < 20; i += 1) {
    await page.waitForTimeout(80);
    const next = await locator.boundingBox();
    if (last && next && Math.abs(next.y - last.y) < 0.5) return next;
    last = next;
  }
  throw new Error("the element did not stop moving");
}

test.beforeAll(() => {
  mkdirSync(SHOTS, { recursive: true });
});

for (const width of WIDTHS) {
  test(`rounded floating bar at ${width}px: five tabs, clear of the edges, nothing cut off`, async ({ page }) => {
    const height = 800;
    await page.setViewportSize({ width, height });
    await page.goto(`${BASE}/`);
    const nav = page.getByRole("navigation", { name: "Primary" });
    const bar = nav.getByRole("list");
    const box = (await bar.boundingBox())!;

    // Floats: space on both sides and under it, and fully rounded ends.
    expect(box.x).toBeGreaterThanOrEqual(8);
    expect(box.x + box.width).toBeLessThanOrEqual(width - 8);
    expect(height - (box.y + box.height)).toBeGreaterThanOrEqual(6);
    expect(Math.abs(box.x + box.width / 2 - width / 2)).toBeLessThanOrEqual(1);
    const radius = await bar.evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius));
    expect(radius).toBeGreaterThanOrEqual(box.height / 2);

    const tabs = nav.getByRole("link");
    await expect(tabs).toHaveText(["Home", "Products", "Wishlist", "Cart", "Profile"]);
    for (const tab of await tabs.all()) {
      const tabBox = (await tab.boundingBox())!;
      expect(tabBox.width).toBeGreaterThanOrEqual(44);
      expect(tabBox.height).toBeGreaterThanOrEqual(44);
      // The label fits inside its tab.
      expect(await tab.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
    }
    await expect(nav.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    expect(await sideways(page)).toBeLessThanOrEqual(1);

    // The page beside the bar still takes taps: the strip around it is not a wall.
    const beside = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x, y)?.closest(".bottom-nav") === null,
      [3, box.y + box.height / 2] as const,
    );
    expect(beside).toBe(true);
    await nav.screenshot({ path: path.join(SHOTS, `${width}-bar.png`) });
    await page.screenshot({ path: path.join(SHOTS, `${width}-home.png`) });
  });
}

test("Products opens the list of every product, with categories, stock and sort", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/`);
  const nav = page.getByRole("navigation", { name: "Primary" });
  const products = nav.getByRole("link", { name: "Products" });

  await products.click();
  await expect(page).toHaveURL(`${BASE}/products`);
  await expect(page.getByRole("heading", { level: 1, name: "All Products" })).toBeVisible();
  await expect(products).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current", "page");

  // Products of more than one category, with prices, a page at a time.
  const list = page.getByRole("region", { name: "All products" });
  const total = Number(/^(\d+) products$/.exec((await list.getByText(/^\d+ products?$/).textContent()) ?? "")?.[1]);
  expect(total).toBeGreaterThan(12);
  const cards = list.locator("ul > li").filter({ hasText: "TZS" });
  await expect(cards).toHaveCount(12);
  await expect(page.getByRole("navigation", { name: "Pagination" })).toBeVisible();
  expect(await sideways(page)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(SHOTS, "390-products.png") });

  // Sort and stock live in the URL, so back and refresh keep them.
  await page.getByLabel("Sort by").selectOption("price-asc");
  await expect(page).toHaveURL(`${BASE}/products?sort=price-asc`);
  const prices = (await cards.allTextContents()).map((text) => Number(/TZS\s*([\d,]+)/.exec(text)?.[1]?.replaceAll(",", "")));
  expect(prices.length).toBe(12);
  expect(prices).toEqual([...prices].sort((a, b) => a - b));
  await page.getByRole("link", { name: "In stock only" }).click();
  await expect(page).toHaveURL(`${BASE}/products?stock=1&sort=price-asc`);
  await expect(page.getByRole("link", { name: "In stock only" })).toHaveAttribute("aria-pressed", "true");

  // A second page, then a product: the tab stays current on both.
  await page.goto(`${BASE}/products`);
  await page.getByRole("navigation", { name: "Pagination" }).getByRole("link", { name: "2", exact: true }).click();
  await expect(page).toHaveURL(`${BASE}/products?page=2`);
  await expect(cards.first()).toBeVisible();
  await page.goto(`${BASE}/products/${PANEL.slug}`);
  await expect(page.getByRole("heading", { level: 1, name: PANEL.name })).toBeVisible();
  await expect(products).toHaveAttribute("aria-current", "page");

  // The category links lead to the category listings.
  await page.goto(`${BASE}/products`);
  await page.getByRole("navigation", { name: "Categories" }).getByRole("link", { name: "Lighting" }).click();
  await expect(page).toHaveURL(`${BASE}/categories/lighting`);
  await expect(products).toHaveAttribute("aria-current", "page");
});

test("the bar hides while the page scrolls down and returns when scrolling stops", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto(`${BASE}/products`);
  const nav = page.getByRole("navigation", { name: "Primary" });
  const bar = nav.getByRole("list");
  await expect(bar).toBeInViewport();

  await scrollTo(page, 300);
  await scrollTo(page, 700);
  expect(await navHidden(page)).toBe(true);
  // Gone completely: the bar, its gap and its shadow.
  const hiddenBox = await settledBox(page, bar);
  expect(hiddenBox.y).toBeGreaterThanOrEqual(700 + 16);

  // Scrolling has stopped: it is back after about half a second, where it was.
  await expect.poll(() => navHidden(page), { timeout: 2_000 }).toBe(false);
  const shownBox = await settledBox(page, bar);
  expect(700 - (shownBox.y + shownBox.height)).toBeGreaterThanOrEqual(6);
  await expect(bar).toBeInViewport();

  // Scrolling up brings it back at once.
  await scrollTo(page, 1100);
  expect(await navHidden(page)).toBe(true);
  await scrollTo(page, 1040);
  expect(await navHidden(page)).toBe(false);
  expect(await sideways(page)).toBeLessThanOrEqual(1);
});

test("product page: the purchase panel is never under the bar and follows it down", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto(`${BASE}/products/${PANEL.slug}`);
  const bar = page.getByRole("navigation", { name: "Primary" }).getByRole("list");
  const panel = page.locator("[data-sticky-purchase]");
  const addToCart = panel.getByRole("button", { name: "Add to Cart" });
  await expect(addToCart).toBeVisible();

  // Shown: the buttons sit above the bar with a little air, the panel reaches the bottom edge.
  const barBox = await settledBox(page, bar);
  const buttonBox = await settledBox(page, addToCart);
  const panelBox = (await panel.boundingBox())!;
  expect(barBox.y - (buttonBox.y + buttonBox.height)).toBeGreaterThanOrEqual(6);
  expect(Math.abs(panelBox.y + panelBox.height - 700)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(SHOTS, "390-product.png") });

  // The end of the page is not hidden behind the panel.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => navHidden(page), { timeout: 2_000 }).toBe(false);
  const lastBox = (await page.getByRole("contentinfo").boundingBox())!;
  const panelTop = (await settledBox(page, panel)).y;
  expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(panelTop + 1);

  // Hidden: the buttons move down into the bar's place, still on screen and usable.
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => navHidden(page), { timeout: 2_000 }).toBe(false);
  await scrollTo(page, 200);
  await scrollTo(page, 420);
  expect(await navHidden(page)).toBe(true);
  const sunk = await settledBox(page, addToCart);
  expect(sunk.y).toBeGreaterThan(buttonBox.y + 40);
  expect(sunk.y + sunk.height).toBeLessThanOrEqual(700 - 4);
  await expect.poll(() => navHidden(page), { timeout: 2_000 }).toBe(false);
  expect(Math.abs((await settledBox(page, addToCart)).y - buttonBox.y)).toBeLessThanOrEqual(1);
});

test("desktop has no tab bar", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${BASE}/products`);
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeHidden();
  await expect(page.getByRole("heading", { level: 1, name: "All Products" })).toBeVisible();
});
