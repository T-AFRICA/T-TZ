import { defineConfig } from "@playwright/test";
import { PORTS } from "./e2e/ports";

/**
 * Browser tests (pnpm run e2e). They run against a production build in its
 * own folder (.next-e2e) and two servers of that build:
 *   - connected: DATA_SOURCE=database on the disposable PGlite test
 *     database and the stand-in Supabase Auth of e2e/global-setup.ts;
 *   - disconnected: the mock catalogue with no auth and no orders.
 * The installed Google Chrome is used (channel "chrome"), so no browser
 * download is needed. Nothing here reaches Supabase or any shared system.
 */
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
        SUPABASE_URL: `http://127.0.0.1:${PORTS.auth}`,
        SUPABASE_ANON_KEY: "e2e-anon-key-not-a-secret",
        WEB_ORIGIN: `http://localhost:${PORTS.connected}`,
      },
    },
    {
      command: `pnpm exec next start -p ${PORTS.disconnected}`,
      url: `http://localhost:${PORTS.disconnected}/login`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: { ...common, DATA_SOURCE: "mock" },
    },
  ],
});
