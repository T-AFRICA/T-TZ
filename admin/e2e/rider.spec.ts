import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { adminSql, countrySql, expectRefused, newSession, sideways, signIn, signInWithCode } from "./support/helpers";
import { ACCOUNTS } from "./support/stack";

/**
 * Deliveries by TRONIC's riders, end to end on this machine: an Order
 * Manager gives an order to a rider; the rider, on a phone-sized screen,
 * picks it up, starts the delivery and hands it over with the customer's
 * code, a photo and a signature, collecting the cash. Everything is checked
 * in the stand-in country's own database.
 *
 * Runs after orders.spec.ts (file order): Tanzania's service is connected
 * there. The order is synthetic (support/country.ts: "Juma Said").
 */
const SHOTS = path.join(process.cwd(), "test-results", "rider");

test.beforeAll(() => {
  mkdirSync(SHOTS, { recursive: true });
});

async function orderOf(name: string): Promise<string> {
  const [row] = await countrySql<{ order_number: string }>(`select order_number from orders where contact_name = $1`, [name]);
  return row!.order_number;
}

async function confirmStep(page: Page, region: string, button: string) {
  await page.getByRole("region", { name: region }).getByRole("button", { name: button }).click();
  await page.getByRole("dialog").getByRole("button", { name: button }).click();
}

