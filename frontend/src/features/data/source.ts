import { connection } from "next/server";
import { createCatalogClient, type CatalogClient } from "@tronic/api-client";
import { createPostgresDb, DatabaseCatalogClient, type Db } from "@tronic/database";

/**
 * Where the storefront's data comes from. Server-only: it holds the
 * database connection string. Client components import nothing from here.
 *
 * DATA_SOURCE selects the source explicitly:
 *   - "mock" (the default while the live catalogue is not approved): the
 *     SAMPLE catalogue in packages/api-client; online orders are off.
 *   - "database": the catalogue and orders in Postgres (Supabase) through
 *     DATABASE_URL, read as the anon/authenticated roles so Row Level
 *     Security applies (database/migrations 0003, 0004).
 * Anything else, or "database" without DATABASE_URL, is a configuration
 * error and fails loudly: sample data must never pass for live records.
 */
export type DataSource = "mock" | "database";

export function dataSource(): DataSource {
  const mode = process.env.DATA_SOURCE?.trim() || "mock";
  if (mode === "mock") return "mock";
  if (mode === "database") {
    if (!process.env.DATABASE_URL) throw new Error("DATA_SOURCE=database needs DATABASE_URL");
    return "database";
  }
  throw new Error(`Unknown DATA_SOURCE: ${mode}`);
}

/** True when orders can be placed and tracked (the database is connected). */
export function ordersEnabled(): boolean {
  return dataSource() === "database";
}

let db: Db | null = null;

/** The shared connection pool (database mode only). */
export function getDb(): Db {
  if (dataSource() !== "database") throw new Error("getDb: DATA_SOURCE is not database");
  db ??= createPostgresDb(process.env.DATABASE_URL as string, { max: Number(process.env.DATABASE_POOL_MAX ?? 5) });
  return db;
}

let catalog: CatalogClient | null = null;
let freshCatalog: CatalogClient | null = null;

/**
 * The catalogue client for this request. In database mode it also marks
 * the page as dynamic (prices and stock change), so nothing live is baked
 * into the build. Listing pages may use a few seconds' cache; `fresh`
 * (checkout quotes) always reads the current price and stock.
 */
export async function getCatalog(options: { fresh?: boolean } = {}): Promise<CatalogClient> {
  if (dataSource() === "database") {
    await connection();
    if (options.fresh) {
      freshCatalog ??= new DatabaseCatalogClient(getDb(), { cacheMs: 0 });
      return freshCatalog;
    }
    catalog ??= new DatabaseCatalogClient(getDb());
    return catalog;
  }
  catalog ??= createCatalogClient("mock");
  return catalog;
}

/** ordersEnabled() read at request time (pages that must not bake it in at build). */
export async function ordersEnabledForRequest(): Promise<boolean> {
  await connection();
  return ordersEnabled();
}
