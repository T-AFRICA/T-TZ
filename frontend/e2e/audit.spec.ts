import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { PORTS } from "./ports";
import { createCustomer, sql } from "./support/control";

/**
 * Frontend audit (owner brief 2026-11-17). Opt-in: it runs only with
 * AUDIT=1, because it loads every page at sixteen widths and takes minutes.
 *
 *   AUDIT=1 node e2e/run.mjs audit        (from frontend/)
 *
 * It measures and records; it asserts only the two things that must never
 * regress (no sideways scrolling, no page error). The findings go to
 * test-results/audit/*.json for the report. Everything runs against the
 * production build of e2e/run.mjs with the disposable test database and
 * the stand-in account service: timings include no real network and no
 * real database, so they show what the browser and the page do, not what a
 * customer far from the server waits for.
 */
test.skip(!process.env.AUDIT, "the audit runs only with AUDIT=1");

/**
 * AUDIT_BASE times the same journey against another address, for example
 * the live site. It only browses: it never signs in, never submits a form
 * and never places an order; the cart it fills lives in that browser only.
 */
const REMOTE = process.env.AUDIT_BASE?.replace(/\/+$/, "") ?? null;
const BASE = REMOTE ?? `http://localhost:${PORTS.connected}`;
const OUT = path.join(process.cwd(), "test-results", "audit");
const CART_KEY = "tronic.tz.cart.v1";
const WISHLIST_KEY = "tronic.tz.wishlist.v1";
// A synthetic customer of the disposable stand-in; the password is made up per run.
const CUSTOMER = ["audit.customer@example.test", `Audit-${randomUUID()}`] as const;

const WIDTHS = [320, 360, 375, 390, 393, 414, 430, 768, 820, 1024, 1280, 1366, 1440, 1600, 1920, 2560];
const heightFor = (width: number) => (width <= 430 ? 844 : width <= 1024 ? 1100 : 900);

const PUBLIC_PAGES = [
  "/",
  "/products",
  "/products?page=2",
  "/categories/lighting",
  "/categories/lighting/indoor-lighting",
  "/categories/cables-wiring",
  "/products/sample-led-panel",
  "/products/sample-extension",
  "/search?q=led",
  "/search?q=zzzz-nothing",
  "/wishlist",
  "/cart",
  "/checkout",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/track-order",
  "/meter",
  "/about",
];
const ACCOUNT_PAGES = [
  "/account",
  "/account/orders",
  "/account/tracking",
  "/account/wishlist",
  "/account/addresses",
  "/account/payments",
  "/account/invoices",
  "/account/notifications",
  "/account/support",
  "/account/profile",
  "/account/security",
];

test.beforeAll(() => {
  mkdirSync(OUT, { recursive: true });
});

