import { expect, test, type Page } from "@playwright/test";
import { PORTS } from "./ports";

/**
 * Homepage hero slideshow. The animated "Power Every Space" room first; when
 * its lighting cycle ends the lighting range fades in (owner request
 * 2026-11-19), then the three category banners (owner artwork 2026-11-24),
 * each staying a while, and the room comes back from the start of its cycle.
 * Dots switch by hand. All slides keep one size, from 320px to 2560px, with
 * no sideways scrolling. A category banner comes in three shapes and each
 * screen shows, and downloads, only the one made for it.
 */
const BASE = `http://localhost:${PORTS.connected}`;
const SLIDES = 5;

const BANNERS = [
  { n: 3, name: "switchgear", clear: 0.305, link: "Shop Switchgear", href: "/categories/switchgear-protection" },
  { n: 4, name: "appliances", clear: 0.305, link: "Shop Home Appliances", href: "/categories/home-appliances" },
  { n: 5, name: "switches", clear: 0.268, link: "Shop Switches & Sockets", href: "/categories/switches-sockets" },
] as const;

const carousel = (page: Page) => page.getByRole("region", { name: "TRONIC highlights" });
const slide = (page: Page, n: number) => carousel(page).getByRole("group", { name: new RegExp(`^${n} of ${SLIDES}:`) });
const dot = (page: Page, n: number) => carousel(page).getByRole("button", { name: new RegExp(`^Show slide ${n}:`) });
const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** True when the dots cover any part of the shown slide's button. */
const dotsCoverButton = (page: Page, n: number) =>
  slide(page, n).evaluate((group) => {
    const link = group.querySelector("section a")!.getBoundingClientRect();
    const dots = group.parentElement!.querySelector(":scope > div:last-child")!.getBoundingClientRect();
    return link.left < dots.right && dots.left < link.right && link.top < dots.bottom && dots.top < link.bottom;
  });

/** Where the room's lighting loop is in its 18 s cycle, in ms. */
const cyclePosition = (page: Page) =>
  page.evaluate(() => {
    const animation = document.querySelector(".hero-room-dim")?.getAnimations()[0];
    return animation ? { at: Number(animation.currentTime) % 18_000, state: animation.playState } : null;
  });

/** The banner photograph a slide is showing at this width, and where it sits in the slide. */
const shownBanner = (page: Page, n: number) =>
  slide(page, n).evaluate(async (group) => {
    const section = group.querySelector("section")!.getBoundingClientRect();
    const images = [...group.querySelectorAll("img")].filter((image) => image.getClientRects().length > 0);
    await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
    const copy = group.querySelector("[data-hero-copy]")!.getBoundingClientRect();
    return {
      section: { width: section.width, height: section.height },
      copyRight: copy.right - section.left,
      headingLines: (() => {
        const heading = group.querySelector("h2")!;
        return Math.round(heading.getBoundingClientRect().height / Number.parseFloat(getComputedStyle(heading).lineHeight));
      })(),
      images: images.map((image) => {
        const box = image.getBoundingClientRect();
        return {
          src: decodeURIComponent(image.currentSrc),
          loaded: image.naturalWidth > 0,
          width: box.width,
          height: box.height,
          left: box.left - section.left,
          bottomGap: section.bottom - box.bottom,
        };
      }),
    };
  });

