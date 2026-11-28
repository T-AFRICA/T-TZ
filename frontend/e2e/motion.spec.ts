import { expect, test, type Locator, type Page } from "@playwright/test";
import { PORTS } from "./ports";

/**
 * The shared motion system (packages/ui motion.css and motion.ts) in a real
 * browser: the tokens the pages get, press feedback, what follows an Add to
 * Cart (the button's "Added", the dot that travels to the cart icon, the
 * count's bump), the wishlist heart's pop, 44px touch areas on controls that
 * are drawn smaller, and that reduced motion turns the movement off without
 * turning any of the actions off.
 */
const BASE = `http://localhost:${PORTS.connected}`;

/** A product card's Add button for a product without options (those open a dialog first). */
const plainAdd = (page: Page) =>
  page
    .getByRole("button", { name: /^Add to cart: / })
    .filter({ hasNotText: /choose options/ })
    .and(page.locator(":not([aria-haspopup])"))
    .first();

const flyingDot = (page: Page) => page.locator("[data-motion-fly]");
const scaleOf = (locator: Locator) => locator.evaluate((element) => getComputedStyle(element).scale);

/** The control found at a point offset from a control's centre, as a description. */
async function ownerAt(page: Page, control: Locator, dx: number, dy: number): Promise<boolean> {
  const handle = await control.elementHandle();
  return page.evaluate(
    ([element, x, y]) => {
      const box = (element as Element).getBoundingClientRect();
      const found = document.elementFromPoint(box.left + box.width / 2 + (x as number), box.top + box.height / 2 + (y as number));
      return found !== null && (element as Element).contains(found);
    },
    [handle, dx, dy] as const,
  );
}

test("the pages get the motion tokens, inside the timing ranges", async ({ page }) => {
  await page.goto(`${BASE}/`);
  const tokens = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    const read = (name: string) => style.getPropertyValue(name).trim();
    // The build may write 100ms as .1s; compare the time, not the spelling.
    const ms = (name: string) => {
      const value = read(name);
      return Math.round(Number.parseFloat(value) * (value.endsWith("ms") ? 1 : 1000));
    };
    return {
      instant: ms("--motion-instant"),
      fast: ms("--motion-fast"),
      base: ms("--motion-base"),
      slow: ms("--motion-slow"),
      slower: ms("--motion-slower"),
      spring: read("--ease-spring"),
      settle: read("--ease-settle"),
      out: read("--ease-out"),
    };
  });
  expect(tokens).toMatchObject({ instant: 100, fast: 160, base: 240, slow: 320, slower: 420 });
  expect(tokens.spring).toMatch(/^linear\(/);
  expect(tokens.settle).toMatch(/^linear\(/);
  expect(tokens.out).toMatch(/^cubic-bezier\(/);
  // The browser accepts the spring curve (an unknown curve would compute to "ease").
  const accepted = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.transition = "scale 320ms var(--ease-spring)";
    document.body.append(probe);
    const value = getComputedStyle(probe).transitionTimingFunction;
    probe.remove();
    return value;
  });
  expect(accepted).toMatch(/^linear\(/);
});

