import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { createPostgresDb, type Db } from "@tronic/database";
import { acceptAdminInvitations, inviteAdmin, setAdminStatus, updateCountryService, type AdminAccess } from "@tronic/database/admin";
import { createAdminTestDatabase } from "@tronic/database/testing";
import { startCountryStandIn } from "./country";
import { FakeAuth, type FakeUser } from "./fake-auth";
import type { TestMaterial } from "./test-material";

/**
 * TEST ONLY. Everything the admin application needs, on this machine, for
 * the browser tests and the local preview:
 *   - a disposable PGlite database with database/admin-migrations applied,
 *     served over the Postgres wire protocol (ADMIN_DATABASE_URL);
 *   - a stand-in for Supabase Auth (fake-auth.ts);
 *   - synthetic administrators, created the way real ones are: the first
 *     Master Super Admin by the provisioning step, everyone else through
 *     invite_admin() and accept_admin_invitations(), so the audit log of the
 *     test database is real too;
 *   - a stand-in for Tanzania's backend with its own disposable country
 *     database and a few synthetic orders (country.ts);
 *   - a control endpoint the tests use to look into both test databases.
 * All of it is bound to 127.0.0.1 and gone when the run ends. Nothing here
 * touches Supabase, a real country or any shared system.
 */

export interface StackPorts {
  database: number;
  auth: number;
  control: number;
  country: number;
}

/** The synthetic accounts. Every address is under example.test, which cannot receive mail. */
export const ACCOUNTS = {
  master: "master@example.test",
  tzSuper: "tz.super@example.test",
  /** A Country Super Admin who has not set up an authenticator yet. */
  keSuper: "ke.super@example.test",
  tzOrders: "tz.orders@example.test",
  /** Starts suspended. */
  tzSuspended: "tz.suspended@example.test",
  /** Has an Auth account and no role at all. */
  stranger: "stranger@example.test",
  /** Has an Auth account and a waiting invitation (Content Manager, Tanzania). */
  invited: "invited@example.test",
  /** A delivery rider in Tanzania. */
  tzRider: "tz.rider@example.test",
  /** Finance / Reporting Viewer in Tanzania: reports and orders, nothing else. */
  tzFinance: "tz.finance@example.test",
} as const;

export interface Stack {
  /** What every synthetic account signs in with: made up for the run, or the one the local preview kept. */
  secret: string;
  env: Record<string, string>;
  /** Where the stand-in for Tanzania's backend listens. */
  countryAddress: string;
  stop: () => Promise<void>;
}