/** What is measured on one page at one width. Runs in the page. */
function probe() {
  const doc = document.documentElement;
  const vw = doc.clientWidth;
  const vh = window.innerHeight;
  const mobile = vw <= 430;
  const visible = (el: Element) => {
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const describe = (el: Element) => {
    const name = (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
    return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}.${String(el.className).split(/\s+/).slice(0, 3).join(".")} "${name}"`;
  };
  /** True when an ancestor scrolls sideways on purpose (a carousel, a table). */
  const inScroller = (el: Element) => {
    for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
      const overflow = getComputedStyle(node).overflowX;
      if ((overflow === "auto" || overflow === "scroll" || overflow === "hidden" || overflow === "clip") && node.scrollWidth > node.clientWidth) return true;
    }
    return false;
  };

  const sideways = doc.scrollWidth - doc.clientWidth;
  const offenders: string[] = [];
  if (sideways > 1) {
    for (const el of document.querySelectorAll("body *")) {
      if (offenders.length >= 5) break;
      if (!visible(el) || inScroller(el)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.right > vw + 1 || rect.left < -1) offenders.push(`${describe(el)} [${Math.round(rect.left)}..${Math.round(rect.right)}]`);
    }
  }

  // Text cut off inside its own box without an ellipsis or a line clamp.
  const clipped: string[] = [];
  for (const el of document.querySelectorAll("h1, h2, h3, button, a, label, th, td, dt, dd")) {
    if (clipped.length >= 5) break;
    if (!visible(el) || !el.textContent?.trim()) continue;
    const style = getComputedStyle(el);
    const hides = style.overflowX === "hidden" || style.overflowX === "clip";
    if (!hides || style.textOverflow === "ellipsis" || style.webkitLineClamp !== "none") continue;
    if (el.classList.contains("sr-only") || el.closest(".sr-only")) continue;
    if (el.scrollWidth > el.clientWidth + 2) clipped.push(describe(el));
  }

  // Controls too small to tap (phones only). 24px is the WCAG 2.2 AA floor.
  const tiny: string[] = [];
  let under44 = 0;
  if (mobile) {
    for (const el of document.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea, [role=button]")) {
      if (!visible(el) || el.closest(".sr-only") || el.classList.contains("sr-only")) continue;
      const rect = el.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > doc.scrollHeight) continue;
      // An inline link inside a sentence is exempt (WCAG 2.5.8).
      if (el.tagName === "A" && getComputedStyle(el).display === "inline") continue;
      const size = Math.min(rect.width, rect.height);
      if (size < 24 && tiny.length < 5) tiny.push(`${describe(el)} ${Math.round(rect.width)}x${Math.round(rect.height)}`);
      if (size < 44) under44 += 1;
    }
  }

  // Images drawn out of proportion.
  const distorted: string[] = [];
  for (const img of document.querySelectorAll("img")) {
    if (distorted.length >= 5) break;
    if (!visible(img) || !img.naturalWidth || !img.naturalHeight) continue;
    const fit = getComputedStyle(img).objectFit;
    if (fit !== "fill") continue;
    const rect = img.getBoundingClientRect();
    const drawn = rect.width / rect.height;
    const natural = img.naturalWidth / img.naturalHeight;
    if (Math.abs(drawn - natural) / natural > 0.04) distorted.push(`${describe(img)} drawn ${drawn.toFixed(2)} natural ${natural.toFixed(2)}`);
  }
  const brokenImages = [...document.querySelectorAll("img")].filter((img) => img.complete && img.naturalWidth === 0 && visible(img)).length;

  // Text smaller than 10px.
  let smallText = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!parent || !node.textContent?.trim() || !visible(parent) || parent.closest(".sr-only")) continue;
    if (parseFloat(getComputedStyle(parent).fontSize) < 10) smallText += 1;
  }

  // Fixed layers: the WhatsApp button against the tab bar and the sticky purchase buttons.
  const overlaps: string[] = [];
  const rectOf = (selector: string) => {
    const el = document.querySelector(selector);
    return el && visible(el) ? el.getBoundingClientRect() : null;
  };
  const hit = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const whatsapp = rectOf(".wa-float");
  const bar = rectOf(".bottom-nav ul");
  if (whatsapp && bar && hit(whatsapp, bar)) overlaps.push("WhatsApp button over the tab bar");
  if (whatsapp) {
    for (const button of document.querySelectorAll("[data-sticky-purchase] button, [data-sticky-purchase] a")) {
      if (visible(button) && hit(whatsapp, button.getBoundingClientRect())) overlaps.push(`WhatsApp button over "${(button.textContent || "").trim().slice(0, 24)}"`);
    }
  }
  if (bar && bar.bottom > vh + 1) overlaps.push("tab bar below the screen edge");

  const h1 = document.querySelector("h1");
  return {
    sideways,
    offenders,
    clipped,
    tiny,
    under44,
    distorted,
    brokenImages,
    smallText,
    overlaps,
    h1: h1 ? (h1.textContent || "").trim().slice(0, 60) : null,
    h1Count: document.querySelectorAll("h1").length,
  };
}

type Finding = ReturnType<typeof probe> & { page: string; width: number; errors: string[] };

async function sweep(page: Page, pages: readonly string[], label: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message.slice(0, 120)}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text().slice(0, 120)}`);
  });
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: heightFor(width) });
    for (const address of pages) {
      errors.length = 0;
      await page.goto(`${BASE}${address}`, { waitUntil: "load" });
      await page.waitForTimeout(250);
      const result = await page.evaluate(probe);
      findings.push({ ...result, page: address, width, errors: [...errors] });
    }
  }
  writeFileSync(path.join(OUT, `responsive-${label}.json`), JSON.stringify(findings, null, 1));
  return findings;
}

