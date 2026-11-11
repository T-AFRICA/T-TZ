import { MockCatalogClient, type CatalogClient } from "@tronic/api-client";
import type {
  CountryCode,
  Product,
  ProductPage,
  ProductQuery,
  ProductSearchPage,
  ProductSearchQuery,
} from "@tronic/types";
import { ANON, toSafeInteger, withAccess, type Db } from "./db";

/**
 * Live catalogue adapter behind the storefront's CatalogClient interface.
 *
 * Reads run as the anon role through the security-invoker storefront view
 * (migration 0003), so the database decides what is public: inactive
 * products, inactive categories, unpriced products and other or inactive
 * countries never reach the app. The country is always the deployment's
 * server-side country.
 *
 * Filtering, sorting, paging and search ranking reuse the in-memory engine
 * of MockCatalogClient over the country's public products, so live and
 * mock results follow exactly the same rules. That is sized for the launch
 * catalogue (hundreds of products); move paging into SQL before it grows to
 * thousands. A short cache keeps listing pages from re-reading the catalogue
 * on every request; checkout never trusts it (place_cod_order reprices).
 *
 * Product.id is the public product key (the slug); database uuids stay
 * inside the database layer.
 */
const CACHE_MS = 15_000;

interface ViewRow {
  id: string;
  slug: string;
  sku: string;
  name: string;
  description: string | null;
  brand: string | null;
  category_slug: string;
  category_name: string;
  group_slug: string | null;
  subcategory_slug: string | null;
  variant_label: string | null;
  sequence: number;
  use_cases: string[] | null;
  country_code: string;
  currency: string;
  price_minor: unknown;
  was_price_minor: unknown;
  in_stock: boolean;
  image: string | null;
  [key: string]: unknown;
}

interface ChildRow {
  product_id: string;
  [key: string]: unknown;
}

export class DatabaseCatalogClient implements CatalogClient {
  private cache = new Map<CountryCode, { at: number; products: Promise<Product[]> }>();

  /**
   * `cacheMs` 0 reads the database on every call: checkout uses that, so a
   * customer is always quoted the current price and stock.
   */
  constructor(
    private readonly db: Db,
    private readonly options: { cacheMs?: number; now?: () => number } = {},
  ) {}

  private now(): number {
    return (this.options.now ?? Date.now)();
  }

  /** The country's public catalogue, loaded as anon (RLS applies). */
  loadCountry(country: CountryCode): Promise<Product[]> {
    const cacheMs = this.options.cacheMs ?? CACHE_MS;
    if (cacheMs <= 0) return loadPublicProducts(this.db, country);
    const hit = this.cache.get(country);
    if (hit && this.now() - hit.at < cacheMs) return hit.products;
    const products = loadPublicProducts(this.db, country);
    this.cache.set(country, { at: this.now(), products });
    products.catch(() => this.cache.delete(country));
    return products;
  }

  private async engine(country: CountryCode) {
    return new MockCatalogClient(await this.loadCountry(country));
  }

  async listProducts(query: ProductQuery): Promise<ProductPage> {
    return (await this.engine(query.country)).listProducts(query);
  }

  async searchProducts(query: ProductSearchQuery): Promise<ProductSearchPage> {
    return (await this.engine(query.country)).searchProducts(query);
  }

  async getProduct(slug: string, country: CountryCode): Promise<Product | null> {
    return (await this.engine(country)).getProduct(slug, country);
  }

  async getRelatedProducts(product: Product, country: CountryCode, limit?: number): Promise<readonly Product[]> {
    return (await this.engine(country)).getRelatedProducts(product, country, limit);
  }
}

export async function loadPublicProducts(db: Db, country: CountryCode): Promise<Product[]> {
  return withAccess(db, ANON, async (tx) => {
    const rows = await tx.query<ViewRow>(
      `select * from storefront_products where country_code = $1 order by sequence desc`,
      [country],
    );
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.id);
    const [images, variants, colors, specs] = await Promise.all([
      tx.query<ChildRow>(`select product_id, url from product_images where product_id = any($1::uuid[]) order by product_id, sort_order`, [ids]),
      tx.query<ChildRow>(`select product_id, name from product_variants where product_id = any($1::uuid[]) order by product_id, sort_order`, [ids]),
      tx.query<ChildRow>(`select product_id, name, swatch from product_colors where product_id = any($1::uuid[]) order by product_id, sort_order`, [ids]),
      tx.query<ChildRow>(
        `select product_id, label, value from product_specifications where product_id = any($1::uuid[]) order by product_id, sort_order`,
        [ids],
      ),
    ]);
    const group = (list: ChildRow[]) => {
      const map = new Map<string, ChildRow[]>();
      for (const row of list) map.set(row.product_id, [...(map.get(row.product_id) ?? []), row]);
      return map;
    };
    const byImages = group(images);
    const byVariants = group(variants);
    const byColors = group(colors);
    const bySpecs = group(specs);
    return rows.map((row) =>
      rowToProduct(row, {
        images: (byImages.get(row.id) ?? []).map((r) => String(r.url)),
        variants: (byVariants.get(row.id) ?? []).map((r) => String(r.name)),
        colors: (byColors.get(row.id) ?? []).map((r) => ({ name: String(r.name), swatch: String(r.swatch) })),
        specifications: (bySpecs.get(row.id) ?? []).map((r) => ({ label: String(r.label), value: String(r.value) })),
      }),
    );
  });
}

/**
 * Maps one storefront_products row to the storefront Product. Money comes
 * out exactly as stored: integer minor units (price_minor 2800000 is
 * TZS 28,000), never divided or multiplied here.
 */
export function rowToProduct(
  row: ViewRow,
  extra: {
    images: string[];
    variants: string[];
    colors: { name: string; swatch: string }[];
    specifications: { label: string; value: string }[];
  },
): Product {
  const priceMinor = toSafeInteger(row.price_minor, `price_minor of ${row.slug}`);
  const wasPriceMinor =
    row.was_price_minor === null || row.was_price_minor === undefined
      ? undefined
      : toSafeInteger(row.was_price_minor, `was_price_minor of ${row.slug}`);
  const [first, ...rest] = extra.images.length > 0 ? extra.images : row.image ? [row.image] : [];
  return {
    id: row.slug,
    slug: row.slug,
    sku: row.sku,
    name: row.name,
    ...(row.brand ? { brand: row.brand } : {}),
    ...(row.description ? { description: row.description } : {}),
    categorySlug: row.category_slug,
    categoryName: row.category_name,
    ...(row.group_slug ? { groupSlug: row.group_slug } : {}),
    ...(row.subcategory_slug ? { subcategorySlug: row.subcategory_slug } : {}),
    ...(row.use_cases && row.use_cases.length > 0 ? { useCases: row.use_cases } : {}),
    image: first ?? "",
    ...(rest.length > 0 ? { images: rest } : {}),
    priceMinor,
    currency: row.currency,
    ...(wasPriceMinor !== undefined && wasPriceMinor > priceMinor ? { wasPriceMinor } : {}),
    inStock: row.in_stock,
    countries: [row.country_code as CountryCode],
    active: true,
    sequence: Number(row.sequence),
    ...(extra.variants.length > 0 ? { variants: extra.variants } : {}),
    ...(row.variant_label ? { variantLabel: row.variant_label } : {}),
    ...(extra.colors.length > 0 ? { colors: extra.colors } : {}),
    ...(extra.specifications.length > 0 ? { specifications: extra.specifications } : {}),
  };
}
