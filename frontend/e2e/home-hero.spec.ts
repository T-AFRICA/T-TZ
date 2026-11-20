import { expect, test, type Page } from "@playwright/test";
import { PORTS } from "./ports";

/**
 * Homepage hero slideshow (owner request 2026-11-19): the animated "Power
 * Every Space" room first; when its lighting cycle ends the lighting range
 * fades in, stays a while, and the room comes back from the start of its
 * cycle. Dots switch by hand. Both slides keep one size, from 320px to
 * 1920px, with no sideways scrolling.
 */
const BASE = `http://localhost:${PORTS.connected}`;

const carousel = (page: Page) => page.getByRole("region", { name: "TRONIC highlights" });
const slide = (page: Page, n: 1 | 2) => carousel(page).getByRole("group", { name: new RegExp(`^${n} of 2:`) });

/** Where the room's lighting loop is in its 18 s cycle, in ms. */
const cyclePosition = (page: Page) =>
  page.evaluate(() => {
    const animation = document.querySelector(".hero-room-dim")?.getAnimations()[0];
    return animation ? { at: Number(animation.currentTime) % 18_000, state: animation.playState } : null;
  });

test("the lighting slide comes when the room's cycle ends, stays, and the room returns from the start", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/`);
  await expect(slide(page, 1)).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: /Power Every/ })).toBeVisible();
  expect(await slide(page, 2).evaluate((element) => (element as HTMLElement).inert)).toBe(true);

  // Bring the room to the end of its cycle instead of waiting 18 s.
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      if (animation instanceof CSSAnimation && animation.animationName.startsWith("hero-")) animation.currentTime = 17_700;
    }
  });
  await expect(carousel(page).getByRole("button", { name: /Show slide 2/ })).toHaveAttribute("aria-current", "true");
  await expect(slide(page, 2)).toHaveCSS("opacity", "1");
  expect(await slide(page, 1).evaluate((element) => (element as HTMLElement).inert)).toBe(true);
  await expect(slide(page, 2).getByRole("link", { name: "Shop Lighting" })).toHaveAttribute("href", "/categories/lighting");
  // The hidden room waits at the start of its cycle.
  const paused = await cyclePosition(page);
  expect(paused?.state).toBe("paused");
  expect(paused!.at).toBeLessThan(1_000);
  await slide(page, 2).screenshot({ path: "test-results/home/hero-lighting-1440.png" });

  // After its time the room comes back and lights up from the start.
  await expect(carousel(page).getByRole("button", { name: /Show slide 1/ })).toHaveAttribute("aria-current", "true", { timeout: 10_000 });
  const resumed = await cyclePosition(page);
  expect(resumed?.state).toBe("running");
  expect(resumed!.at).toBeLessThan(2_000);
});

test("the dots switch by hand, and then the slideshow stays where the visitor put it", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/`);
  await carousel(page).getByRole("button", { name: /Show slide 2/ }).click();
  await expect(slide(page, 2)).toHaveCSS("opacity", "1");
  await page.mouse.move(0, 800);
  await page.waitForTimeout(8_000);
  await expect(carousel(page).getByRole("button", { name: /Show slide 2/ })).toHaveAttribute("aria-current", "true");
  await carousel(page).getByRole("button", { name: /Show slide 1/ }).click();
  await expect(slide(page, 1)).toHaveCSS("opacity", "1");
  // Keyboard: the shown slide's button is reachable, the hidden one's is not.
  await expect(slide(page, 1).getByRole("link", { name: "Explore Products" })).toBeVisible();
  expect(await slide(page, 2).getByRole("link", { name: "Shop Lighting" }).evaluate((link) => link.closest("[inert]") !== null)).toBe(true);
});

test("both slides keep one size and nothing overflows from 320px to 1920px", async ({ page }) => {
  await page.goto(`${BASE}/`);
  for (const width of [320, 375, 820, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await carousel(page).getByRole("button", { name: /Show slide 2/ }).click();
    await expect(slide(page, 2)).toHaveCSS("opacity", "1");
    const heights = await carousel(page).evaluate((element) =>
      [...element.querySelectorAll(":scope > [role=group] > section")].map((section) => Math.round(section.getBoundingClientRect().height)),
    );
    expect(heights[0], `${width}px`).toBe(heights[1]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${width}px`).toBeLessThanOrEqual(0);
    if ([375, 820, 1920].includes(width)) await carousel(page).screenshot({ path: `test-results/home/hero-lighting-${width}.png` });
  }
});
