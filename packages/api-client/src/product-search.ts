import type { Product } from "@tronic/types";
import { CATEGORY_SECTIONS } from "@tronic/country-config";

/**
 * Product search relevance, shared by the mock catalogue adapter and kept
 * as the reference the SQL version (database/migrations/0002, draft) must
 * reproduce. Pure functions, no I/O.
 *
 * Ranking tiers (lower is better):
 *   0 exact SKU
 *   1 exact model number (a "Model…" specification, when the catalogue has one)
 *   2 exact product name
 *   3 product name starts with the query
 *   4 every query word is in the name, or the query is part of the SKU / model
 *   5 every query word is in the name, SKU, brand or category path
 *   6 the same, allowing one typo per word of 4+ letters (controlled fuzzy)
 * Ties: shorter names first (tighter match), then newest.
 */

/** Longest query the search accepts; longer input is cut, not rejected. */
export const SEARCH_MAX_QUERY_LENGTH = 80;

/** Most query words considered; extra words are ignored. */
const MAX_TOKENS = 8;

/** Lowercase, Unicode-normalised, single-spaced and length-bounded. */
export function normalizeSearchText(raw: string): string {
  return raw
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, SEARCH_MAX_QUERY_LENGTH)
    .trim();
}

/** Letters and digits only, so "led panel 24", "LED-PANEL-24" and "ledpanel24" compare equal. */
function compact(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

function words(value: string): string[] {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** True when a and b differ by at most one insertion, deletion, substitution or adjacent swap. */
export function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const diffs: number[] = [];
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) {
        diffs.push(i);
        if (diffs.length > 2) return false;
      }
    }
    if (diffs.length === 1) return true;
    const [i, j] = diffs as [number, number];
    return j === i + 1 && a[i] === b[j] && a[j] === b[i];
  }
  const [shorter, longer] = a.length < b.length ? [a, b] : [b, a];
  let i = 0;
  let j = 0;
  let skipped = false;
  while (i < shorter.length && j < longer.length) {
    if (shorter[i] === longer[j]) {
      i += 1;
      j += 1;
    } else {
      if (skipped) return false;
      skipped = true;
      j += 1;
    }
  }
  return true;
}

/** slug → display name for every category, group and subcategory. */
const TAXONOMY_NAMES: ReadonlyMap<string, string> = new Map(
  CATEGORY_SECTIONS.flatMap((section) => [
    [section.slug, section.name] as const,
    ...section.groups.flatMap((group) => [
      [group.slug, group.name] as const,
      ...(group.subcategories ?? []).map((sub) => [sub.slug, sub.name] as const),
    ]),
  ]),
);

function modelNumbers(product: Product): string[] {
  return (product.specifications ?? [])
    .filter((spec) => /^model\b/i.test(spec.label.trim()))
    .map((spec) => spec.value);
}

interface Indexed {
  name: string;
  nameWords: string[];
  sku: string;
  models: string[];
  keywordWords: string[];
}

function index(product: Product): Indexed {
  const models = modelNumbers(product);
  const path = [product.groupSlug, product.subcategorySlug]
    .flatMap((slug) => (slug ? [TAXONOMY_NAMES.get(slug) ?? slug.replace(/-/g, " ")] : []));
  return {
    name: normalizeSearchText(product.name),
    nameWords: words(product.name),
    sku: compact(product.sku),
    models: models.map(compact).filter(Boolean),
    keywordWords: words([product.name, product.sku, product.brand ?? "", product.categoryName, ...path, ...models].join(" ")),
  };
}

function hasWord(haystack: readonly string[], token: string): boolean {
  return haystack.some((word) => word.includes(token));
}

function hasWordFuzzy(haystack: readonly string[], token: string): boolean {
  return (
    hasWord(haystack, token) ||
    (token.length >= 4 && haystack.some((word) => word.length >= 4 && withinOneEdit(word, token)))
  );
}

/** Relevance tier of a product for an already-normalised query, or null when it does not match. */
export function relevanceTier(product: Product, query: string): number | null {
  const tokens = words(query).slice(0, MAX_TOKENS);
  const needle = compact(query);
  if (tokens.length === 0 || needle.length === 0) return null;
  const doc = index(product);

  if (needle === doc.sku) return 0;
  if (doc.models.includes(needle)) return 1;
  if (query === doc.name) return 2;
  if (doc.name.startsWith(query)) return 3;
  if (
    tokens.every((token) => hasWord(doc.nameWords, token)) ||
    (needle.length >= 3 && (doc.sku.includes(needle) || doc.models.some((model) => model.includes(needle))))
  ) {
    return 4;
  }
  if (tokens.every((token) => hasWord(doc.keywordWords, token))) return 5;
  if (tokens.every((token) => hasWordFuzzy(doc.keywordWords, token))) return 6;
  return null;
}

/** Matching products ordered by relevance (see the tiers above). */
export function rankProducts(products: readonly Product[], rawQuery: string): Product[] {
  const query = normalizeSearchText(rawQuery);
  if (query.length === 0) return [];
  return products
    .flatMap((product) => {
      const tier = relevanceTier(product, query);
      return tier === null ? [] : [{ product, tier }];
    })
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        a.product.name.length - b.product.name.length ||
        b.product.sequence - a.product.sequence,
    )
    .map(({ product }) => product);
}
