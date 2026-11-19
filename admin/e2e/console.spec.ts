import { mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { PORTS } from "./ports";
import { TEST_TOTP_CODE } from "./support/fake-auth";
import { ACCOUNTS } from "./support/stack";

/**
 * The Central Admin in a real browser, against the disposable admin
 * database and the account-service stand-in of global-setup.ts. Accounts
 * are synthetic (support/stack.ts). The tests run in order and share that
 * database, so a later test sees what an earlier one changed.
 */
const SHOTS = path.join(process.cwd(), "test-results", "console");
const signInSecret = () => process.env.E2E_ADMIN_SIGN_IN ?? "";

test.beforeAll(() => {
  mkdirSync(SHOTS, { recursive: true });
});

async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const response = await fetch(`http://127.0.0.1:${PORTS.control}/sql`, { method: "POST", body: JSON.stringify({ text, params }) });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as T[];
}

async function fillSignIn(page: Page, email: string, secret = signInSecret()) {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(secret);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function enterCode(page: Page, code = TEST_TOTP_CODE) {
  await page.getByLabel("6-digit code").fill(code);
  await page.getByRole("button", { name: /Verify|Confirm and continue/ }).click();
}

/** The console has loaded: its header is there and no redirect is still on its way. */
async function inConsole(page: Page) {
  await expect(page).toHaveURL(/localhost:\d+\/(c\/[a-z_]+)?$/);
  await expect(page.getByRole("button", { name: /Account menu/ })).toBeVisible();
}

/** Signs in an account that already has an authenticator. */
async function signInWithCode(page: Page, email: string) {
  await fillSignIn(page, email);
  await expect(page).toHaveURL(/\/mfa$/);
  await enterCode(page);
  await inConsole(page);
}

/**
 * Opens an address the account may not see. The refusal looks exactly like
 * a page that does not exist, and shows no table, form or record. (The
 * status is 200, not 404: the console streams its pages, so the response
 * has started before the page's own check runs. The content is what the
 * browser gets.)
 */
async function expectRefused(page: Page, address: string) {
  await page.goto(address);
  await expect(page.getByRole("heading", { level: 1, name: "There is nothing here for you" }), address).toBeVisible();
  await expect(page.locator("main").getByRole("table"), address).toHaveCount(0);
  await expect(page.locator("main form"), address).toHaveCount(0);
}

async function newSession(browser: Browser, width = 1280, height = 800): Promise<Page> {
  const context = await browser.newContext({ viewport: { width, height }, baseURL: `http://localhost:${PORTS.app}` });
  return context.newPage();
}

const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const consoleNav = (page: Page) => page.getByRole("navigation", { name: "Console" });

test("a visitor without a session reaches only the sign-in page, which has no registration", async ({ page }) => {
  for (const address of ["/", "/administrators", "/c/tz/orders", "/audit"]) {
    await page.goto(address);
    await expect(page).toHaveURL(/\/sign-in$/);
  }
  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("link", { name: /register|create|sign up/i })).toHaveCount(0);
  await expect(page.getByText("There is no self-registration.")).toBeVisible();

  // A wrong password and an unknown address get the same answer.
  await fillSignIn(page, ACCOUNTS.master, "not-the-right-one");
  const refusal = page.getByRole("alert").filter({ hasText: "That email and password don't match an administrator account." });
  await expect(refusal).toBeVisible();
  await fillSignIn(page, "nobody@example.test", "not-the-right-one");
  await expect(refusal).toBeVisible();
  await page.screenshot({ path: path.join(SHOTS, "sign-in.png") });

  const headers = (await page.request.get("/sign-in")).headers();
  expect(headers["x-robots-tag"]).toContain("noindex");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
});