test("the slides come in turn after the room's cycle, and the room returns from the start", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/`);
  await expect(slide(page, 1)).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: /Power Every/ })).toBeVisible();
  for (let n = 2; n <= SLIDES; n++) {
    expect(await slide(page, n).evaluate((element) => (element as HTMLElement).inert), `slide ${n}`).toBe(true);
  }

  // Bring the room to the end of its cycle instead of waiting 18 s.
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      if (animation instanceof CSSAnimation && animation.animationName.startsWith("hero-")) animation.currentTime = 17_700;
    }
  });
  await expect(dot(page, 2)).toHaveAttribute("aria-current", "true");
  await expect(slide(page, 2)).toHaveCSS("opacity", "1");
  expect(await slide(page, 1).evaluate((element) => (element as HTMLElement).inert)).toBe(true);
  await expect(slide(page, 2).getByRole("link", { name: "Shop Lighting" })).toHaveAttribute("href", "/categories/lighting");
  // The hidden room waits at the start of its cycle.
  const paused = await cyclePosition(page);
  expect(paused?.state).toBe("paused");
  expect(paused!.at).toBeLessThan(1_000);
  await slide(page, 2).screenshot({ path: "test-results/home/hero-lighting-1440.png" });

  // Then each category banner, one after the other, with its own link.
  for (const banner of BANNERS) {
    await expect(dot(page, banner.n)).toHaveAttribute("aria-current", "true", { timeout: 10_000 });
    await expect(slide(page, banner.n)).toHaveCSS("opacity", "1");
    await expect(slide(page, banner.n).getByRole("link", { name: banner.link })).toHaveAttribute("href", banner.href);
    expect(await slide(page, banner.n - 1).evaluate((element) => (element as HTMLElement).inert)).toBe(true);
  }

  // After the last one the room comes back and lights up from the start.
  await expect(dot(page, 1)).toHaveAttribute("aria-current", "true", { timeout: 10_000 });
  const resumed = await cyclePosition(page);
  expect(resumed?.state).toBe("running");
  expect(resumed!.at).toBeLessThan(2_000);
});

test("the dots switch by hand, and then the slideshow stays where the visitor put it", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/`);
  await expect(carousel(page).getByRole("button", { name: /^Show slide/ })).toHaveCount(SLIDES);
  await dot(page, 2).click();
  await expect(slide(page, 2)).toHaveCSS("opacity", "1");
  await page.mouse.move(0, 800);
  await page.waitForTimeout(8_000);
  await expect(dot(page, 2)).toHaveAttribute("aria-current", "true");
  await dot(page, 4).click();
  await expect(slide(page, 4)).toHaveCSS("opacity", "1");
  await expect(slide(page, 4).getByRole("link", { name: "Shop Home Appliances" })).toBeVisible();
  await dot(page, 1).click();
  await expect(slide(page, 1)).toHaveCSS("opacity", "1");
  // Keyboard: the shown slide's button is reachable, the hidden ones' are not.
  await expect(slide(page, 1).getByRole("link", { name: "Explore Products" })).toBeVisible();
  for (const hidden of [{ n: 2, link: "Shop Lighting" }, ...BANNERS]) {
    const link = slide(page, hidden.n).getByRole("link", { name: hidden.link, includeHidden: true });
    expect(await link.evaluate((element) => element.closest("[inert]") !== null), hidden.link).toBe(true);
  }
});

test("all slides keep one size and nothing overflows from 320px to 2560px", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`${BASE}/`);
  for (const width of [320, 375, 430, 768, 820, 1024, 1280, 1440, 1536, 1920, 2560]) {
    await page.setViewportSize({ width, height: 900 });
    const heights = await carousel(page).evaluate((element) =>
      [...element.querySelectorAll(":scope > [role=group] > section")].map((section) => Math.round(section.getBoundingClientRect().height)),
    );
    expect(heights, `${width}px`).toHaveLength(SLIDES);
    expect(new Set(heights).size, `${width}px: ${heights.join(", ")}`).toBe(1);
    expect(await sideways(page), `${width}px`).toBeLessThanOrEqual(0);
    await dot(page, 1).click();
    await expect(slide(page, 1)).toHaveCSS("opacity", "1");
    expect(await dotsCoverButton(page, 1), `room at ${width}px`).toBe(false);
    await dot(page, 2).click();
    await expect(slide(page, 2)).toHaveCSS("opacity", "1");
    expect(await dotsCoverButton(page, 2), `lighting at ${width}px`).toBe(false);
    if ([375, 820, 1920].includes(width)) await carousel(page).screenshot({ path: `test-results/home/hero-lighting-${width}.png` });
  }
});