export async function startStack(
  ports: StackPorts,
  material: TestMaterial,
  options: {
    /** Registers the stand-in as Tanzania's service from the start (the local preview). The tests do it through the console. */
    connectCountry?: boolean;
    /** What the synthetic accounts sign in with; made up when not given. */
    secret?: string;
  } = {},
): Promise<Stack> {
  const dataDir = mkdtempSync(join(tmpdir(), "tronic-admin-db-"));
  const { pg } = await createAdminTestDatabase({ dataDir });
  const socket = new PGLiteSocketServer({ db: pg, port: ports.database, host: "127.0.0.1", maxConnections: 4 });
  await socket.start();
  const databaseUrl = `postgres://postgres:postgres@127.0.0.1:${ports.database}/postgres`;
  const db = createPostgresDb(databaseUrl, { max: 1 });

  const auth = new FakeAuth(async (user) => {
    await db.query(`insert into auth.users (id, email, email_confirmed_at) values ($1, $2, case when $3::boolean then now() end) on conflict (id) do nothing`, [
      user.id,
      user.email,
      user.confirmed,
    ]);
  });
  await auth.start(ports.auth);

  const country = await startCountryStandIn({
    port: ports.country,
    tls: material.tls,
    verifyKey: { pem: material.signingPublicKey, keyId: material.signingKeyId },
  });
  const countryAddress = `https://127.0.0.1:${ports.country}`;

  const secret = options.secret ?? randomBytes(12).toString("base64url");
  const master = await seed(db, auth, secret);
  if (options.connectCountry) {
    const registered = await updateCountryService(db, { userId: master.id, aal: "aal2" }, "tz", { apiBaseUrl: countryAddress, enabled: true });
    if (!registered.ok) throw new Error(`seed: could not register the country stand-in: ${registered.code}`);
  }

  const control = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      void (async () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as Record<string, unknown>;
          if (request.url === "/sql" || request.url === "/country-sql") {
            const target = request.url === "/sql" ? db : country.db;
            const rows = await target.query(String(body.text), (body.params as unknown[]) ?? []);
            response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(rows));
          } else if (request.url === "/revoke") {
            auth.revokeSessions(String(body.email));
            response.writeHead(200, { "content-type": "application/json" }).end("{}");
          } else {
            response.writeHead(404).end();
          }
        } catch (error) {
          response.writeHead(500, { "content-type": "application/json" }).end(JSON.stringify({ error: String(error) }));
        }
      })();
    });
  });
  await new Promise<void>((resolve) => control.listen(ports.control, "127.0.0.1", resolve));

  return {
    secret,
    countryAddress,
    env: {
      ADMIN_DATABASE_URL: databaseUrl,
      ADMIN_DATABASE_POOL_MAX: "1",
      ADMIN_SUPABASE_URL: `http://127.0.0.1:${ports.auth}`,
      ADMIN_SUPABASE_ANON_KEY: "e2e-anon-key-not-a-secret",
      COUNTRY_API_SIGNING_KEY: material.signingPrivateKey,
      COUNTRY_API_SIGNING_KEY_ID: material.signingKeyId,
      // The admin server trusts the stand-in country's throwaway certificate.
      NODE_EXTRA_CA_CERTS: material.tlsCertFile,
    },
    stop: async () => {
      await new Promise<void>((resolve) => control.close(() => resolve()));
      await country.stop();
      await auth.stop();
      await socket.stop();
      await pg.close();
      rmSync(dataDir, { recursive: true, force: true });
      rmSync(material.tlsDir, { recursive: true, force: true });
    },
  };
}

async function seed(db: Db, auth: FakeAuth, secret: string): Promise<FakeUser> {
  const add = (email: string, authenticator: boolean) => auth.addUser(email, secret, { authenticator });
  const master = await add(ACCOUNTS.master, true);
  const tzSuper = await add(ACCOUNTS.tzSuper, true);
  const keSuper = await add(ACCOUNTS.keSuper, false);
  const tzOrders = await add(ACCOUNTS.tzOrders, false);
  const tzSuspended = await add(ACCOUNTS.tzSuspended, false);
  const tzRider = await add(ACCOUNTS.tzRider, false);
  const tzFinance = await add(ACCOUNTS.tzFinance, false);
  await add(ACCOUNTS.stranger, false);
  await add(ACCOUNTS.invited, false);

  // The provisioning step, as an owner runs it in the SQL editor.
  await db.query(`select app_private.provision_master_super_admin($1)`, [ACCOUNTS.master]);

  const as = (user: FakeUser, aal: AdminAccess["aal"] = "aal2"): AdminAccess => ({ userId: user.id, aal });
  const onboard = async (inviter: FakeUser, person: FakeUser, role: string, countryId: string) => {
    const invited = await inviteAdmin(db, as(inviter), { email: person.email, role, countryId });
    if (!invited.ok) throw new Error(`seed: could not invite ${person.email}: ${invited.code}`);
    const accepted = await acceptAdminInvitations(db, as(person, "aal1"));
    if (!accepted.ok) throw new Error(`seed: ${person.email} could not accept: ${accepted.code}`);
  };
  await onboard(master, tzSuper, "country_super_admin", "tz");
  await onboard(master, keSuper, "country_super_admin", "ke");
  await onboard(tzSuper, tzOrders, "order_manager", "tz");
  await onboard(tzSuper, tzSuspended, "customer_support", "tz");
  await onboard(tzSuper, tzRider, "rider", "tz");
  await onboard(tzSuper, tzFinance, "finance_viewer", "tz");
  const suspended = await setAdminStatus(db, as(master), { userId: tzSuspended.id, status: "suspended", reason: "Synthetic test account" });
  if (!suspended.ok) throw new Error(`seed: could not suspend: ${suspended.code}`);
  const waiting = await inviteAdmin(db, as(tzSuper), { email: ACCOUNTS.invited, role: "content_manager", countryId: "tz" });
  if (!waiting.ok) throw new Error(`seed: could not invite ${ACCOUNTS.invited}: ${waiting.code}`);
  return master;
}
