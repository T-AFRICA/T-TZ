// pnpm run e2e — builds the admin into .next-e2e (never the dev server's
// .next) and runs the Playwright browser tests. Nothing is contacted at
// build time; the tests start their own disposable database and account
// service stand-in (global-setup.ts).
import { spawnSync } from "node:child_process";

const env = { ...process.env, NEXT_DIST_DIR: ".next-e2e", NEXT_TELEMETRY_DISABLED: "1" };

function run(command) {
  const result = spawnSync(command, { stdio: "inherit", shell: true, env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("pnpm exec next build");
run(`pnpm exec playwright test ${process.argv.slice(2).join(" ")}`);