test("a category banner shows the shape made for the screen, whole, with the copy clear of it", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto(`${BASE}/`);
  const widths = [
    { width: 320, shape: "mobile" },
    { width: 375, shape: "mobile" },
    { width: 430, shape: "mobile" },
    { width: 768, shape: "tablet" },
    { width: 820, shape: "tablet" },
    { width: 1024, shape: "desktop" },
    { width: 1280, shape: "desktop" },
    { width: 1440, shape: "desktop" },
    { width: 1536, shape: "desktop" },
    { width: 1920, shape: "desktop" },
    { width: 2560, shape: "desktop" },
  ] as const;
  for (const { width, shape } of widths) {
    await page.setViewportSize({ width, height: 900 });
    for (const banner of BANNERS) {
      const at = `${banner.name} at ${width}px`;
      await dot(page, banner.n).click();
      await expect(slide(page, banner.n)).toHaveCSS("opacity", "1");
      await expect(slide(page, banner.n).getByRole("link", { name: banner.link })).toBeVisible();
      const shown = await shownBanner(page, banner.n);
      // One photograph, and it is the one for this kind of screen.
      expect(shown.images, at).toHaveLength(1);
      const image = shown.images[0]!;
      expect(image.src, at).toContain(`/banners/hero-${banner.name}-${shape}.jpg`);
      expect(image.loaded, at).toBe(true);
      expect(Math.abs(image.width - shown.section.width), at).toBeLessThanOrEqual(1);
      expect(Math.abs(image.left), at).toBeLessThanOrEqual(1);

      if (shape === "mobile") {
        // Edge to edge in its own shape, so nothing is cropped.
        expect(Math.abs(image.width / image.height - 1600 / 833), at).toBeLessThan(0.01);
        await expect(slide(page, banner.n).getByRole("heading", { level: 2 })).toBeAttached();
      }
      if (shape === "tablet") {
        // Fills the photograph box; at 768px that box is the banner's own 16:7.
        if (width === 768) expect(Math.abs(image.width / image.height - 16 / 7), at).toBeLessThan(0.02);
        expect(image.bottomGap, at).toBeLessThanOrEqual(1);
        await expect(slide(page, banner.n).getByRole("heading", { level: 2 })).toBeVisible();
      }
      if (shape === "desktop") {
        // The whole 4:1 banner, standing on the hero's bottom edge and never taller than the hero.
        expect(Math.abs(image.width / image.height - 4), at).toBeLessThan(0.02);
        expect(Math.abs(image.bottomGap), at).toBeLessThanOrEqual(1);
        expect(image.height, at).toBeLessThanOrEqual(shown.section.height + 1);
        // The copy stays inside the part of the banner its designer left clear
        // (banner.clear: where that banner's first product starts).
        expect(shown.copyRight, at).toBeLessThanOrEqual(shown.section.width * banner.clear);
        // The headline keeps to two lines, so the copy does not make the hero taller.
        expect(shown.headingLines, at).toBe(2);
        await expect(slide(page, banner.n).getByRole("heading", { level: 2 })).toBeVisible();
      }
      expect(await sideways(page), at).toBeLessThanOrEqual(0);
      // Five dots are wider than two: they must not sit on the button.
      expect(await dotsCoverButton(page, banner.n), at).toBe(false);
      if ([320, 375, 768, 820, 1024, 1280, 1440, 1920, 2560].includes(width)) {
        await carousel(page).screenshot({ path: `test-results/home/hero-${banner.name}-${width}.png` });
      }
    }
  }
});

for (const { width, shape } of [
  { width: 375, shape: "mobile" },
  { width: 820, shape: "tablet" },
  { width: 1440, shape: "desktop" },
] as const) {
  test(`a ${width}px screen downloads only the ${shape} banners`, async ({ page }) => {
    const fetched: string[] = [];
    page.on("request", (request) => {
      const url = decodeURIComponent(request.url());
      const file = /\/banners\/(hero-(?:switchgear|appliances|switches)-[a-z]+\.jpg)/.exec(url)?.[1];
      if (file) fetched.push(file);
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE}/`);
    // Visit every banner, so each has had its chance to load.
    for (const banner of BANNERS) {
      await dot(page, banner.n).click();
      await expect(slide(page, banner.n)).toHaveCSS("opacity", "1");
      expect((await shownBanner(page, banner.n)).images[0]?.loaded, banner.name).toBe(true);
    }
    expect(new Set(fetched), fetched.join(", ")).toEqual(new Set(BANNERS.map((banner) => `hero-${banner.name}-${shape}.jpg`)));
  });
}
