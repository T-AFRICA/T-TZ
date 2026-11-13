import { MAX_PAGE_SIZE } from "@tronic/api-client";
import type { Product, ProductQuery } from "@tronic/types";
import { ACTIVE_COUNTRY } from "@tronic/country-config";
import { getCatalog } from "@/features/data/source";

/** One taxonomy scope of a homepage collection (category, group, subcategory). */
export type CollectionScope = Pick<ProductQuery, "category" | "group" | "subcategory">;

export type CollectionResult =
  | { status: "ok"; products: readonly Product[] }
  | { status: "error" };

/**
 * Products for a homepage collection, read from the catalogue the rest of
 * the storefront uses (SAMPLE catalogue in mock mode, Postgres/Supabase in
 * database mode), so prices, stock and country visibility are the
 * catalogue's own. Each scope is one listProducts query in the active
 * country; results are merged without duplicates, newest first, up to
 * `limit`. A failed read is reported as an error state, never as an empty
 * collection.
 */
export async function loadCollection(scopes: readonly CollectionScope[], limit = 6): Promise<CollectionResult> {
  // Outside the try: in database mode this marks the page dynamic, and
  // Next.js must see that signal rather than have it caught.
  const catalog = await getCatalog();
  try {
    const pages = await Promise.all(
      scopes.map((scope) =>
        catalog.listProducts({ ...scope, country: ACTIVE_COUNTRY.code, sort: "newest", pageSize: limit }),
      ),
    );
    const byId = new Map<string, Product>();
    for (const page of pages) {
      for (const product of page.items) {
        if (!byId.has(product.id)) byId.set(product.id, product);
      }
    }
    const products = [...byId.values()].sort((a, b) => b.sequence - a.sequence).slice(0, limit);
    return { status: "ok", products };
  } catch (error) {
    console.error("Homepage collection could not be loaded", error);
    return { status: "error" };
  }
}

/**
 * Hand-picked products, in the given order (Featured Products). Ids that
 * the catalogue does not have, or does not show in this country, are
 * skipped rather than invented.
 */
export async function loadProducts(ids: readonly string[]): Promise<CollectionResult> {
  const catalog = await getCatalog();
  try {
    const found = await Promise.all(ids.map((id) => catalog.getProduct(id, ACTIVE_COUNTRY.code)));
    return { status: "ok", products: found.filter((product): product is Product => product !== null) };
  } catch (error) {
    console.error("Homepage products could not be loaded", error);
    return { status: "error" };
  }
}

/** Saving in minor units; 0 without a higher was-price. */
function saving(product: Product): number {
  return product.wasPriceMinor !== undefined ? product.wasPriceMinor - product.priceMinor : 0;
}

/**
 * Offers & Promotions: products whose catalogue price is below their
 * catalogue was-price, largest saving first. Nothing is computed or
 * invented here — a product is an offer only if the catalogue says so.
 * Reads the newest catalogue page (MAX_PAGE_SIZE products).
 */
export async function loadOffers(limit = 8): Promise<CollectionResult> {
  const catalog = await getCatalog();
  try {
    const page = await catalog.listProducts({ country: ACTIVE_COUNTRY.code, sort: "newest", pageSize: MAX_PAGE_SIZE });
    const offers = page.items
      .filter((product) => saving(product) > 0)
      .sort((a, b) => saving(b) / (b.wasPriceMinor ?? 1) - saving(a) / (a.wasPriceMinor ?? 1))
      .slice(0, limit);
    return { status: "ok", products: offers };
  } catch (error) {
    console.error("Homepage offers could not be loaded", error);
    return { status: "error" };
  }
}
