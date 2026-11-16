import { generateKeyPairSync } from "node:crypto";
import { defineConfig } from "@playwright/test";
import { PORTS } from "./e2e/ports";

/**
 * Browser tests of the Central Admin (pnpm run e2e). They run against a
 * production build in its own folder (.next-e2e), connected to the
 * disposable database and the account-service stand-in of
 * e2e/global-setup.ts. The installed Google Chrome is used (channel
 * "chrome"). Nothing here reaches Supabase, a country or any shared system:
 * every variable the application reads is set here, and a variable set here
 * wins over a developer's own .env.local.
 *
 * The key that signs country requests is made up for the run, in memory.
 * No country holds its public half, so no real country would accept it.
 */
const signingKey = generateKeyPairSync("ec", { namedCurve: "P-256" }).privateKey.export({ type: "pkcs8", format: "pem" }).toString();

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
    baseURL: `http://localhost:${PORTS.app}`,
  },
  webServer: [
    {
      command: `pnpm exec next start -p ${PORTS.app}`,
      url: `http://localhost:${PORTS.app}/sign-in`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        NEXT_DIST_DIR: ".next-e2e",
        NEXT_TELEMETRY_DISABLED: "1",
        ADMIN_DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${PORTS.database}/postgres`,
        ADMIN_DATABASE_POOL_MAX: "1",
        ADMIN_SUPABASE_URL: `http://127.0.0.1:${PORTS.auth}`,
        ADMIN_SUPABASE_ANON_KEY: "e2e-anon-key-not-a-secret",
        COUNTRY_API_SIGNING_KEY: signingKey,
        COUNTRY_API_SIGNING_KEY_ID: "e2e",
      },
    },
  ],
});
