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