test("Master Super Admin: second step, every country, every platform page", async ({ page }) => {
  await fillSignIn(page, ACCOUNTS.master);
  await expect(page).toHaveURL(/\/mfa$/);
  // The password alone opens nothing.
  await page.goto("/administrators");
  await expect(page).toHaveURL(/\/mfa$/);
  await enterCode(page, "000000");
  await expect(page.getByText("That code is not right or has expired.")).toBeVisible();
  await enterCode(page);
  await inConsole(page);

  await expect(page).toHaveURL(`http://localhost:${PORTS.app}/`);
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
  const countries = page.getByRole("region", { name: "Countries" }).getByRole("row");
  await expect(countries).toHaveCount(6);
  await expect(countries.nth(5)).toContainText("Congo");
  await expect(countries.nth(5)).toContainText("Awaiting confirmation");
  await expect(countries.nth(5)).toContainText("Not confirmed");
  // Business figures are never numbers while no country is connected.
  const figures = page.getByRole("region", { name: "Business figures" });
  await expect(figures.getByText("Unavailable", { exact: true })).toHaveCount(6);
  await expect(consoleNav(page).getByRole("link")).toHaveText(["Overview", "Countries", "Administrators", "Audit log", "Security events"]);
  await page.screenshot({ path: path.join(SHOTS, "master-overview.png"), fullPage: true });

  // The country switcher lists all five and opens a country.
  await page.getByRole("button", { name: /Change country/ }).click();
  await expect(page.getByRole("list", { name: "Countries" }).getByRole("link")).toHaveText([
    "All countries",
    "Tanzania",
    /Kenya/,
    /Uganda/,
    /Rwanda/,
    /Congo/,
  ]);
  await page.getByRole("list", { name: "Countries" }).getByRole("link", { name: /Kenya/ }).click();
  await expect(page).toHaveURL(/\/c\/ke$/);
  await expect(page.getByRole("heading", { level: 1, name: "Kenya" })).toBeVisible();
  await expect(consoleNav(page).getByRole("link", { name: "Orders" })).toHaveAttribute("href", "/c/ke/orders");

  for (const [address, heading] of [
    ["/countries", "Countries"],
    ["/administrators", "Administrators"],
    ["/audit", "Audit log"],
    ["/security", "Security events"],
    ["/c/tz/staff", "Staff"],
    ["/c/tz/settings", "Settings"],
    ["/c/congo", "Congo"],
  ] as const) {
    await page.goto(address);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }
  await page.goto("/administrators");
  await expect(page.getByRole("row").filter({ hasText: ACCOUNTS.tzSuspended })).toContainText("Suspended");
  // The master role cannot be chosen anywhere.
  await expect(page.getByLabel("Role", { exact: true }).locator("option")).not.toContainText(["Master Super Admin"]);
  await page.screenshot({ path: path.join(SHOTS, "master-administrators.png"), fullPage: true });
});

test("Tanzania Super Admin sees Tanzania only; asking for Kenya is refused and recorded", async ({ page }) => {
  await signInWithCode(page, ACCOUNTS.tzSuper);
  await inConsole(page);
  await expect(page).toHaveURL(/\/c\/tz$/);
  await expect(page.getByRole("heading", { level: 1, name: "Tanzania" })).toBeVisible();
  // One country: nothing to switch to.
  await expect(page.getByRole("button", { name: /Change country/ })).toHaveCount(0);
  await expect(consoleNav(page).getByRole("link", { name: "Countries" })).toHaveCount(0);
  await expect(consoleNav(page).getByRole("link", { name: "Administrators" })).toHaveCount(0);
  await expect(consoleNav(page).getByRole("link", { name: "Staff" })).toBeVisible();
  await page.screenshot({ path: path.join(SHOTS, "tz-dashboard.png"), fullPage: true });

  // Changing the country in the address does not get past the server.
  for (const address of ["/c/ke", "/c/ke/orders", "/c/ke/staff", "/c/ke/settings", "/countries", "/administrators", "/security"]) {
    await expectRefused(page, address);
  }
  const events = await sql<{ kind: string; country_id: string | null }>(
    `select e.kind, e.country_id from security_events e join admin_profiles p on p.user_id = e.actor_id where p.email = $1`,
    [ACCOUNTS.tzSuper],
  );
  expect(events.filter((event) => event.kind === "country_denied" && event.country_id === "ke").length).toBeGreaterThanOrEqual(4);
  expect(events.some((event) => event.kind === "permission_denied")).toBe(true);

  // Their audit log holds Tanzania only, whatever the address asks for.
  await page.goto("/audit?country=ke");
  await expect(page.getByRole("heading", { level: 1, name: "Audit log" })).toBeVisible();
  const rows = page.getByRole("table", { name: "Audit log" }).locator("tbody tr");
  expect(await rows.count()).toBeGreaterThan(0);
  for (const row of await rows.all()) await expect(row).toContainText("Tanzania");
  await expect(page.getByLabel("Country").locator("option")).toHaveText(["All my countries", "Tanzania"]);
});