test("a pressed button squashes at once and comes back, without moving anything around it", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/`);
  const add = plainAdd(page);
  await add.scrollIntoViewIfNeeded();
  expect(await scaleOf(add)).toBe("none");

  // The card lifts a little under the pointer; measure once that has settled.
  await add.hover();
  await page.waitForTimeout(500);
  const before = await add.boundingBox();
  const neighbour = await add.locator("xpath=preceding-sibling::button").boundingBox();
  await page.mouse.down();
  // Going down takes 100ms.
  await expect.poll(() => scaleOf(add), { timeout: 1_000 }).toBe("0.975 0.945");
  // Scale does not take part in layout: the button next to it has not moved.
  expect(await add.locator("xpath=preceding-sibling::button").boundingBox()).toEqual(neighbour);
  // Take the pointer away before letting go, so this press adds nothing to the cart.
  await page.mouse.move(5, 5);
  await page.mouse.up();
  await expect.poll(() => scaleOf(add), { timeout: 2_000 }).toBe("none");
  // Back under the pointer, it is exactly where it was.
  await add.hover();
  await page.waitForTimeout(500);
  expect(await add.boundingBox()).toEqual(before);
});

for (const { width, where } of [
  { width: 1440, where: "the header's cart icon" },
  { width: 375, where: "the bottom bar's cart tab" },
] as const) {
  test(`Add to Cart at ${width}px: the button says Added, a dot travels to ${where}, the count appears`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE}/`);
    const add = plainAdd(page);
    await add.scrollIntoViewIfNeeded();

    // Record every place the dot is seen, from before the click.
    await page.evaluate(() => {
      const seen: { x: number; y: number }[] = [];
      Object.assign(window, { __flyPath: seen });
      const tick = () => {
        const dot = document.querySelector("[data-motion-fly] > div");
        if (dot) {
          const box = dot.getBoundingClientRect();
          seen.push({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    await add.click();
    // Where the button is now: the click may have scrolled it clear of the bottom bar.
    const start = await add.boundingBox();
    // The action's own results, at once: the button, the count, the announcement.
    await expect(add).toHaveText("Added");
    await expect(add).toHaveAttribute("data-added", "");
    await expect(page.getByRole("status").filter({ hasText: /Added 1 × .* to your cart/ })).toBeVisible();
    const target = page.locator("[data-cart-target]").and(page.locator(":visible")).first();
    await expect(target).toContainText("1");

    // The dot is decoration: it never takes the pointer, and it removes itself.
    await expect(flyingDot(page)).toHaveCount(0, { timeout: 3_000 });
    const path = await page.evaluate(() => (window as unknown as { __flyPath: { x: number; y: number }[] }).__flyPath);
    expect(path.length, "frames in which the dot was seen").toBeGreaterThan(3);
    const end = await target.boundingBox();
    const first = path[0]!;
    const last = path[path.length - 1]!;
    // It starts at the button and ends near the cart icon.
    expect(Math.abs(first.x - (start!.x + start!.width / 2))).toBeLessThan(60);
    expect(Math.hypot(last.x - (end!.x + end!.width / 2), last.y - (end!.y + end!.height / 2))).toBeLessThan(120);
    // It travels on an arc: at some point it is clearly off the straight line between the two.
    const dx = last.x - first.x;
    const dy = last.y - first.y;
    const length = Math.hypot(dx, dy);
    const offLine = Math.max(...path.map((point) => Math.abs(dy * (point.x - first.x) - dx * (point.y - first.y)) / length));
    expect(offLine, "greatest distance from the straight line").toBeGreaterThan(15);

    // The button goes back to its label.
    await expect(add).toHaveText("Add", { timeout: 4_000 });
    await expect(add).not.toHaveAttribute("data-added", "");
    // A second add changes the count, and the count's bubble bumps.
    await add.click();
    await expect(target).toContainText("2");
    const bumped = await target.evaluate((link) => [...link.querySelectorAll("span[aria-hidden=true]")].some((bubble) => bubble.getAnimations().length > 0));
    expect(bumped).toBe(true);
  });
}

test("saving to the wishlist pops the heart; removing it only dips", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/`);
  const heart = page.getByRole("button", { name: /^Save .* to wishlist$/ }).first();
  await heart.scrollIntoViewIfNeeded();
  const name = (await heart.getAttribute("aria-label"))!.replace(/^Save (.*) to wishlist$/, "$1");
  await heart.click();
  const saved = page.getByRole("button", { name: `Remove ${name} from wishlist` }).first();
  await expect(saved).toHaveAttribute("aria-pressed", "true");
  const pop = await saved.evaluate((button) => button.querySelector("span")!.getAnimations().map((animation) => (animation.effect as KeyframeEffect).getTiming().duration));
  expect(pop).toEqual([420]);
  await expect.poll(() => saved.evaluate((button) => button.querySelector("span")!.getAnimations().length), { timeout: 2_000 }).toBe(0);
  await saved.click();
  const unsaved = page.getByRole("button", { name: `Save ${name} to wishlist` }).first();
  await expect(unsaved).toHaveAttribute("aria-pressed", "false");
  const dip = await unsaved.evaluate((button) => button.querySelector("span")!.getAnimations().map((animation) => (animation.effect as KeyframeEffect).getTiming().duration));
  expect(dip).toEqual([240]);
});

test("with reduced motion nothing travels or squashes, and every action still works", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/`);
  const add = plainAdd(page);
  await add.scrollIntoViewIfNeeded();

  // Watch for the dot from before the click: it must never be added to the page.
  await page.evaluate(() => {
    Object.assign(window, { __flySeen: 0 });
    new MutationObserver(() => {
      if (document.querySelector("[data-motion-fly]")) (window as unknown as { __flySeen: number }).__flySeen += 1;
    }).observe(document.body, { childList: true });
  });
  await add.click();
  await expect(add).toHaveText("Added");
  await expect(page.locator("[data-cart-target]").and(page.locator(":visible")).first()).toContainText("1");
  await expect(page.getByRole("status").filter({ hasText: /to your cart/ })).toBeVisible();
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => (window as unknown as { __flySeen: number }).__flySeen)).toBe(0);
  expect(await page.evaluate(() => document.getAnimations().filter((animation) => !(animation instanceof CSSAnimation) && !(animation instanceof CSSTransition)).length)).toBe(0);

  const heart = page.getByRole("button", { name: /^Save .* to wishlist$/ }).first();
  await heart.click();
  await expect(page.getByRole("button", { name: /^Remove .* from wishlist$/ }).first()).toHaveAttribute("aria-pressed", "true");
  // The press is still a state change, but it takes no time.
  const duration = await add.evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(duration.split(",").every((part) => Number.parseFloat(part) < 0.001)).toBe(true);
});

