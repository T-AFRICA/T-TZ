import { ALL_SAMPLE_PRODUCTS } from "@tronic/api-client";
import { assertMinorAmount } from "@tronic/country-config";
import type { Product } from "@tronic/types";
import type { Db } from "../db";

/**
 * Loads the SAMPLE catalogue (packages/api-client mock data) into a test
 * database as the owner role, so the database-backed storefront shows the
 * same products as mock mode. Prices are copied as stored: priceMinor is
 * already in ISO minor units (TZS ×100), so nothing is rescaled here.
 *
 * Countries follow the deployment roster: Tanzania active, Kenya and
 * Uganda not yet (tests switch them on to check isolation).
 */
export interface SeedOptions {
  /** Units in stock for in-stock sample products (default 25). */
  stock?: number;
  products?: readonly Product[];
}

const COUNTRY_ROWS = [
  { code: "TZ", name: "Tanzania", currency: "TZS", locale: "en-TZ", active: true },
  { code: "KE", name: "Kenya", currency: "KES", locale: "en-KE", active: false },
  { code: "UG", name: "Uganda", currency: "UGX", locale: "en-UG", active: false },
];

const titleCase = (slug: string) => slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export async function seedCatalog(db: Db, options: SeedOptions = {}): Promise<void> {
  const products = options.products ?? ALL_SAMPLE_PRODUCTS;
  const stock = options.stock ?? 25;

  for (const country of COUNTRY_ROWS) {
    await db.query(
      `insert into countries (code, name, currency, locale, active) values ($1, $2, $3, $4, $5)
       on conflict (code) do nothing`,
      [country.code, country.name, country.currency, country.locale, country.active],
    );
  }

  const categories = new Map<string, string>();
  const groups = new Map<string, string>();
  const subcategories = new Map<string, string>();
  const brands = new Map<string, string>();

  for (const [index, product] of products.entries()) {
    let categoryId = categories.get(product.categorySlug);
    if (!categoryId) {
      const [row] = await db.query<{ id: string }>(
        `insert into categories (slug, name, sort_order) values ($1, $2, $3) returning id`,
        [product.categorySlug, product.categoryName, categories.size],
      );
      categoryId = row!.id;
      categories.set(product.categorySlug, categoryId);
    }
    let groupId: string | null = null;
    if (product.groupSlug) {
      const key = `${product.categorySlug}/${product.groupSlug}`;
      groupId = groups.get(key) ?? null;
      if (!groupId) {
        const [row] = await db.query<{ id: string }>(
          `insert into category_groups (category_id, slug, name) values ($1, $2, $3) returning id`,
          [categoryId, product.groupSlug, titleCase(product.groupSlug)],
        );
        groupId = row!.id;
        groups.set(key, groupId);
      }
    }
    let subcategoryId: string | null = null;
    if (product.subcategorySlug && groupId) {
      const key = `${product.categorySlug}/${product.groupSlug}/${product.subcategorySlug}`;
      subcategoryId = subcategories.get(key) ?? null;
      if (!subcategoryId) {
        const [row] = await db.query<{ id: string }>(
          `insert into category_subcategories (group_id, slug, name) values ($1, $2, $3) returning id`,
          [groupId, product.subcategorySlug, titleCase(product.subcategorySlug)],
        );
        subcategoryId = row!.id;
        subcategories.set(key, subcategoryId);
      }
    }
    let brandId: string | null = null;
    if (product.brand) {
      brandId = brands.get(product.brand) ?? null;
      if (!brandId) {
        const [row] = await db.query<{ id: string }>(`insert into brands (slug, name) values ($1, $2) returning id`, [
          product.brand.toLowerCase(),
          product.brand,
        ]);
        brandId = row!.id;
        brands.set(product.brand, brandId);
      }
    }

    const [row] = await db.query<{ id: string }>(
      `insert into products (slug, sku, name, description, brand_id, category_id, group_id, subcategory_id, variant_label, active, sequence)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
      [
        product.slug,
        product.sku,
        product.name,
        product.description ?? null,
        brandId,
        categoryId,
        groupId,
        subcategoryId,
        product.variantLabel ?? null,
        product.active,
        product.sequence ?? index,
      ],
    );
    const productId = row!.id;

    const images = [product.image, ...(product.images ?? [])];
    for (const [order, url] of images.entries()) {
      await db.query(`insert into product_images (product_id, url, sort_order) values ($1, $2, $3)`, [productId, url, order]);
    }
    for (const [order, name] of (product.variants ?? []).entries()) {
      await db.query(`insert into product_variants (product_id, name, sort_order) values ($1, $2, $3)`, [productId, name, order]);
    }
    for (const [order, color] of (product.colors ?? []).entries()) {
      await db.query(`insert into product_colors (product_id, name, swatch, sort_order) values ($1, $2, $3, $4)`, [
        productId,
        color.name,
        color.swatch,
        order,
      ]);
    }
    for (const useCase of product.useCases ?? []) {
      await db.query(`insert into product_use_cases (product_id, use_case) values ($1, $2)`, [productId, useCase]);
    }
    for (const [order, spec] of (product.specifications ?? []).entries()) {
      await db.query(
        `insert into product_specifications (product_id, label, value, sort_order) values ($1, $2, $3, $4)`,
        [productId, spec.label, spec.value, order],
      );
    }

    for (const country of product.countries) {
      const currency = COUNTRY_ROWS.find((c) => c.code === country)?.currency;
      if (!currency) continue;
      const price = assertMinorAmount(product.priceMinor, `${product.slug} price`);
      const was = product.wasPriceMinor !== undefined && product.wasPriceMinor > price ? product.wasPriceMinor : null;
      await db.query(
        `insert into product_country_prices (product_id, country_code, currency, price_minor, was_price_minor, in_stock, active)
         values ($1, $2, $3, $4, $5, false, true)`,
        [productId, country, currency, String(price), was === null ? null : String(was)],
      );
      // The trigger on stock_levels sets in_stock from the units available.
      await db.query(`insert into stock_levels (product_id, country_code, available) values ($1, $2, $3)`, [
        productId,
        country,
        product.inStock ? stock : 0,
      ]);
    }
  }
}