async function seedCart(page: Page) {
  await page.goto(`${BASE}/cart`);
  await page.evaluate(
    ([cartKey, cart, wishlistKey, wishlist]) => {
      window.localStorage.setItem(cartKey, cart);
      window.localStorage.setItem(wishlistKey, wishlist);
    },
    [
      CART_KEY,
      JSON.stringify([
        { productId: "sample-led-panel", quantity: 2, color: null, variant: null },
        { productId: "sample-top-plug", quantity: 1, color: null, variant: null },
      ]),
      WISHLIST_KEY,
      JSON.stringify(["sample-led-panel", "sample-top-plug"]),
    ] as const,
  );
}

test("responsive sweep: public pages at sixteen widths", async ({ page }) => {
  test.skip(REMOTE !== null, "the sweeps run against the local test build only");
  test.setTimeout(20 * 60_000);
  await seedCart(page);
  const findings = await sweep(page, PUBLIC_PAGES, "public");
  expect(findings.filter((finding) => finding.sideways > 1).map((finding) => `${finding.page} @${finding.width}: ${finding.sideways}px`)).toEqual([]);
  expect(findings.flatMap((finding) => finding.errors.filter((error) => error.startsWith("pageerror")).map((error) => `${finding.page} @${finding.width}: ${error}`))).toEqual([]);
});

test("responsive sweep: customer account at sixteen widths", async ({ page }) => {
  test.skip(REMOTE !== null, "the sweeps run against the local test build only");
  test.setTimeout(20 * 60_000);
  const customer = await createCustomer(CUSTOMER[0], CUSTOMER[1]);
  // One order of this customer, so the order and tracking pages have something to show.
  const [placed] = await sql<{ result: { order_number: string } }>(
    `select place_cod_order(gen_random_uuid(), 'TZ', $1::text::jsonb,
       '{"method":"home","region":"Dar es Salaam","district":"Kinondoni","ward":"Mikocheni","street":"Plot 12, Mwai Kibaki Rd","extra":"","notes":""}'::jsonb,
       '[{"product":"sample-led-panel","color":null,"variant":null,"quantity":1}]'::jsonb, null) as result`,
    [JSON.stringify({ name: "Audit Customer", email: CUSTOMER[0], phone: "+255712345111" })],
  );
  const number = placed!.result.order_number;
  await sql(`update orders set user_id = $1 where order_number = $2`, [customer.id, number]);

  await page.goto(`${BASE}/login`);
  await page.getByLabel(/Email address/).fill(CUSTOMER[0]);
  await page.getByLabel(/^Password/).fill(CUSTOMER[1]);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(`${BASE}/account`);

  const findings = await sweep(page, [...ACCOUNT_PAGES, `/account/orders/${number}`, `/account/orders/${number}/tracking`], "account");
  expect(findings.filter((finding) => finding.sideways > 1).map((finding) => `${finding.page} @${finding.width}: ${finding.sideways}px`)).toEqual([]);
  expect(findings.flatMap((finding) => finding.errors.filter((error) => error.startsWith("pageerror")).map((error) => `${finding.page} @${finding.width}: ${error}`))).toEqual([]);
});

// ------------------------------------------------------------ interactions --

/**
 * Installed before every page script: remembers when the last press
 * started, when the page first changed after it (the first thing a person
 * can see), and how long the browser took to paint after each interaction
 * (Event Timing, the measure behind INP).
 */
