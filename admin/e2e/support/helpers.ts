import { expect, type Browser, type Page } from "@playwright/test";
import { PORTS } from "../ports";
import { TEST_TOTP_CODE } from "./fake-auth";

/** Shared steps of the admin browser tests. */

export const signInSecret = () => process.env.E2E_ADMIN_SIGN_IN ?? "";

async function control<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`http://127.0.0.1:${PORTS.control}${path}`, { method: "POST", body: JSON.stringify(body) });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as T;
}

/** Reads the admin test database as its owner. */
export const adminSql = <T = Record<string, unknown>>(text: string, params: unknown[] = []) => control<T[]>("/sql", { text, params });
/** Reads the stand-in country's test database as its owner. */
export const countrySql = <T = Record<string, unknown>>(text: string, params: unknown[] = []) => control<T[]>("/country-sql", { text, params });

export async function fillSignIn(page: Page, email: string, secret = signInSecret()) {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(secret);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** The console has loaded: its header is there and no redirect is still on its way. */
export async function inConsole(page: Page) {
  await expect(page).toHaveURL(/localhost:\d+\/(c\/[a-z_]+)?$/);
  await expect(page.getByRole("button", { name: /Account menu/ })).toBeVisible();
}

/** Signs in an account whose role needs no second step. */
export async function signIn(page: Page, email: string) {
  await fillSignIn(page, email);
  await inConsole(page);
}

/** Signs in an account that already has an authenticator. */
export async function signInWithCode(page: Page, email: string) {
  await fillSignIn(page, email);
  await expect(page).toHaveURL(/\/mfa$/);
  await page.getByLabel("6-digit code").fill(TEST_TOTP_CODE);
  await page.getByRole("button", { name: "Verify" }).click();
  await inConsole(page);
}

/** Opens an address the account may not see: it looks exactly like a page that does not exist. */
export async function expectRefused(page: Page, address: string) {
  await page.goto(address);
  await expect(page.getByRole("heading", { level: 1, name: "There is nothing here for you" }), address).toBeVisible();
  await expect(page.locator("main").getByRole("table"), address).toHaveCount(0);
  await expect(page.locator("main form"), address).toHaveCount(0);
}

export async function newSession(browser: Browser, width = 1280, height = 800): Promise<Page> {
  const context = await browser.newContext({ viewport: { width, height }, baseURL: `http://localhost:${PORTS.app}` });
  return context.newPage();
}

export const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
