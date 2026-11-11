import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import type { Db, Row } from "../db";
import { seedCatalog, type SeedOptions } from "./seed";
import { SUPABASE_SHIM_SQL } from "./supabase-shim";

/**
 * Disposable test databases (PGlite: PostgreSQL compiled to WebAssembly,
 * in-process, nothing installed, nothing shared). Used by the permission and
 * order tests and by the local end-to-end database. Never point these
 * helpers at Supabase or any shared database.
 */

/**
 * database/migrations, found by walking up from the working directory (the
 * repository root, frontend/ or database/client/), or TRONIC_MIGRATIONS_DIR.
 */
export function migrationsDir(): string {
  const override = process.env.TRONIC_MIGRATIONS_DIR;
  if (override) return override;
  let dir = process.cwd();
  for (;;) {
    for (const candidate of [join(dir, "database", "migrations"), join(dir, "migrations")]) {
      if (existsSync(join(candidate, "0001_catalog.sql"))) return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) throw new Error("database/migrations not found from " + process.cwd());
    dir = parent;
  }
}

export function migrationFiles(): string[] {
  return readdirSync(migrationsDir())
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
}

/** PGlite adapter for the Db boundary. */
export function pgliteDb(pg: PGlite | Transaction): Db {
  return {
    async query<T extends Row = Row>(text: string, params: readonly unknown[] = []): Promise<T[]> {
      const result = await pg.query<T>(text, params as unknown[]);
      return result.rows;
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
      if ("transaction" in pg) return pg.transaction((tx) => fn(pgliteDb(tx)));
      return fn(pgliteDb(pg));
    },
  };
}

export interface TestDatabase {
  pg: PGlite;
  db: Db;
}

/**
 * A fresh database with the Supabase shim and every migration applied, as
 * the owner role. `seed` loads the sample catalogue (default true).
 * `dataDir` persists it (for the local end-to-end server); omit it for an
 * in-memory database.
 */
export async function createTestDatabase(options: { seed?: boolean | SeedOptions; dataDir?: string } = {}): Promise<TestDatabase> {
  const pg = await PGlite.create({ dataDir: options.dataDir, extensions: { pg_trgm, pgcrypto } });
  await pg.exec(SUPABASE_SHIM_SQL);
  const dir = migrationsDir();
  for (const file of migrationFiles()) {
    await pg.exec(readFileSync(join(dir, file), "utf8"));
  }
  const db = pgliteDb(pg);
  if (options.seed !== false) {
    await seedCatalog(db, typeof options.seed === "object" ? options.seed : {});
  }
  return { pg, db };
}

/** Creates a Supabase-style auth user for tests and returns its id. */
export async function createAuthUser(db: Db, email: string): Promise<string> {
  const [row] = await db.query<{ id: string }>(
    `insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id`,
    [email],
  );
  if (!row) throw new Error("createAuthUser failed");
  return row.id;
}

export { seedCatalog, type SeedOptions } from "./seed";
