import { spawn } from "node:child_process";
import { PREVIEW_PORTS } from "./ports";
import { TEST_TOTP_CODE } from "./support/fake-auth";
import { ACCOUNTS, startStack } from "./support/stack";

/**
 * pnpm --filter @tronic/admin run preview:local
 *
 * LOCAL PREVIEW ONLY. Runs the admin's dev server against the same
 * disposable database and account-service stand-in the browser tests use,
 * with synthetic administrators, so the console can be looked at before the
 * Central Admin Supabase project exists. Nothing is stored after it stops
 * and nothing here touches Supabase, a country or production.
 *
 * The sign-in details are made up at start and printed to this terminal.
 */
async function main() {
  const stack = await startStack(PREVIEW_PORTS);
  const origin = `http://localhost:${PREVIEW_PORTS.app}`;

  console.log("\nTRONIC Central Admin: local preview with synthetic accounts");
  console.log(`  Open        ${origin}`);
  console.log(`  Sign in as  ${Object.values(ACCOUNTS).join("\n              ")}`);
  console.log(`  Password    ${stack.secret}   (made up for this run)`);
  console.log(`  Code        ${TEST_TOTP_CODE}   (the stand-in accepts this one authenticator code)\n`);

  const child = spawn(`pnpm exec next dev -p ${PREVIEW_PORTS.app}`, {
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
