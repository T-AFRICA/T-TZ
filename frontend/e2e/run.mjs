// pnpm run e2e — builds into .next-e2e (never the dev server's .next) with
// the database data source, so catalogue pages render live per request,
// then runs the Playwright browser tests. No database is contacted at
// build time; the tests start their own disposable one (global-setup.ts).
import { spawnSync } from "node:child_process";

const env = {
  ...process.env,
  NEXT_DIST_DIR: ".next-e2e",
  NEXT_TELEMETRY_DISABLED: "1",
  DATA_SOURCE: "database",
  DATABASE_URL: "postgres://build-time-placeholder@127.0.0.1:1/none",
};

function run(command) {
  const result = spawnSync(command, { stdio: "inherit", shell: true, env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("pnpm exec next build");
run(`pnpm exec playwright test ${process.argv.slice(2).join(" ")}`);