function installTimers() {
  const state = { press: 0, firstChange: 0, firstPageChange: 0, events: [] as number[] };
  (window as unknown as { __audit: typeof state }).__audit = state;
  addEventListener(
    "pointerdown",
    () => {
      state.press = performance.now();
      state.firstChange = 0;
      state.firstPageChange = 0;
      state.events = [];
    },
    true,
  );
  const start = () => {
    new MutationObserver((records) => {
      if (!state.press) return;
      const now = performance.now();
      if (!state.firstChange) state.firstChange = now;
      // The same, leaving out the navigation progress bar: what the page did
      // by itself, which is all there was before the bar existed.
      if (!state.firstPageChange && records.some((record) => !(record.target instanceof Element && record.target.closest("[data-nav-progress]")))) {
        state.firstPageChange = now;
      }
    }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  };
  if (document.documentElement) start();
  else addEventListener("DOMContentLoaded", start);
  try {
    new PerformanceObserver((list) => {
      // interactionId is in browsers but not yet in TypeScript's DOM types.
      for (const entry of list.getEntries() as (PerformanceEventTiming & { interactionId?: number })[]) {
        if (entry.interactionId && entry.startTime >= state.press - 1) state.events.push(entry.duration);
      }
    }).observe({ type: "event", durationThreshold: 16, buffered: false } as PerformanceObserverInit);
  } catch {
    // Event Timing is not available: only the other two measures are recorded.
  }
}

interface Timing {
  profile: string;
  action: string;
  /** Press to the first change on the page, in the page's clock. */
  feedbackMs: number | null;
  /** The same without the navigation progress bar: the first change of the page itself. */
  pageFeedbackMs: number | null;
  /** Press to the expected result being on screen, in the test's clock (includes a few ms of test overhead). */
  doneMs: number | null;
  /** Longest interaction the browser reported for it (rounded to 8 ms by the browser); null when under 16 ms. */
  eventMs: number | null;
  note?: string;
}

async function timed(page: Page, timings: Timing[], profile: string, action: string, act: () => Promise<unknown>, done: () => Promise<unknown>) {
  try {
    const started = Date.now();
    await act();
    await done();
    const doneMs = Date.now() - started;
    // Let the browser report the interaction it has just finished painting.
    await page.waitForTimeout(120);
    const measured = await page
      .evaluate(() => {
        const state = (window as unknown as { __audit?: { press: number; firstChange: number; firstPageChange: number; events: number[] } }).__audit;
        if (!state || !state.press) return null;
        return {
          feedback: state.firstChange ? state.firstChange - state.press : null,
          pageFeedback: state.firstPageChange ? state.firstPageChange - state.press : null,
          event: state.events.length ? Math.max(...state.events) : null,
        };
      })
      .catch(() => null);
    const round = (value: number | null | undefined) => (value === null || value === undefined ? null : Math.round(value));
    timings.push({ profile, action, feedbackMs: round(measured?.feedback), pageFeedbackMs: round(measured?.pageFeedback), doneMs, eventMs: measured?.event ?? null });
  } catch (error) {
    timings.push({ profile, action, feedbackMs: null, pageFeedbackMs: null, doneMs: null, eventMs: null, note: `could not be measured: ${String(error).split("\n")[0]?.slice(0, 140)}` });
  }
}

const first = (page: Page, selector: string) => page.locator(`${selector}:visible`).first();

async function shoppingJourney(page: Page, profile: string, timings: Timing[], mobile: boolean) {
  const h1 = (name: string | RegExp) => page.getByRole("heading", { level: 1, name }).waitFor({ state: "visible", timeout: 15_000 });
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForTimeout(1500); // hydration and link prefetching settle

  if (mobile) {
    await timed(page, timings, profile, "open the menu drawer", () => page.getByRole("button", { name: "Open menu" }).click(), () =>
      page.getByRole("dialog", { name: "Site menu" }).waitFor({ state: "visible" }),
    );
    await timed(page, timings, profile, "close the menu drawer", () => page.getByRole("button", { name: "Close menu" }).click(), () =>
      page.getByRole("dialog", { name: "Site menu" }).waitFor({ state: "hidden" }),
    );
    await timed(page, timings, profile, "tab bar: Products", () => page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Products" }).click(), () => h1("All Products"));
    await timed(page, timings, profile, "tab bar: Cart", () => page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Cart" }).click(), () => page.waitForURL(`${BASE}/cart`));
    await timed(page, timings, profile, "tab bar: Home", () => page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Home" }).click(), () => page.waitForURL(`${BASE}/`));
    await page.waitForTimeout(800);
  } else {
    await timed(page, timings, profile, "navbar: category link", () => page.getByRole("navigation", { name: "Product categories" }).locator('a[href="/categories/lighting"]').first().click(), () =>
      page.waitForURL(`${BASE}/categories/lighting`).then(() => h1(/Lighting/)),
    );
    await timed(page, timings, profile, "listing: sort by price", () => page.getByLabel("Sort by").selectOption("price-asc"), () => page.waitForURL(/sort=price-asc/));
    await timed(page, timings, profile, "listing: page 2 or next section", () => first(page, 'a[href^="/categories/lighting/"]').click(), () => page.waitForURL(/\/categories\/lighting\/.+/));
    await page.goto(`${BASE}/`, { waitUntil: "load" });
    await page.waitForTimeout(1500);
  }

  await timed(page, timings, profile, "home: open a product card", () => first(page, 'main a[href^="/products/"]').click({ force: true }), () => page.waitForURL(/\/products\/[a-z0-9-]+$/).then(() => h1(/.+/)));
  // The product steps start from a known product, whatever the step above opened.
  await page.goto(`${BASE}/products/sample-led-panel`, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  await timed(page, timings, profile, "product: increase quantity", () => first(page, 'button[aria-label="Increase quantity"]').click(), () => page.waitForTimeout(0));
  await timed(page, timings, profile, "product: save to wishlist", () => first(page, 'button[aria-label^="Save "]').click(), () => first(page, 'button[aria-label^="Remove "]').waitFor({ state: "visible" }));
  await timed(page, timings, profile, "product: Add to Cart", () => page.getByRole("button", { name: "Add to Cart" }).first().click(), () => page.waitForFunction((key) => (window.localStorage.getItem(key) ?? "").includes("sample-led-panel"), CART_KEY));
  await timed(page, timings, profile, "product: Buy Now", () => page.getByRole("button", { name: "Buy Now" }).first().click(), () => page.waitForURL(/\/checkout/).then(() => h1(/Checkout/)));

  await seedCart(page);
  await page.goto(`${BASE}/cart`, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  await timed(page, timings, profile, "cart: increase quantity", () => first(page, 'button[aria-label="Increase quantity"]').click(), () => page.waitForTimeout(0));
  await timed(page, timings, profile, "cart: proceed to checkout", () => page.getByRole("link", { name: "Proceed to checkout" }).first().click(), () => page.waitForURL(/\/checkout/).then(() => h1(/Checkout/)));
  await page.goto(`${BASE}/cart`, { waitUntil: "load" });
  await page.waitForTimeout(800);
  await timed(page, timings, profile, "cart: remove an item", () => first(page, 'button[aria-label^="Remove "]').click(), () => page.waitForTimeout(0));

  await page.goto(`${BASE}/products`, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  await timed(page, timings, profile, "all products: In stock only", () => page.getByRole("link", { name: "In stock only" }).click(), () => page.waitForURL(/stock=1/));
  await timed(page, timings, profile, "all products: page 2", () => page.getByRole("navigation", { name: "Pagination" }).getByRole("link", { name: "2", exact: true }).click(), () => page.waitForURL(/page=2/));
  await timed(page, timings, profile, "all products: card Add to cart", () => first(page, 'button[aria-label^="Add to cart:"]').click(), () => page.waitForTimeout(0));

  // Search: typing to suggestions, then a suggestion to its product.
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  if (mobile) {
    await timed(page, timings, profile, "open search", () => page.getByRole("button", { name: "Search products" }).first().click(), () => page.getByRole("combobox").first().waitFor({ state: "visible" }));
  }
  const box = first(page, 'input[role="combobox"]');
  await box.click();
  await box.pressSequentially("led pan", { delay: 40 });
  const typed = Date.now();
  await page.getByRole("listbox", { name: "Product suggestions" }).getByRole("option").first().waitFor({ state: "visible", timeout: 10_000 });
  timings.push({ profile, action: "search: last key to suggestions", feedbackMs: null, pageFeedbackMs: null, doneMs: Date.now() - typed, eventMs: null });
  if (!mobile) {
    // Quick view (desktop: beside the suggestions on hover). Buy Now straight
    // after Add to Cart: both buttons used to be switched off for 1.8 seconds.
    await page.getByRole("listbox", { name: "Product suggestions" }).getByRole("option").first().hover();
    const quick = page.locator('aside[aria-label="Quick view"]:visible').first();
    await quick.waitFor({ state: "visible", timeout: 5_000 }).catch(() => undefined);
    await timed(page, timings, profile, "quick view: Add to Cart", () => quick.getByRole("button", { name: /Add to Cart/ }).click(), () => quick.getByText("Added").waitFor({ state: "visible" }));
    await timed(page, timings, profile, "quick view: Buy Now right after adding", () => quick.getByRole("button", { name: "Buy Now" }).click(), () => page.waitForURL(/\/checkout/));
    await page.goto(`${BASE}/`, { waitUntil: "load" });
    await page.waitForTimeout(1200);
    const again = first(page, 'input[role="combobox"]');
    await again.click();
    await again.pressSequentially("led pan", { delay: 40 });
    await page.getByRole("listbox", { name: "Product suggestions" }).getByRole("option").first().waitFor({ state: "visible", timeout: 10_000 });
  }
  await timed(page, timings, profile, "search: open a suggestion", () => page.getByRole("listbox", { name: "Product suggestions" }).getByRole("option").first().locator("a").first().click(), () => page.waitForURL(/\/products\//));

  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  await timed(page, timings, profile, "header: account (sign in)", () => first(page, 'a[href="/login"]').click(), () => page.waitForURL(`${BASE}/login`).then(() => page.getByRole("button", { name: "Sign in" }).waitFor({ state: "visible" })));
  await timed(page, timings, profile, "login: go to register", () => first(page, 'a[href="/register"]').click(), () => page.waitForURL(`${BASE}/register`));
}

for (const profile of [
  { name: "desktop 1366, no throttling", width: 1366, height: 768, cpu: 1, latency: 0 },
  { name: "phone 390, CPU 4x slower, 150 ms network", width: 390, height: 844, cpu: 4, latency: 150 },
]) {
  test(`click timing: ${profile.name}`, async ({ browser }) => {
    test.setTimeout(15 * 60_000);
    const context = await browser.newContext({ viewport: { width: profile.width, height: profile.height }, hasTouch: profile.width < 768, isMobile: profile.width < 768 });
    await context.addInitScript(installTimers);
    // A step that cannot be done is recorded as such after twelve seconds; it never holds the run.
    context.setDefaultTimeout(8_000);
    const page = await context.newPage();
    const client = await context.newCDPSession(page);
    if (profile.cpu > 1) await client.send("Emulation.setCPUThrottlingRate", { rate: profile.cpu });
    if (profile.latency > 0) {
      await client.send("Network.enable");
      await client.send("Network.emulateNetworkConditions", { offline: false, latency: profile.latency, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    }
    const timings: Timing[] = [];
    await shoppingJourney(page, profile.name, timings, profile.width < 768);
    writeFileSync(path.join(OUT, `timing-${REMOTE ? "remote-" : ""}${profile.width}.json`), JSON.stringify(timings, null, 1));
    await context.close();
    // Recorded, not judged here: the report reads the file.
    expect(timings.length).toBeGreaterThan(10);
  });
}
