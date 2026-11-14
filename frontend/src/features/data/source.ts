import { unstable_cache } from "next/cache";
import { connection } from "next/server";
import { createCatalogClient, type CatalogClient } from "@tronic/api-client";
import { createPostgresDb, DatabaseCatalogClient, loadPublicProducts, type Db } from "@tronic/database";
import type { CountryCode } from "@tronic/types";

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

/**
 * How long, in seconds, catalogue pages may reuse one read of the public
 * catalogue (CATALOG_CACHE_SECONDS, default 60; 0 turns the shared cache
 * off). Without it every listing, product and search request waits for the
 * database, from a server that may be far from it. A price or stock change
 * shows on those pages within about this long; the checkout quote and the
 * order itself never use it and always read the current values.
 */
export function catalogCacheSeconds(): number {
  const raw = process.env.CATALOG_CACHE_SECONDS?.trim();
  if (!raw) return 60;
  const seconds = Number(raw);
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > 3600) {
    throw new Error(`CATALOG_CACHE_SECONDS must be a whole number from 0 to 3600, got "${raw}"`);
  }
  return seconds;
}

/**
 * The public catalogue of a country, kept in the framework's data cache so
 * every server instance shares one copy. It holds only what the anon role
 * may read (the storefront view), the same for every visitor: nothing
 * personal and nothing per customer is ever cached here.
 */
function sharedCatalogLoader(db: Db, seconds: number): (country: CountryCode) => Promise<Awaited<ReturnType<typeof loadPublicProducts>>> {
  return unstable_cache((country: CountryCode) => loadPublicProducts(db, country), ["tronic-storefront-catalogue"], {
    revalidate: seconds,
    tags: ["catalogue"],
  });
}

let catalog: CatalogClient | null = null;
let freshCatalog: CatalogClient | null = null;

/**
 * The catalogue client for this request. In database mode it also marks
 * the page as dynamic (prices and stock change), so nothing live is baked
 * into the build. Listing pages reuse one read of the catalogue for about
 * a minute (catalogCacheSeconds); `fresh` (checkout quotes) always reads
 * the current price and stock.
 */
export async function getCatalog(options: { fresh?: boolean } = {}): Promise<CatalogClient> {
  if (dataSource() === "database") {
    await connection();
    if (options.fresh) {
      freshCatalog ??= new DatabaseCatalogClient(getDb(), { cacheMs: 0 });
      return freshCatalog;
    }
    if (!catalog) {
      const seconds = catalogCacheSeconds();
      catalog = new DatabaseCatalogClient(getDb(), seconds > 0 ? { load: sharedCatalogLoader(getDb(), seconds) } : {});
    }
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