test("an order manager gives a packed order to a rider; the rider delivers it with the code, a photo, a signature and the cash", async ({ page, browser }) => {
  const juma = await orderOf("Juma Said");

  // Order Manager: prepare the order, then give it to the rider.
  await signIn(page, ACCOUNTS.tzOrders);
  await page.goto(`/c/tz/orders/${juma}`);
  for (const step of ["Confirm order", "Start processing", "Mark as packed"]) {
    await confirmStep(page, "Next step", step);
    await expect(page.getByText(new RegExp(`Order ${juma} is now`)).first()).toBeVisible();
  }
  const delivery = page.getByRole("region", { name: "Delivery", exact: true });
  await expect(delivery).toContainText("No rider yet.");
  await delivery.getByLabel("Rider").selectOption({ label: ACCOUNTS.tzRider });
  await delivery.getByRole("button", { name: "Assign rider" }).click();
  await expect(page.getByText(`Order ${juma} is now with ${ACCOUNTS.tzRider}.`).first()).toBeVisible();
  await expect(delivery).toContainText(ACCOUNTS.tzRider);

  // The rider, on a phone.
  const rider = await newSession(browser, 375, 812);
  await signIn(rider, ACCOUNTS.tzRider);
  // A rider of one country starts on their own dashboard, counted from their deliveries.
  await rider.goto("/");
  await expect(rider).toHaveURL(/\/c\/tz$/);
  await expect(rider.getByRole("heading", { level: 1, name: "Your deliveries today" })).toBeVisible();
  await expect(rider.getByText("Unavailable", { exact: true })).toHaveCount(0);
  await expect(rider.getByRole("link", { name: /Ready to pick up\s*1/ })).toBeVisible();
  await expect(rider.getByRole("link", { name: /Cash to collect\s*TZS 22,000/ })).toBeVisible();
  await expect(rider.getByRole("list", { name: "Next deliveries" })).toContainText("Juma Said");
  expect(await sideways(rider)).toBeLessThanOrEqual(1);
  await rider.screenshot({ path: path.join(SHOTS, "375-rider-dashboard.png"), fullPage: true });
  await rider.goto("/c/tz/deliveries");
  await expect(rider.getByRole("heading", { level: 1, name: "My deliveries" })).toBeVisible();
  const card = rider.getByRole("list", { name: "Deliveries to make" }).getByRole("link").filter({ hasText: "Juma Said" });
  await expect(card).toContainText("Collect TZS");
  expect(await sideways(rider)).toBeLessThanOrEqual(1);
  await card.click();
  await expect(rider.getByRole("heading", { level: 1, name: "Juma Said" })).toBeVisible();
  await expect(rider.getByRole("link", { name: /Call \+255712000004/ })).toHaveAttribute("href", "tel:+255712000004");

  await confirmStep(rider, "Next step", "I have picked it up");
  await expect(rider.getByText(`Order ${juma} picked up.`).first()).toBeVisible();
  await confirmStep(rider, "Next step", "Start the delivery");
  await expect(rider.getByText(/The customer can now see their code/).first()).toBeVisible();

  // The rider's map: their own position (this phone) and the point the customer shared, with the distance.
  // OpenFreeMap is not reached from the tests: the map says it could not load, the rest still works.
  await rider.route("https://tiles.openfreemap.org/**", (route) => route.abort());
  await rider.context().grantPermissions(["geolocation"]);
  await rider.context().setGeolocation({ latitude: -6.78, longitude: 39.25 });
  await countrySql(
    `insert into order_delivery_points (order_id, lat, lng, accuracy_m) select id, -6.7924, 39.2083, 20 from orders where order_number = $1
       on conflict (order_id) do update set lat = excluded.lat, lng = excluded.lng`,
    [juma],
  );
  await rider.reload();
  await expect(rider.getByRole("region", { name: "Map with your location and the customer's pin" })).toBeVisible();
  await expect(rider.getByTestId("rider-distance")).toHaveText(/About 4\.\d km from you to the customer's pin/);
  await expect(rider.getByRole("link", { name: "Directions to the customer's pin" })).toHaveAttribute("href", /destination=-6\.7924\d*,39\.2083/);
  expect(await sideways(rider)).toBeLessThanOrEqual(1);

  // The code the customer has on their order page, read from the country's
  // own records for this test.
  const [{ code }] = (await countrySql<{ code: string }>(
    `select d.code from deliveries d join orders o on o.id = d.order_id where o.order_number = $1`,
    [juma],
  )) as [{ code: string }];
  // The order number with the customer's email, both of which the rider is
  // shown, does not give the code (country migration 0020): only the
  // signed-in owner of the order gets it.
  const [shown] = await countrySql<{ result: { code: string } | null }>(`select customer_delivery_code($1, 'juma@example.test') as result`, [juma]);
  expect(shown!.result).toBeNull();

  const handover = rider.getByRole("region", { name: "Hand over the order" });
  // A wrong code first.
  await handover.getByLabel("Customer's delivery code").fill(code === "000000" ? "111111" : "000000");
  await handover.getByRole("button", { name: "Mark as delivered" }).click();
  await expect(handover.getByText("Take the photo and get the customer's signature first.")).toBeVisible();

  await handover.getByLabel("Photo of the order at the door").setInputFiles({ name: "door.png", mimeType: "image/png", buffer: await rider.screenshot() });
  await expect(handover.getByRole("img", { name: "The photo that will be sent" })).toBeVisible();
  const pad = handover.getByRole("img", { name: "Customer's signature" });
  const box = (await pad.boundingBox())!;
  await rider.mouse.move(box.x + 20, box.y + box.height / 2);
  await rider.mouse.down();
  await rider.mouse.move(box.x + 120, box.y + 30, { steps: 8 });
  await rider.mouse.move(box.x + 220, box.y + box.height - 30, { steps: 8 });
  await rider.mouse.up();
  // The cash must be confirmed.
  const wrong = code === "000000" ? "111111" : "000000";
  await handover.getByLabel("Customer's delivery code").fill(wrong);
  await handover.getByRole("button", { name: "Mark as delivered" }).click();
  await expect(handover.getByText("Confirm that you collected the full amount in cash.").first()).toBeVisible();
  await handover.getByRole("checkbox", { name: /I have collected TZS/ }).check();
  // A wrong code is refused by the country and counted.
  await handover.getByLabel("Customer's delivery code").fill(wrong);
  await handover.getByRole("button", { name: "Mark as delivered" }).click();
  await expect(handover.getByText(/That code is not right\. 4 tries left/)).toBeVisible();
  await handover.getByLabel("Customer's delivery code").fill(code);
  await expect(handover.getByRole("checkbox", { name: /I have collected TZS/ })).toBeChecked();
  await rider.screenshot({ path: path.join(SHOTS, "375-handover.png"), fullPage: true });
  await handover.getByRole("button", { name: "Mark as delivered" }).click();
  await expect(rider.getByText(`Order ${juma} delivered. Thank you.`).first()).toBeVisible();
  await expect(rider.getByText("Nothing more to do.")).toBeVisible();

  expect(await countrySql(`select status, payment_status from orders where order_number = $1`, [juma])).toEqual([{ status: "delivered", payment_status: "paid" }]);
  expect(await countrySql(`select p.kind from delivery_proofs p join orders o on o.id = p.order_id where o.order_number = $1 order by p.kind`, [juma])).toEqual([
    { kind: "photo" },
    { kind: "signature" },
  ]);
  const [riderProfile] = await adminSql<{ user_id: string }>(`select user_id from admin_profiles where email = $1`, [ACCOUNTS.tzRider]);
  const steps = await countrySql<{ to_status: string; actor_id: string }>(
    `select e.to_status, e.actor_id from order_status_events e join orders o on o.id = e.order_id where o.order_number = $1 and e.to_status in ('dispatched', 'in_transit', 'delivered') order by e.id`,
    [juma],
  );
  expect(steps).toEqual(["dispatched", "in_transit", "delivered"].map((to_status) => ({ to_status, actor_id: riderProfile!.user_id })));
  const audited = await adminSql<{ action: string }>(`select action from audit_logs where actor_email = $1 and action like 'delivery.%' order by id`, [ACCOUNTS.tzRider]);
  expect(audited.map((row) => row.action)).toEqual(["delivery.pickup", "delivery.start", "delivery.deliver"]);

  // A rider reaches only their own deliveries: no orders, no other order.
  await expectRefused(rider, "/c/tz/orders");
  await expectRefused(rider, `/c/tz/deliveries/${await orderOf("Neema Kessy")}`);
  await rider.context().close();

  // The order manager sees the proofs and the cash collected.
  await page.goto(`/c/tz/orders/${juma}`);
  await expect(delivery).toContainText("Cash collected");
  await expect(delivery.getByRole("img", { name: "Customer's signature" })).toBeVisible();
  const proof = await page.request.get(`/c/tz/orders/${juma}/proof/signature`);
  expect(proof.status()).toBe(200);
  expect(proof.headers()["content-type"]).toBe("image/png");
  expect(proof.headers()["cache-control"]).toContain("no-store");
  await page.screenshot({ path: path.join(SHOTS, "order-delivered.png"), fullPage: true });
});

test("the Riders page lists the country's riders with their figures; a rider's page shows their deliveries", async ({ page }) => {
  // A Country Super Admin (the Order Manager's sign-ins are used up by earlier tests).
  await signInWithCode(page, ACCOUNTS.tzSuper);
  await page.goto("/c/tz/riders");
  await expect(page.getByRole("heading", { level: 1, name: "Riders" })).toBeVisible();
  const row = page.getByRole("table", { name: "Riders" }).getByRole("row").filter({ hasText: ACCOUNTS.tzRider });
  // From the test above: one order delivered today with TZS 22,000 collected.
  await expect(row).toContainText("TZS 22,000");
  await row.getByRole("link", { name: ACCOUNTS.tzRider }).click();
  await expect(page.getByRole("heading", { level: 1, name: ACCOUNTS.tzRider })).toBeVisible();
  await expect(page.getByText("Delivered today", { exact: true })).toBeVisible();
  await expect(page.getByRole("table", { name: "Recent deliveries" })).toContainText("Juma Said");
  await expect(page.getByRole("table", { name: "Recent deliveries" })).toContainText("TZS 22,000");
  expect(await sideways(page)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(SHOTS, "rider-page.png"), fullPage: true });

  // The rider's name and phone, which the customer sees on the way.
  const contact = page.getByRole("region", { name: "Name and phone" });
  await contact.getByLabel("Rider's name").fill("Baraka  Mushi");
  await contact.getByLabel("Rider's phone").fill("0712 000 333");
  await contact.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/^Saved\. The customer sees this name and phone/).first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Baraka Mushi" })).toBeVisible();

  // A new rider is added here with the email they sign in with, their name and phone
  // (one sign-in for both: sign-ins per address are limited).
  await page.goto("/c/tz/riders");
  const add = page.getByRole("region", { name: "Add a rider" });
  // Name and phone are needed for a rider: the customer sees and calls them.
  await add.getByLabel("Email address").fill("new.rider@example.test");
  await add.getByRole("button", { name: "Add rider" }).click();
  await expect(add.getByText("Enter the rider's name; the customer sees it")).toBeVisible();
  await expect(add.getByText("Enter the rider's phone; the customer calls it")).toBeVisible();

  await add.getByLabel("Email address").fill("new.rider@example.test");
  await add.getByLabel("Name").fill("Asha Mwita");
  await add.getByLabel("Phone number").fill("0713 000 222");
  await add.getByRole("button", { name: "Add rider" }).click();
  await expect(page.getByText(/Invitation recorded\. Asha Mwita gets the Rider role when they first sign in with new\.rider@example\.test\./).first()).toBeVisible();
  const waiting = page.getByRole("table", { name: "Riders waiting for their first sign-in" }).getByRole("row").filter({ hasText: "Asha Mwita" });
  await expect(waiting).toContainText("+255713000222");
  await expect(waiting).toContainText("new.rider@example.test");
  expect(await sideways(page)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(SHOTS, "riders-add.png"), fullPage: true });

  // A rider cannot open the Riders pages.
  const rider = await newSession(page.context().browser()!);
  await signIn(rider, ACCOUNTS.tzRider);
  await expectRefused(rider, "/c/tz/riders");
  await rider.context().close();
});
