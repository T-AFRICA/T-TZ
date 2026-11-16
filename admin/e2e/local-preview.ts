import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PREVIEW_PORTS } from "./ports";
import { TEST_TOTP_CODE } from "./support/fake-auth";
import { ACCOUNTS, startStack } from "./support/stack";
import { testMaterial } from "./support/test-material";

/**
 * pnpm --filter @tronic/admin run preview:local
 *
 * LOCAL PREVIEW ONLY. Runs the admin's dev server against the same
 * disposable database, account-service stand-in and stand-in for Tanzania's
 * backend the browser tests use, with synthetic administrators and orders,
 * so the console can be looked at before the Central Admin Supabase project
 * exists. The data is gone when it stops and nothing here touches Supabase,
 * a country or production.
 *
 * The sign-in details are printed to this terminal and written to
 * admin/.preview/sign-in.txt (ignored by Git). The password is made up on
 * the first start and kept in that file, so it stays the same from one
 * start to the next; delete the file for a new one. It opens only these
 * synthetic accounts, and the dev server listens on this machine only.
 */
const DETAILS_DIR = join(__dirname, "..", ".preview");
const DETAILS_FILE = join(DETAILS_DIR, "sign-in.txt");

/** The password of an earlier start, or a new one. */
function previewSecret(): string {
  try {
    const kept = /^Password:\s+(\S{12,})$/m.exec(readFileSync(DETAILS_FILE, "utf8"));
    if (kept) return kept[1] as string;
  } catch {
    // First start: no file yet.
  }
  return randomBytes(12).toString("base64url");
}

async function main() {
  // Tanzania is connected to its stand-in from the start, so its orders can be opened.
  const stack = await startStack(PREVIEW_PORTS, testMaterial(), { connectCountry: true, secret: previewSecret() });
  const origin = `http://localhost:${PREVIEW_PORTS.app}`;

  const details = [
    "TRONIC Central Admin: local preview with synthetic accounts",
    "",
    `Open:      ${origin}`,
    `Password:  ${stack.secret}`,
    `Code:      ${TEST_TOTP_CODE}   (asked after the password for master@, tz.super@ and ke.super@)`,
    "",
    "Sign in as (the same password for each):",
    ...Object.values(ACCOUNTS).map((email) => `  ${email}`),
    "",
    "The password is case-sensitive: copy and paste it. It works only while the preview is running.",
  ].join("\n");
  mkdirSync(DETAILS_DIR, { recursive: true });
  writeFileSync(DETAILS_FILE, `${details}\n`);
  console.log(`\n${details}\n\nThese details are also in admin/.preview/sign-in.txt\n`);

  const child = spawn(`pnpm exec next dev -H 127.0.0.1 -p ${PREVIEW_PORTS.app}`, {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...stack.env, NEXT_TELEMETRY_DISABLED: "1" },
  });

  let stopping = false;
  const stop = async (code: number) => {
    if (stopping) return;
    stopping = true;
    child.kill();
    await stack.stop().catch(() => undefined);
    process.exit(code);
  };
  child.on("exit", (code) => void stop(code ?? 0));
  process.on("SIGINT", () => void stop(0));
  process.on("SIGTERM", () => void stop(0));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
