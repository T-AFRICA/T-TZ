import {
  PRODUCT_LIMITS,
  PRODUCT_SKU_PATTERN,
  PRODUCT_SLUG_PATTERN,
  type CatalogueOptions,
  type ProductDetail,
  type ProductInput,
} from "@tronic/api-contracts";

/**
 * The product form, field by field: what the administrator types and what
 * the country receives. Pure functions, used by the server actions and the
 * tests; the country checks everything again.
 *
 * Fields: name, sku, slug (new products only), description, placement
 * ("category|group|subcategory" ids), brandId, variantLabel, price and
 * wasPrice (in the currency's main unit, e.g. shillings), specifications
 * ("Label: value" per line), variants (one per line or comma separated),
 * colors ("Name #RRGGBB" per line).
 */

export type ProductFormValues = Record<
  "name" | "sku" | "slug" | "description" | "placement" | "brandId" | "variantLabel" | "price" | "wasPrice" | "specifications" | "variants" | "colors",
  string
>;

export const EMPTY_PRODUCT_FORM: ProductFormValues = {
  name: "",
  sku: "",
  slug: "",
  description: "",
  placement: "",
  brandId: "",
  variantLabel: "",
  price: "",
  wasPrice: "",
  specifications: "",
  variants: "",
  colors: "",
};

export function readProductForm(form: FormData): ProductFormValues {
  const value = (key: keyof ProductFormValues) => {
    const raw = form.get(key);
    return typeof raw === "string" ? raw : "";
  };
  return Object.fromEntries((Object.keys(EMPTY_PRODUCT_FORM) as (keyof ProductFormValues)[]).map((key) => [key, value(key)])) as ProductFormValues;
}

/** A web address from a product name: "Smart LED Bulb 12W" -> "smart-led-bulb-12w". */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/**
 * An amount as people type it ("28,000", "28000.50") in minor units, with
 * the currency's exponent: 28,000 TZS (exponent 2) is 2800000. Null when it
 * is not a plain non-negative amount with at most `exponent` decimals.
 */
export function toMinor(text: string, exponent: number): number | null {
  const cleaned = text.replace(/[\s,]/g, "");
  const match = /^(\d{1,13})(?:\.(\d+))?$/.exec(cleaned);
  if (!match) return null;
  const fraction = match[2] ?? "";
  if (fraction.length > exponent) return null;
  const minor = Number(match[1]) * 10 ** exponent + (fraction ? Number(fraction.padEnd(exponent, "0")) : 0);
  return Number.isSafeInteger(minor) ? minor : null;
}

/** Minor units back into the main unit for the form: 2800000 (exponent 2) -> "28000", 2800050 -> "28000.50". */
export function fromMinor(minor: number | null, exponent: number): string {
  if (minor === null) return "";
  const whole = Math.floor(minor / 10 ** exponent);
  const rest = minor % 10 ** exponent;
  return rest === 0 ? String(whole) : `${whole}.${String(rest).padStart(exponent, "0")}`;
}

const lines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

/** "Power: 12 W" per line. */
export function parseSpecifications(text: string): { label: string; value: string }[] | null {
  const specs = lines(text).map((line) => {
    const at = line.indexOf(":");
    return at > 0 ? { label: line.slice(0, at).trim(), value: line.slice(at + 1).trim() } : null;
  });
  return specs.every((spec) => spec && spec.label && spec.value) ? (specs as { label: string; value: string }[]) : null;
}