test("controls drawn smaller than 44px still take a touch 44px across, on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${BASE}/`);

  // The card's heart is drawn 32px wide.
  const heart = page.getByRole("button", { name: /^Save .* to wishlist$/ }).first();
  await heart.scrollIntoViewIfNeeded();
  expect((await heart.boundingBox())!.width).toBeLessThan(44);
  for (const [dx, dy] of [[-21, 0], [0, 21], [-21, 21], [0, -21]] as const) {
    expect(await ownerAt(page, heart, dx, dy), `heart at ${dx},${dy}`).toBe(true);
  }
  // Just outside 44px it is not the heart.
  expect(await ownerAt(page, heart, -26, 0)).toBe(false);

  // The card's Add and Buy now buttons are drawn 34px tall.
  const add = plainAdd(page);
  await add.scrollIntoViewIfNeeded();
  expect((await add.boundingBox())!.height).toBeLessThan(44);
  expect(await ownerAt(page, add, 0, -21)).toBe(true);
  expect(await ownerAt(page, add, 0, 21)).toBe(true);
  // Side by side, each keeps its own width: the wider area is in height only.
  const buy = add.locator("xpath=preceding-sibling::button");
  expect(await ownerAt(page, buy, 0, -21)).toBe(true);
  const addBox = (await add.boundingBox())!;
  expect(await ownerAt(page, buy, addBox.x + 4 - ((await buy.boundingBox())!.x + (await buy.boundingBox())!.width / 2), 0)).toBe(false);

  // The hero's dots are drawn 24px tall.
  await page.evaluate(() => window.scrollTo(0, 0));
  const dot = page.getByRole("button", { name: /^Show slide 3:/ });
  expect((await dot.boundingBox())!.height).toBeLessThan(44);
  expect(await ownerAt(page, dot, 0, -20)).toBe(true);
});

test("a dialog settles into place on the shared curve while the page dims", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/`);
  const withOptions = page.getByRole("button", { name: /^Add to cart: .* choose options$/ }).first();
  test.skip((await withOptions.count()) === 0, "no product with options on the homepage in this catalogue");
  await withOptions.scrollIntoViewIfNeeded();
  await withOptions.click();
  const dialog = page.getByRole("dialog", { name: "Choose options" });
  await expect(dialog).toBeVisible();
  const style = await dialog.evaluate((element) => {
    const own = getComputedStyle(element);
    const backdrop = getComputedStyle(element, "::backdrop");
    return { name: own.animationName, duration: own.animationDuration, backdrop: backdrop.animationName, backdropDuration: backdrop.animationDuration };
  });
  expect(style).toEqual({ name: "m-dialog-in", duration: "0.32s", backdrop: "m-fade-in", backdropDuration: "0.24s" });
  // Nothing was added by opening it.
  await expect(page.locator("[data-cart-target]").and(page.locator(":visible")).first()).not.toContainText(/\d/);
});
