import { expect, test } from "@playwright/test";
import { PORTS } from "./ports";

/**
 * Homepage Offers & Promotions (owner request 2026-11-19): no red band, and
 * the row moves only when the visitor moves it — never by itself. A mouse
 * drag moves it without opening the card the drag started on; a plain
 * click still opens the card.
 */
const BASE = `http://localhost:${PORTS.connected}`;

test("the Offers row stays still until the visitor drags it, and a drag does not open a product", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 900 });
  await page.goto(`${BASE}/`);
  const section = page.locator("section[aria-labelledby='home-offers']");
  await expect(section.getByRole("heading", { name: "Offers & Promotions" })).toBeVisible();
  const row = section.getByRole("list", { name: "Offers" });
  await row.scrollIntoViewIfNeeded();

  // No red band behind the section.
  const background = await section.evaluate((element) => {
    const colours: string[] = [];
    for (let node: Element | null = element.querySelector("ul"); node && node !== element.parentElement; node = node.parentElement) {
      const style = getComputedStyle(node);
      colours.push(style.backgroundImage, style.backgroundColor);
    }
    return colours.join(" ");
  });
  expect(background).not.toMatch(/rgb\(215, 25, 32\)|#d71920|rgb\(158, 17, 24\)/i);

  // Nothing moves by itself.
  expect(await row.evaluate((list) => list.scrollWidth > list.clientWidth)).toBe(true);
  const start = await row.evaluate((list) => list.scrollLeft);
  await page.waitForTimeout(1500);
  expect(await row.evaluate((list) => list.scrollLeft)).toBe(start);
  expect(await row.evaluate((list) => list.getAnimations({ subtree: true }).filter((a) => a.playState === "running").length)).toBe(0);

  // A mouse drag to the left moves the row and stays on the homepage.
  const box = (await row.boundingBox())!;
  const y = box.y + box.height * 0.35;
  await page.mouse.move(box.x + box.width * 0.7, y);
  await page.mouse.down();
  for (let step = 1; step <= 10; step++) await page.mouse.move(box.x + box.width * 0.7 - step * 30, y);
  await page.mouse.up();
  await expect.poll(() => row.evaluate((list) => list.scrollLeft)).toBeGreaterThan(start + 100);
  await page.waitForTimeout(400);
  await expect(page).toHaveURL(`${BASE}/`);
  await section.screenshot({ path: "test-results/home/offers-820.png" });

  // A plain click still opens a product.
  const link = row.getByRole("link").first();
  const href = await link.getAttribute("href");
  await link.click();
  await expect(page).toHaveURL(`${BASE}${href}`);
});
