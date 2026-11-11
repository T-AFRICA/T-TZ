import { expect, test, type Page, type Request } from "@playwright/test";
import { PORTS } from "./ports";
import { createCustomer } from "./support/control";

/**
 * Regression for review issue #1: with JavaScript disabled (or hydration
 * failed) no form may put a password, personal detail or order reference
 * into a URL. Every enabled form must POST; forms of disconnected services
 * must not submit at all.
 */
test.use({ javaScriptEnabled: false });

const CONNECTED = `http://localhost:${PORTS.connected}`;
const DISCONNECTED = `http://localhost:${PORTS.disconnected}`;

/** Records every document request the page makes. */
function track(page: Page): Request[] {
  const requests: Request[] = [];
  page.on("request", (request) => {
    if (request.isNavigationRequest()) requests.push(request);
  });
  return requests;
}

/** No URL the browser visited carries a query string or any of the secrets. */
function expectCleanUrls(page: Page, requests: Request[], secrets: string[]) {
  const urls = [page.url(), ...requests.map((r) => r.url())];
  for (const url of urls) {
    const decoded = decodeURIComponent(url);
    for (const secret of secrets) expect(decoded, url).not.toContain(secret);
    expect(new URL(url).search, url).toBe("");
  }
}

function expectPosted(requests: Request[], path: string) {
  const submits = requests.filter((r) => new URL(r.url()).pathname === path && r.method() !== "GET");
  expect(submits.length, `a POST to ${path}`).toBeGreaterThan(0);
  for (const submit of submits) expect(submit.method()).toBe("POST");
}

test.describe("account and order forms without JavaScript (services connected)", () => {
  test("sign-in posts the credentials and shows the error in the page", async ({ page }) => {
    const requests = track(page);
    await page.goto(`${CONNECTED}/login`);
    await page.getByLabel(/Email address/).fill("nobody@example.test");
    await page.getByLabel(/^Password/).fill("Wrong-Secret-42");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("That email and password don't match an account.")).toBeVisible();
    expectPosted(requests, "/login");
    expectCleanUrls(page, requests, ["Wrong-Secret-42", "nobody@example.test"]);
  });

  test("a correct sign-in opens the protected account page", async ({ page }) => {
    await createCustomer("nojs.customer@example.test", "Right-Secret-42");
    const requests = track(page);
    await page.goto(`${CONNECTED}/account`);
    await expect(page).toHaveURL(`${CONNECTED}/login`);
    await page.getByLabel(/Email address/).fill("nojs.customer@example.test");
    await page.getByLabel(/^Password/).fill("Right-Secret-42");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(`${CONNECTED}/account`);
    await expect(page.getByText("nojs.customer@example.test")).toBeVisible();
    expectPosted(requests, "/login");
    expectCleanUrls(page, requests, ["Right-Secret-42", "nojs.customer@example.test"]);
  });

  test("registration posts personal details in the body only", async ({ page }) => {
    const requests = track(page);
    await page.goto(`${CONNECTED}/register`);
    await page.getByLabel(/Full name/).fill("Neema Mollel");
    await page.getByLabel(/Email address/).fill("neema@example.test");
    await page.getByLabel(/Mobile number/).fill("0754 321 987");
    await page.getByLabel(/^Password/).fill("Tronic-Secret-9");
    await page.getByLabel(/Confirm password/).fill("Tronic-Secret-9");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText(/Check your email/)).toBeVisible();
    expectPosted(requests, "/register");
    expectCleanUrls(page, requests, ["Neema", "neema@example.test", "0754", "Tronic-Secret-9"]);
  });

  test("password recovery and reset post without exposing the email or password", async ({ page }) => {
    const requests = track(page);
    await page.goto(`${CONNECTED}/forgot-password`);
    await page.getByLabel(/Email address/).fill("recover.me@example.test");
    await page.getByRole("button", { name: "Reset password" }).click();
    await expect(page.getByText(/If an account uses that email/)).toBeVisible();

    await page.goto(`${CONNECTED}/reset-password`);
    await page.getByLabel(/New password/).fill("New-Secret-77");
    await page.getByLabel(/Confirm new password/).fill("New-Secret-77");
    await page.getByRole("button", { name: "Update password" }).click();
    // Without the session the email link opens, nothing is changed.
    await expect(page.getByText(/This reset link has expired/)).toBeVisible();

    expectPosted(requests, "/forgot-password");
    expectPosted(requests, "/reset-password");
    expectCleanUrls(page, requests, ["recover.me@example.test", "New-Secret-77"]);
  });

  test("order tracking posts the order number and contact", async ({ page }) => {
    const requests = track(page);
    await page.goto(`${CONNECTED}/track-order`);
    await page.getByLabel(/Order number/).fill("TZ-261111-DEADBEEF");
    await page.getByLabel(/Phone or email/).fill("0712 345 678");
    await page.getByRole("button", { name: "Track order" }).click();
    await expect(page.getByText(/couldn't find an order/)).toBeVisible();
    expectPosted(requests, "/track-order");
    expectCleanUrls(page, requests, ["DEADBEEF", "0712", "345"]);
  });
});

test.describe("forms of disconnected services cannot be submitted (no JavaScript)", () => {
  for (const [path, button, field] of [
    ["/login", "Sign in", /Email address/],
    ["/register", "Create account", /Email address/],
    ["/forgot-password", "Reset password", /Email address/],
    ["/reset-password", "Update password", /New password/],
    ["/track-order", "Track order", /Order number/],
  ] as const) {
    test(`${path}: submit is disabled and Enter does nothing`, async ({ page }) => {
      const requests = track(page);
      await page.goto(`${DISCONNECTED}${path}`);
      const submit = page.getByRole("button", { name: button });
      await expect(submit).toBeDisabled();
      const input = page.getByLabel(field);
      await input.fill("typed-secret@example.test");
      await input.press("Enter");
      await page.waitForTimeout(500);
      expect(requests.filter((r) => r.method() !== "GET")).toHaveLength(0);
      expect(page.url()).toBe(`${DISCONNECTED}${path}`);
      expectCleanUrls(page, requests, ["typed-secret@example.test"]);
    });
  }
});