/** One per line, or comma separated: "9W, 12W". */
export function parseVariants(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** "Warm white #FFE9B0" per line. */
export function parseColors(text: string): { name: string; swatch: string }[] | null {
  const colors = lines(text).map((line) => {
    const match = /^(.+?)\s+(#[0-9a-fA-F]{6})$/.exec(line);
    return match ? { name: (match[1] as string).trim(), swatch: (match[2] as string).toLowerCase() } : null;
  });
  return colors.every(Boolean) ? (colors as { name: string; swatch: string }[]) : null;
}

/** Every place a product can sit, for one select: "Lighting", "Lighting › Indoor", "Lighting › Indoor › Panels". */
export function placementChoices(options: CatalogueOptions): { value: string; label: string; active: boolean }[] {
  const choices: { value: string; label: string; active: boolean }[] = [];
  for (const category of options.categories) {
    choices.push({ value: `${category.id}||`, label: category.name, active: category.active });
    for (const group of category.groups) {
      choices.push({ value: `${category.id}|${group.id}|`, label: `${category.name} › ${group.name}`, active: category.active && group.active });
      for (const sub of group.subcategories) {
        choices.push({ value: `${category.id}|${group.id}|${sub.id}`, label: `${category.name} › ${group.name} › ${sub.name}`, active: category.active && group.active && sub.active });
      }
    }
  }
  return choices;
}

/** A saved product as the form shows it. */
export function formValuesOf(product: ProductDetail): ProductFormValues {
  return {
    name: product.name,
    sku: product.sku,
    slug: product.slug,
    description: product.description ?? "",
    placement: `${product.categoryId}|${product.groupId ?? ""}|${product.subcategoryId ?? ""}`,
    brandId: product.brandId ?? "",
    variantLabel: product.variantLabel ?? "",
    price: fromMinor(product.priceMinor, product.currencyExponent),
    wasPrice: fromMinor(product.wasPriceMinor, product.currencyExponent),
    specifications: product.specifications.map((spec) => `${spec.label}: ${spec.value}`).join("\n"),
    variants: product.variants.join("\n"),
    colors: product.colors.map((color) => `${color.name} ${color.swatch.toUpperCase()}`).join("\n"),
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const unique = (items: string[]) => new Set(items.map((item) => item.toLowerCase())).size === items.length;

/**
 * Checks the form and builds what is sent to the country. `creating` also
 * checks the web address (it cannot change later). Messages are written
 * for the person filling in the form.
 */
export function buildProductInput(
  values: ProductFormValues,
  context: { exponent: number; creating: boolean },
): { ok: true; slug: string; product: ProductInput } | { ok: false; errors: Partial<Record<keyof ProductFormValues, string>> } {
  const errors: Partial<Record<keyof ProductFormValues, string>> = {};
  const name = values.name.trim();
  if (name.length < 2 || name.length > PRODUCT_LIMITS.name) errors.name = `Enter a name of 2 to ${PRODUCT_LIMITS.name} characters`;

  const sku = values.sku.trim().toUpperCase();
  if (!PRODUCT_SKU_PATTERN.test(sku)) errors.sku = "Use 2 to 40 capital letters, digits and dashes, e.g. TZ-BULB-12W";

  const slug = (values.slug.trim() || slugify(name)).toLowerCase();
  if (context.creating && (!PRODUCT_SLUG_PATTERN.test(slug) || slug.length > 80)) {
    errors.slug = "Use lower-case letters, digits and single dashes, e.g. smart-led-bulb-12w";
  }

  const description = values.description.trim();
  if (description.length > PRODUCT_LIMITS.description) errors.description = `Keep the description under ${PRODUCT_LIMITS.description} characters`;

  const [categoryId = "", groupId = "", subcategoryId = ""] = values.placement.split("|");
  if (!UUID.test(categoryId) || (groupId && !UUID.test(groupId)) || (subcategoryId && !UUID.test(subcategoryId))) errors.placement = "Choose where the product belongs";

  const brandId = values.brandId.trim();
  if (brandId && !UUID.test(brandId)) errors.brandId = "Choose a brand from the list";

  const variantLabel = values.variantLabel.trim();
  if (variantLabel.length > PRODUCT_LIMITS.variantLabel) errors.variantLabel = `Keep it under ${PRODUCT_LIMITS.variantLabel} characters`;

  const price = toMinor(values.price, context.exponent);
  if (price === null || price < 1) errors.price = "Enter the price, e.g. 28000";
  const wasPrice = values.wasPrice.trim() ? toMinor(values.wasPrice, context.exponent) : null;
  if (values.wasPrice.trim() && (wasPrice === null || (price !== null && wasPrice <= price))) {
    errors.wasPrice = "The earlier price must be higher than the price, or empty";
  }

  const specifications = parseSpecifications(values.specifications);
  if (!specifications) errors.specifications = 'Write one "Label: value" per line';
  else if (
    specifications.length > PRODUCT_LIMITS.specifications ||
    specifications.some((spec) => spec.label.length > PRODUCT_LIMITS.specLabel || spec.value.length > PRODUCT_LIMITS.specValue) ||
    !unique(specifications.map((spec) => spec.label))
  ) {
    errors.specifications = `Up to ${PRODUCT_LIMITS.specifications} lines, each label once (label up to ${PRODUCT_LIMITS.specLabel}, value up to ${PRODUCT_LIMITS.specValue} characters)`;
  }

  const variants = parseVariants(values.variants);
  if (variants.length > PRODUCT_LIMITS.variants || variants.some((variant) => variant.length > PRODUCT_LIMITS.variantName) || !unique(variants)) {
    errors.variants = `Up to ${PRODUCT_LIMITS.variants} options, each once`;
  }

  const colors = parseColors(values.colors);
  if (!colors) errors.colors = 'Write one "Name #RRGGBB" per line, e.g. Warm white #FFE9B0';
  else if (colors.length > PRODUCT_LIMITS.colors || colors.some((color) => color.name.length > PRODUCT_LIMITS.colorName) || !unique(colors.map((color) => color.name))) {
    errors.colors = `Up to ${PRODUCT_LIMITS.colors} colours, each once`;
  }

  if (Object.keys(errors).length > 0 || price === null || !specifications || !colors) return { ok: false, errors };
  return {
    ok: true,
    slug,
    product: {
      name,
      sku,
      description: description || null,
      brandId: brandId || null,
      categoryId,
      groupId: groupId || null,
      subcategoryId: subcategoryId || null,
      variantLabel: variantLabel || null,
      priceMinor: price,
      wasPriceMinor: wasPrice,
      specifications,
      variants,
      colors,
    },
  };
}
