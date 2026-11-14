// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The data source switch and the shared catalogue cache, with the database
 * package and the framework cache replaced: which reads go through the
 * cache, for how long, and that checkout never does.
 */
const cache = vi.hoisted(() => ({
  unstable_cache: vi.fn<(fn: (...args: unknown[]) => unknown, keys: string[], options: { revalidate: number; tags: string[] }) => unknown>((fn) => fn),
}));
const database = vi.hoisted(() => ({
  clients: [] as { options: { load?: unknown; cacheMs?: number } }[],
  loadPublicProducts: vi.fn(async () => []),
}));

vi.mock("next/cache", () => cache);
vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("@tronic/database", () => ({
  createPostgresDb: () => ({ query: vi.fn(), transaction: vi.fn() }),
  loadPublicProducts: database.loadPublicProducts,
  DatabaseCatalogClient: class {
    constructor(_db: unknown, options: { load?: unknown; cacheMs?: number } = {}) {
      database.clients.push({ options });
    }
  },
}));

const ENV = { ...process.env };

async function load() {
  vi.resetModules();
  return import("./source");
}

beforeEach(() => {
  database.clients.length = 0;
  cache.unstable_cache.mockClear();
  database.loadPublicProducts.mockClear();
  process.env.DATA_SOURCE = "database";
  process.env.DATABASE_URL = "postgres://user@127.0.0.1:1/none";
  delete process.env.CATALOG_CACHE_SECONDS;
});

afterEach(() => {
  process.env = { ...ENV };
});

describe("data source", () => {
  it("is mock unless told otherwise, and refuses a half or unknown configuration", async () => {
    delete process.env.DATA_SOURCE;
    expect((await load()).dataSource()).toBe("mock");
    process.env.DATA_SOURCE = "database";
    delete process.env.DATABASE_URL;
    expect(() => (source.dataSource)()).toThrow("DATA_SOURCE=database needs DATABASE_URL");
    process.env.DATA_SOURCE = "Database";
    expect(() => (source.dataSource)()).toThrow("Unknown DATA_SOURCE: Database");
  });
});

let source: Awaited<ReturnType<typeof load>>;
beforeEach(async () => {
  source = await load();
});

describe("shared catalogue cache", () => {
  it("is 60 seconds by default, can be turned off, and refuses a bad value", () => {
    expect(source.catalogCacheSeconds()).toBe(60);
    process.env.CATALOG_CACHE_SECONDS = "0";
    expect(source.catalogCacheSeconds()).toBe(0);
    process.env.CATALOG_CACHE_SECONDS = " 300 ";
    expect(source.catalogCacheSeconds()).toBe(300);
    for (const bad of ["-1", "1.5", "abc", "3601"]) {
      process.env.CATALOG_CACHE_SECONDS = bad;
      expect(() => source.catalogCacheSeconds(), bad).toThrow(/CATALOG_CACHE_SECONDS/);
    }
  });

  it("puts catalogue pages behind the cache, keyed by country, for the configured time", async () => {
    await source.getCatalog();
    await source.getCatalog();
    expect(database.clients).toHaveLength(1);
    expect(cache.unstable_cache).toHaveBeenCalledTimes(1);
    const [, keys, options] = cache.unstable_cache.mock.calls[0]!;
    expect(keys).toEqual(["tronic-storefront-catalogue"]);
    expect(options).toEqual({ revalidate: 60, tags: ["catalogue"] });

    // The loader the client was given is the cached read of the public catalogue.
    const loader = database.clients[0]!.options.load as (country: string) => Promise<unknown>;
    await loader("TZ");
    expect(database.loadPublicProducts).toHaveBeenCalledWith(expect.anything(), "TZ");
  });

  it("never puts the checkout's fresh read behind it", async () => {
    await source.getCatalog({ fresh: true });
    expect(database.clients).toEqual([{ options: { cacheMs: 0 } }]);
    expect(cache.unstable_cache).not.toHaveBeenCalled();
  });

  it("reads the database directly when the cache is turned off", async () => {
    process.env.CATALOG_CACHE_SECONDS = "0";
    await source.getCatalog();
    expect(database.clients).toEqual([{ options: {} }]);
    expect(cache.unstable_cache).not.toHaveBeenCalled();
  });
});
