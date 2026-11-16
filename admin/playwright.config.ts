import { defineConfig } from "@playwright/test";
import { PORTS } from "./e2e/ports";
import { testMaterial } from "./e2e/support/test-material";

/**
 * Browser tests of the Central Admin (pnpm run e2e). They run against a
 * production build in its own folder (.next-e2e), connected to the
 * disposable admin database, the account-service stand-in and the stand-in
 * for Tanzania's backend of e2e/global-setup.ts. The installed Google
 * Chrome is used (channel "chrome"). Nothing here reaches Supabase, a real
 * country or any shared system: every variable the application reads is set
 * here, and a variable set here wins over a developer's own .env.local.
 *
 * The key that signs country requests and the stand-in country's TLS
 * certificate are made up for the run (e2e/support/test-material.ts). No
 * real country holds the public half, so none would accept these requests.
 */
const material = testMaterial();

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
        COUNTRY_API_SIGNING_KEY: material.signingPrivateKey,
        COUNTRY_API_SIGNING_KEY_ID: material.signingKeyId,
        // Trust the stand-in country's throwaway certificate, and nothing else new.
        NODE_EXTRA_CA_CERTS: material.tlsCertFile,
      },
    },
  ],
});