test("Country Super Admin gives a staff role; the invited person gets exactly that role", async ({ page, browser }) => {
  await signInWithCode(page, ACCOUNTS.tzSuper);
  await page.goto("/c/tz/staff");
  await expect(page.getByRole("heading", { level: 1, name: "Staff" })).toBeVisible();
  // Staff roles only: no super admin role is on offer.
  const options = page.getByLabel("Role", { exact: true }).locator("option");
  await expect(options).not.toContainText(["Country Super Admin"]);
  await expect(options).not.toContainText(["Master Super Admin"]);
  await expect(options).toContainText(["Product Manager"]);

  // A missing choice is explained, nothing is sent.
  await page.getByRole("button", { name: "Give role" }).click();
  await expect(page.getByText("Enter a valid email address").or(page.getByText("Enter an email address"))).toBeVisible();

  await page.getByLabel("Email address", { exact: true }).fill(ACCOUNTS.stranger);
  await page.getByLabel("Role", { exact: true }).selectOption({ label: "Inventory Manager" });
  await page.getByRole("button", { name: "Give role" }).click();
  await expect(page.getByText(/Invitation recorded\. stranger@example\.test gets the Inventory Manager role/).first()).toBeVisible();
  const pending = page.getByRole("region", { name: "Pending invitations" });
  await expect(pending.getByRole("row").filter({ hasText: ACCOUNTS.stranger })).toContainText("Inventory Manager");
  await page.screenshot({ path: path.join(SHOTS, "tz-staff.png"), fullPage: true });

  // The seeded invitation: that person signs in and has the role, and nothing more.
  const invited = await newSession(browser);
  await fillSignIn(invited, ACCOUNTS.invited);
  await inConsole(invited);
  await expect(invited).toHaveURL(/\/c\/tz$/);
  await expect(consoleNav(invited).getByRole("link")).toHaveText(["Overview", "Dashboard", "Products", "Website content"]);
  await expectRefused(invited, "/c/tz/orders");
  await expectRefused(invited, "/c/tz/staff");
  await invited.context().close();

  // Withdrawn invitations give nothing.
  await pending.getByRole("row").filter({ hasText: ACCOUNTS.stranger }).getByRole("button", { name: "Withdraw" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Withdraw invitation" }).click();
  await expect(pending.getByRole("row").filter({ hasText: ACCOUNTS.stranger })).toHaveCount(0);
  const stranger = await newSession(browser);
  await fillSignIn(stranger, ACCOUNTS.stranger);
  await expect(stranger).toHaveURL(/\/no-access$/);
  await expect(stranger.getByRole("heading", { level: 1, name: "This account has no access" })).toBeVisible();
  await stranger.goto("/c/tz");
  await expect(stranger).toHaveURL(/\/no-access$/);
  await stranger.context().close();

  const audit = await sql<{ action: string; actor_email: string }>(
    `select action, actor_email from audit_logs where action in ('invitation.create', 'invitation.revoke', 'invitation.accept') order by id desc limit 3`,
  );
  expect(audit.map((entry) => [entry.action, entry.actor_email])).toEqual([
    ["invitation.revoke", ACCOUNTS.tzSuper],
    ["invitation.accept", ACCOUNTS.invited],
    ["invitation.create", ACCOUNTS.tzSuper],
  ]);
});

test("a Country Super Admin without an authenticator has to set one up first", async ({ page }) => {
  await fillSignIn(page, ACCOUNTS.keSuper);
  await expect(page).toHaveURL(/\/mfa\/setup$/);
  await page.goto("/c/ke");
  await expect(page).toHaveURL(/\/mfa\/setup$/);
  await page.getByRole("button", { name: "Set up authenticator" }).click();
  await expect(page.getByRole("img", { name: "QR code to scan with your authenticator app" })).toBeVisible();
  await page.screenshot({ path: path.join(SHOTS, "mfa-setup.png") });
  await enterCode(page, "111111");
  await expect(page.getByText("That code is not right or has expired.")).toBeVisible();
  await enterCode(page);
  await expect(page).toHaveURL(/\/c\/ke$/);
  await expect(page.getByRole("heading", { level: 1, name: "Kenya" })).toBeVisible();
  await inConsole(page);
  await expectRefused(page, "/c/tz");
});

test("staff see only their modules, which say they are not connected instead of showing sample data", async ({ page }) => {
  await fillSignIn(page, ACCOUNTS.tzOrders);
  // No second step for a staff role.
  await inConsole(page);
  await expect(page).toHaveURL(/\/c\/tz$/);
  await expect(consoleNav(page).getByRole("link")).toHaveText(["Overview", "Dashboard", "Products", "Inventory", "Orders", "Customers", "Riders"]);
  await expect(page.getByText("Unavailable", { exact: true })).toHaveCount(6);

  // Orders come from Tanzania's own backend, which nobody has registered yet.
  await page.goto("/c/tz/orders");
  await expect(page.getByRole("heading", { level: 1, name: "Orders" })).toBeVisible();
  await expect(page.getByText("Tanzania's orders cannot be shown right now")).toBeVisible();
  await expect(page.getByText("No service address is registered for this country.")).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  // A module whose part of the country API does not exist yet says that, and shows no sample rows.
  await page.goto("/c/tz/products");
  await expect(page.getByRole("heading", { level: 1, name: "Products" })).toBeVisible();
  await expect(page.getByText("Products for Tanzania cannot be shown yet")).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  for (const address of ["/c/tz/staff", "/c/tz/settings", "/c/tz/content", "/c/tz/promotions", "/audit", "/c/tz/unknown-module"]) {
    await expectRefused(page, address);
  }
});

test("a suspended account is stopped at once, mid-session, and reinstating brings it back", async ({ page, browser }) => {
  // Suspended from the start: signing in leads nowhere.
  const suspended = await newSession(browser);
  await fillSignIn(suspended, ACCOUNTS.tzSuspended);
  await expect(suspended).toHaveURL(/\/no-access$/);
  await expect(suspended.getByRole("heading", { level: 1, name: "This account is suspended" })).toBeVisible();
  await suspended.context().close();

  // A member of staff is working...
  const staff = await newSession(browser);
  await fillSignIn(staff, ACCOUNTS.tzOrders);
  await inConsole(staff);
  await expect(staff).toHaveURL(/\/c\/tz$/);

  // ...when the Master Super Admin suspends them.
  await signInWithCode(page, ACCOUNTS.master);
  await page.goto("/administrators");
  const row = page.getByRole("region", { name: "All administrators" }).getByRole("row").filter({ hasText: ACCOUNTS.tzOrders });
  await row.getByRole("button", { name: "Suspend" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Suspend this account?" })).toBeVisible();
  await dialog.getByLabel(/Reason/).fill("Left the company");
  await dialog.getByRole("button", { name: "Suspend account" }).click();
  await expect(row).toContainText("Suspended");
  await expect(row).toContainText("Reason: Left the company");

  // The same session, no new sign-in: nothing opens any more.
  await staff.goto("/c/tz/orders");
  await expect(staff).toHaveURL(/\/no-access$/);
  await expect(staff.getByRole("heading", { level: 1, name: "This account is suspended" })).toBeVisible();

  // A Master Super Admin cannot be suspended, and nobody suspends themselves.
  const own = page.getByRole("region", { name: "All administrators" }).getByRole("row").filter({ hasText: ACCOUNTS.master });
  await expect(own.getByRole("button", { name: "Suspend" })).toHaveCount(0);

  await row.getByRole("button", { name: "Reinstate" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Reinstate", exact: true }).click();
  await expect(row).toContainText("Active");
  await staff.goto("/c/tz/orders");
  await expect(staff.getByRole("heading", { level: 1, name: "Orders" })).toBeVisible();
  await staff.context().close();

  const audit = await sql<{ action: string }>(`select action from audit_logs where action like 'admin.%' order by id desc limit 2`);
  expect(audit.map((entry) => entry.action)).toEqual(["admin.reinstate", "admin.suspend"]);
});

test("Master Super Admin configures countries; Congo stays unconfirmed; a dead service address is reported as such", async ({ page }) => {
  await signInWithCode(page, ACCOUNTS.master);

  // Congo cannot be made active without its code, currency and time zone.
  await page.goto("/c/congo/settings");
  await expect(page.getByLabel("ISO country code")).toHaveValue("");
  await expect(page.getByLabel("Currency")).toHaveValue("");
  await page.getByLabel("Operational status").selectOption("active");
  await page.getByRole("button", { name: "Save configuration" }).click();
  await expect(page.getByText("A country can be active only once its ISO code, currency and time zone are set.")).toBeVisible();
  expect(await sql(`select status from countries where id = 'congo'`)).toEqual([{ status: "pending_confirmation" }]);

  // A valid change is saved and audited.
  await page.goto("/c/ug/settings");
  await page.getByLabel("Website domain").fill("uganda.example.test");
  await page.getByRole("button", { name: "Save configuration" }).click();
  await expect(page.getByText("Country configuration saved.").first()).toBeVisible();
  expect(await sql(`select website_domain from countries where id = 'ug'`)).toEqual([{ website_domain: "uganda.example.test" }]);
  await page.goto("/audit?country=ug");
  await expect(page.getByRole("table", { name: "Audit log" }).locator("tbody tr").first()).toContainText("website domain: not set → uganda.example.test");

  // Service: nothing registered, so nothing is called.
  await page.goto("/c/tz/settings");
  await expect(page.getByText("This country's service has never been checked.")).toBeVisible();
  await page.getByRole("button", { name: "Check connection" }).click();
  await expect(page.getByText("No service address is registered for this country.")).toBeVisible();
  expect(await sql(`select count(*)::int as n from country_health_checks`)).toEqual([{ n: 0 }]);

  // Plain HTTP is refused; a switched-on service without an address too.
  await page.getByLabel("Country API address").fill("http://tz.example.test");
  await page.getByRole("button", { name: "Save registration" }).click();
  await expect(page.getByText("Enter an https:// address without a trailing slash")).toBeVisible();
  await page.getByLabel("Country API address").fill("");
  await page.getByLabel("Allow the Central Admin to call this service").check();
  await page.getByRole("button", { name: "Save registration" }).click();
  await expect(page.getByText("Enter the service address before switching the service on.")).toBeVisible();

  // An address nothing listens on: the check really runs and says so.
  await page.getByLabel("Country API address").fill("https://127.0.0.1:9");
  await page.getByLabel("Allow the Central Admin to call this service").check();
  await page.getByRole("button", { name: "Save registration" }).click();
  await expect(page.getByText("Service registration saved.").first()).toBeVisible();
  await page.getByRole("button", { name: "Check connection" }).click();
  await expect(page.getByText("The country service could not be reached.").first()).toBeVisible();
  expect(await sql(`select ok, error_code from country_health_checks where country_id = 'tz'`)).toEqual([{ ok: false, error_code: "unreachable" }]);
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Countries" }).getByRole("row").filter({ hasText: "Tanzania" })).toContainText("Not answering");
  await page.screenshot({ path: path.join(SHOTS, "master-overview-after.png"), fullPage: true });

  // A Country Super Admin can look, not change.
  await page.getByRole("button", { name: /Account menu/ }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await signInWithCode(page, ACCOUNTS.tzSuper);
  await page.goto("/c/tz/settings");
  await expect(page.getByText("Only a Master Super Admin can change these values.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save configuration" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save registration" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Check connection" })).toBeVisible();
});

test("signing out ends the session; a session revoked elsewhere stops working", async ({ page }) => {
  await fillSignIn(page, ACCOUNTS.tzOrders);
  await inConsole(page);
  await expect(page).toHaveURL(/\/c\/tz$/);
  await fetch(`http://127.0.0.1:${PORTS.control}/revoke`, { method: "POST", body: JSON.stringify({ email: ACCOUNTS.tzOrders }) });
  await page.goto("/c/tz/orders");
  await expect(page).toHaveURL(/\/sign-in$/);
  expect((await page.context().cookies()).filter((cookie) => cookie.name.startsWith("sb-tronic-admin-auth-token"))).toEqual([]);

  await fillSignIn(page, ACCOUNTS.tzOrders);
  await inConsole(page);
  await expect(page).toHaveURL(/\/c\/tz$/);
  const session = (await page.context().cookies()).filter((cookie) => cookie.name.startsWith("sb-tronic-admin-auth-token"));
  expect(session.length).toBeGreaterThan(0);
  for (const cookie of session) expect(cookie.httpOnly, cookie.name).toBe(true);
  await page.getByRole("button", { name: /Account menu/ }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto("/c/tz");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("layout from 375px to 1920px: no sideways scrolling, navigation reachable", async ({ page }) => {
  await signInWithCode(page, ACCOUNTS.master);
  for (const width of [375, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
    for (const address of ["/", "/countries", "/administrators", "/audit", "/c/tz", "/c/tz/staff", "/c/tz/settings", "/c/tz/orders"]) {
      await page.goto(address);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await sideways(page), `${address} at ${width}px`).toBeLessThanOrEqual(1);
    }
    await page.goto("/administrators");
    if (width < 1024) {
      // The sidebar is a drawer behind a menu button.
      await expect(consoleNav(page)).toBeHidden();
      await page.getByRole("button", { name: "Open navigation" }).click();
      const drawer = page.getByRole("dialog", { name: "Console navigation" });
      await expect(drawer.getByRole("link", { name: "Audit log" })).toBeVisible();
      await page.screenshot({ path: path.join(SHOTS, `${width}-drawer.png`) });
      await drawer.getByRole("link", { name: "Audit log" }).click();
      await expect(page).toHaveURL(/\/audit$/);
      await expect(drawer).toBeHidden();
    } else {
      await expect(consoleNav(page).getByRole("link", { name: "Administrators" })).toHaveAttribute("aria-current", "page");
    }
    await page.screenshot({ path: path.join(SHOTS, `${width}-administrators.png`), fullPage: true });
  }
});

test("the sidebar collapses and the theme changes, and both are remembered", async ({ page }) => {
  await signInWithCode(page, ACCOUNTS.master);
  const sidebar = page.locator("aside");
  await expect(sidebar).toHaveAttribute("data-collapsed", "false");
  const wide = (await sidebar.boundingBox())!.width;
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(sidebar).toHaveAttribute("data-collapsed", "true");
  await expect.poll(async () => (await sidebar.boundingBox())!.width).toBeLessThan(wide / 2);
  // Collapsed links keep their names for assistive technology and as tooltips.
  await expect(consoleNav(page).getByRole("link", { name: "Administrators" })).toHaveAttribute("title", "Administrators");

  const theme = () => page.evaluate(() => document.documentElement.dataset.theme ?? "system");
  const canvas = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(await theme()).toBe("system");
  await page.getByRole("button", { name: /Change theme/ }).click();
  expect(await theme()).toBe("light");
  const light = await canvas();
  await page.getByRole("button", { name: /Change theme/ }).click();
  expect(await theme()).toBe("dark");
  expect(await canvas()).not.toBe(light);
  await page.screenshot({ path: path.join(SHOTS, "dark-overview.png"), fullPage: true });

  await page.reload();
  expect(await theme()).toBe("dark");
  await expect(page.locator("aside")).toHaveAttribute("data-collapsed", "true");
  await page.goto("/administrators");
  await page.screenshot({ path: path.join(SHOTS, "dark-administrators.png"), fullPage: true });
});

test("sign-in attempts for one address are limited", async ({ browser }) => {
  // Its own client address, so only the per-address limit is counted here.
  const context = await browser.newContext({ baseURL: `http://localhost:${PORTS.app}`, extraHTTPHeaders: { "x-forwarded-for": "203.0.113.77" } });
  const page = await context.newPage();
  const refusal = page.getByRole("alert").filter({ hasText: "That email and password don't match an administrator account." });
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    await fillSignIn(page, "limited@example.test", "not-the-right-one");
    await expect(refusal, `attempt ${attempt}`).toBeVisible();
  }
  await fillSignIn(page, "limited@example.test", "not-the-right-one");
  await expect(page.getByRole("alert").filter({ hasText: "Too many attempts. Wait a few minutes and try again." })).toBeVisible();
  await context.close();
});

test("nothing privileged is in what the browser downloads", async ({ page }) => {
  // The files a browser can fetch: the client chunks of the build under test.
  const root = path.join(process.cwd(), ".next-e2e", "static");
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(js|css|map|json)$/.test(name)) files.push(full);
    }
  };
  walk(root);
  expect(files.length).toBeGreaterThan(5);
  const forbidden = [
    "ADMIN_DATABASE_URL",
    "ADMIN_SUPABASE_ANON_KEY",
    "COUNTRY_API_SIGNING_KEY",
    "postgres://",
    "set local role",
    "provision_master_super_admin",
    ["BEGIN", "PRIVATE", "KEY"].join(" "),
    "e2e-anon-key-not-a-secret",
  ];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const needle of forbidden) expect(text.includes(needle), `${needle} in ${path.relative(root, file)}`).toBe(false);
  }

  // And the page a signed-out visitor gets carries no key or address either.
  const html = await (await page.request.get("/sign-in")).text();
  for (const needle of ["127.0.0.1", "postgres", "e2e-anon-key-not-a-secret", "PRIVATE KEY"]) expect(html.includes(needle), needle).toBe(false);
});
