import { PRODUCT_STATUSES, type ProductStatus } from "@tronic/api-contracts";

/** Display text for product values that come from a country. Nothing here decides what a product may do: the country does. */

export const PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = {
  draft: "Draft",
  live: "Live",
  hidden: "Hidden",
};

export const PRODUCT_STATUS_TONE: Record<ProductStatus, "ok" | "neutral" | "warn" | "danger" | "info"> = {
  draft: "info",
  live: "ok",
  hidden: "neutral",
};

export const PRODUCT_STATUS_HELP: Record<ProductStatus, string> = {
  draft: "Not on the website yet. Someone who may publish products makes it live.",
  live: "On the website: customers can find and order it.",
  hidden: "Taken off the website. Its orders and reports keep it; publish it to show it again.",
};

export const READINESS_TEXT: Record<"price" | "image" | "category", string> = {
  price: "a price",
  image: "at least one photo",
  category: "a category that is shown on the website",
};

export const SAVE_REFUSAL_TEXT: Record<"invalid_request" | "not_found" | "slug_taken" | "sku_taken" | "invalid_category" | "invalid_brand", string> = {
  invalid_request: "The country did not accept these details. Check the fields and try again.",
  not_found: "That product no longer exists.",
  slug_taken: "Another product already uses that web address. Choose another.",
  sku_taken: "Another product already uses that SKU.",
  invalid_category: "That category, group or subcategory no longer fits together. Choose where the product belongs again.",
  invalid_brand: "That brand no longer exists. Choose another.",
};

export function isProductStatus(value: string): value is ProductStatus {
  return (PRODUCT_STATUSES as readonly string[]).includes(value);
}
