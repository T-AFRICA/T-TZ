import { generateKeyPairSync } from "node:crypto";
import { defineConfig } from "@playwright/test";
import { PORTS } from "./e2e/ports";

/**
 * Browser tests (pnpm run e2e). They run against a production build in its
 * own folder (.next-e2e) and two servers of that build:
 *   - connected: DATA_SOURCE=database on the disposable PGlite test
 *     database and the stand-in Supabase Auth of e2e/global-setup.ts;
 *   - disconnected: the mock catalogue with no auth and no orders.
 * The installed Google Chrome is used (channel "chrome"), so no browser
 * download is needed. Nothing here reaches Supabase or any shared system:
 * a developer's own .env.local may hold real project settings, and Next.js
 * loads that file for these servers too, so each server sets (or blanks)
 * every such variable itself. A variable set here wins over the file.
 */
/**
 * The admin API tests (e2e/admin-api.spec.ts) sign requests the way the
 * Central Admin does. The key pair is made up for the run and kept in this
 * process's environment, which the test workers inherit: the connected
 * server gets the public half, the tests sign with the private half. No
 * real deployment holds either.
 */
if (!process.env.E2E_CENTRAL_ADMIN_PRIVATE || !process.env.E2E_CENTRAL_ADMIN_PUBLIC) {
  const pair = generateKeyPairSync("ec", { namedCurve: "P-256" });
  process.env.E2E_CENTRAL_ADMIN_PRIVATE = pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  process.env.E2E_CENTRAL_ADMIN_PUBLIC = pair.publicKey.export({ type: "spki", format: "pem" }).toString();
}

const verifyPem = process.env.E2E_CENTRAL_ADMIN_PUBLIC;

const common = {
  NEXT_DIST_DIR: ".next-e2e",
  NEXT_TELEMETRY_DISABLED: "1",
};

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    channel: "chrome",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: `pnpm exec next start -p ${PORTS.connected}`,
      url: `http://localhost:${PORTS.connected}/login`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        ...common,
        DATA_SOURCE: "database",
        DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${PORTS.database}/postgres`,
        DATABASE_POOL_MAX: "1",
        // Off by default so every test reads the test database as it is now;
        // E2E_CATALOG_CACHE_SECONDS turns the shared catalogue cache on for a run.
        CATALOG_CACHE_SECONDS: process.env.E2E_CATALOG_CACHE_SECONDS ?? "0",
        SUPABASE_URL: `http://127.0.0.1:${PORTS.auth}`,
        SUPABASE_ANON_KEY: "e2e-anon-key-not-a-secret",
        WEB_ORIGIN: `http://localhost:${PORTS.connected}`,
        CENTRAL_ADMIN_VERIFY_KEY: verifyPem,
        CENTRAL_ADMIN_VERIFY_KEY_ID: "e2e",
      },
    },
    {
      command: `pnpm exec next start -p ${PORTS.disconnected}`,
      url: `http://localhost:${PORTS.disconnected}/login`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        ...common,
        DATA_SOURCE: "mock",
        DATABASE_URL: "",
        SUPABASE_URL: "",
        SUPABASE_ANON_KEY: "",
        CENTRAL_ADMIN_VERIFY_KEY: "",
        CENTRAL_ADMIN_VERIFY_KEY_ID: "",
      },
    },
  ],
});
