import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { createPostgresDb } from "@tronic/database";
import { createTestDatabase } from "@tronic/database/testing";
import { FakeAuth } from "./support/fake-auth";
import { PORTS } from "./ports";

/**
 * TEST ONLY. Starts, for the duration of the browser tests:
 *   - a disposable PGlite database (all migrations + the sample catalogue)
 *     served over the Postgres wire protocol, which the storefront reaches
 *     through DATABASE_URL exactly as it would reach Supabase Postgres;
 *   - a stand-in for Supabase Auth (support/fake-auth.ts);
 *   - a control endpoint the tests use to inspect and adjust the test
 *     database (owner role). Bound to 127.0.0.1 and gone after the run.
 * Nothing here touches Supabase, a shared database or production data.
 */
export default async function globalSetup() {
  const dataDir = mkdtempSync(join(tmpdir(), "tronic-e2e-db-"));
  const { pg } = await createTestDatabase({ dataDir });

  const socket = new PGLiteSocketServer({ db: pg, port: PORTS.database, host: "127.0.0.1", maxConnections: 4 });
  await socket.start();
  // The tests' own connection goes through the socket server too, whose
  // queue keeps each connection's transactions apart from the app's.
  const db = createPostgresDb(`postgres://postgres:postgres@127.0.0.1:${PORTS.database}/postgres`, { max: 1 });

  const auth = new FakeAuth(async (user) => {
    await db.query(`insert into auth.users (id, email) values ($1, $2) on conflict (id) do nothing`, [user.id, user.email]);
  });
  await auth.start(PORTS.auth);

  const control = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      void (async () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as Record<string, unknown>;
          if (request.url === "/sql") {
            const rows = await db.query(String(body.text), (body.params as unknown[]) ?? []);
            response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(rows));
          } else if (request.url === "/users") {
            const user = await auth.addUser(String(body.email), String(body.password), body.confirmed !== false);
            response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ id: user.id, email: user.email }));
          } else {
            response.writeHead(404).end();
          }
        } catch (error) {
          response.writeHead(500, { "content-type": "application/json" }).end(JSON.stringify({ error: String(error) }));
        }
      })();
    });
  });
  await new Promise<void>((resolve) => control.listen(PORTS.control, "127.0.0.1", resolve));

  return async () => {
    await new Promise<void>((resolve) => control.close(() => resolve()));
    await auth.stop();
    await socket.stop();
    await pg.close();
    rmSync(dataDir, { recursive: true, force: true });
  };
}
