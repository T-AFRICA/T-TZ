"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { PRODUCT_IMAGES_MAX, PRODUCT_IMAGE_MAX_BYTES, PRODUCT_LIMITS, PRODUCT_SLUG_PATTERN, PRODUCT_STOCK_MAX, type CountryUnavailableReason } from "@tronic/api-contracts";
import { recordCountryAction } from "@tronic/database/admin";
import { can, type CountryPermission } from "@tronic/permissions";
import type { FormState } from "@/features/form-state";
import { SERVICE_UNAVAILABLE_TEXT } from "@/features/labels";
import { formText } from "@/features/rules";
import { denied, done } from "@/server/action-results";
import { countryApiFor } from "@/server/country-api";
import { getAdminDb } from "@/server/db";
import { requireAdmin, type AdminContext } from "@/server/session";
import { buildProductInput, readProductForm, type ProductFormValues } from "./form";
import { PRODUCT_STATUS_LABEL, READINESS_TEXT, SAVE_REFUSAL_TEXT } from "./labels";

/**
 * Changes to a country's products. The product lives in the country's own
 * database: this console asks the country's backend with a signed request,
 * and the country decides (signature, country, permission, the product's
 * rules). After a change the country accepted, the Central Admin's audit
 * log records it.
 */

/** A product form's result also carries what was typed, so the form shows it again after a refusal. */
export type ProductFormState = FormState & { values?: ProductFormValues };

const countryId = z.string().regex(/^[a-z][a-z0-9_]{1,23}$/);
const slug = z.string().regex(PRODUCT_SLUG_PATTERN).max(80);

async function countryFor(admin: AdminContext, id: string, permission: CountryPermission) {
  const country = admin.countries.find((candidate) => candidate.id === id);
  if (!country || !can(admin.actor, permission, country.id)) return null;
  return country;
}

function unavailable(reason: CountryUnavailableReason): FormState {
  // A change that got no answer may still have been made by the country.
  const unsure = reason === "timeout" || reason === "unreachable" || reason === "server_error" || reason === "invalid_response";
  return { status: "error", message: `${SERVICE_UNAVAILABLE_TEXT[reason]}${unsure ? " Reload the product to see whether the change was made before trying again." : ""}` };
}

async function audit(admin: AdminContext, entry: Parameters<typeof recordCountryAction>[2]): Promise<void> {
  // The country has already made and recorded the change; a failure here goes to the log only.
  try {
    const result = await recordCountryAction(getAdminDb(), admin.access, entry);
    if (!result.ok) console.error("admin: a product change was not written to the audit log", { action: entry.action, code: result.code });
  } catch (error) {
    console.error("admin: a product change was not written to the audit log", { action: entry.action, error: error instanceof Error ? error.name : "unknown" });
  }
}

async function saveProduct(form: FormData, creating: boolean): Promise<ProductFormState> {
  const admin = await requireAdmin();
  const values = readProductForm(form);
  const permission = creating ? "products.create" : "products.update";
  const id = countryId.safeParse(formText(form, "countryId"));
  const country = id.success ? await countryFor(admin, id.data, permission) : null;
  if (!country) return { ...(await denied(admin, id.success ? id.data : null, permission)), values };
  const exponent = Number(formText(form, "currencyExponent"));
  if (!Number.isInteger(exponent) || exponent < 0 || exponent > 3) return { status: "error", message: "Reload the page and try again.", values };

  const built = buildProductInput(values, { exponent, creating });
  if (!built.ok) return { status: "error", message: "Some details need another look.", fieldErrors: built.errors as Record<string, string>, values };

  const target = creating ? built.slug : slug.safeParse(formText(form, "slug"));
  if (typeof target !== "string" && !target.success) return { status: "error", message: "Reload the page and try again.", values };
  const productSlug = typeof target === "string" ? target : target.data;

  const api = await countryApiFor(admin, country);
  const result = creating
    ? await api.createProduct(admin.actor.userId, productSlug, built.product)
    : await api.updateProduct(admin.actor.userId, productSlug, built.product);
  if (!result.available) return { ...unavailable(result.reason), values };
  const answer = result.data;
  if (!answer.ok) {
    const field = answer.code === "slug_taken" ? "slug" : answer.code === "sku_taken" ? "sku" : answer.code === "invalid_category" ? "placement" : answer.code === "invalid_brand" ? "brandId" : null;
    return { status: "error", message: SAVE_REFUSAL_TEXT[answer.code], ...(field ? { fieldErrors: { [field]: SAVE_REFUSAL_TEXT[answer.code] } } : {}), values };
  }
  if (!answer.replayed) {
    await audit(admin, {
      countryId: country.id,
      action: creating ? "product.create" : "product.update",
      targetId: answer.slug,
      summary: { sku: built.product.sku, name: built.product.name.slice(0, 120), priceMinor: built.product.priceMinor },
    });
  }
  if (creating) {
    done("");
    redirect(`/c/${country.id}/products/${answer.slug}?created=1`);
  }
  return { ...done(`Saved. ${answer.status === "live" ? "The website shows the change within a minute." : ""}`.trim()), values };
}

export async function createProductAction(_previous: ProductFormState, form: FormData): Promise<ProductFormState> {
  return saveProduct(form, true);
}

export async function updateProductAction(_previous: ProductFormState, form: FormData): Promise<ProductFormState> {
  return saveProduct(form, false);
}

const statusSchema = z.object({ countryId, slug, publish: z.enum(["true", "false"]) });

export async function setProductStatusAction(_previous: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = statusSchema.safeParse({ countryId: formText(form, "countryId"), slug: formText(form, "slug"), publish: formText(form, "publish") });
  if (!parsed.success) return { status: "error", message: "Reload the page and try again." };
  const country = await countryFor(admin, parsed.data.countryId, "products.publish");
  if (!country) return denied(admin, parsed.data.countryId, "products.publish");
  const publish = parsed.data.publish === "true";

  const api = await countryApiFor(admin, country);
  const result = await api.setProductStatus(admin.actor.userId, parsed.data.slug, publish);
  if (!result.available) return unavailable(result.reason);
  const answer = result.data;
  if (!answer.ok) {
    if (answer.code === "not_ready") {
      const missing = (answer.missing ?? []).map((item) => READINESS_TEXT[item]);
      return { status: "error", message: `It cannot go live yet. It needs ${missing.join(", ") || "a few more details"}.` };
    }
    return { status: "error", message: answer.code === "not_found" ? "That product no longer exists." : "The country did not accept that change." };
  }
  if (!answer.replayed) {
    await audit(admin, { countryId: country.id, action: publish ? "product.publish" : "product.hide", targetId: parsed.data.slug, summary: { status: answer.status } });
  }
  return done(publish ? "Published. It is on the website within a minute." : `Hidden. It is "${PRODUCT_STATUS_LABEL[answer.status]}" and off the website.`);
}

const stockSchema = z.object({ countryId, slug, available: z.coerce.number().int("Enter a whole number").min(0, "Enter 0 or more").max(PRODUCT_STOCK_MAX, `At most ${PRODUCT_STOCK_MAX}`) });

export async function setProductStockAction(_previous: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = stockSchema.safeParse({ countryId: formText(form, "countryId"), slug: formText(form, "slug"), available: formText(form, "available").trim() || "x" });
  if (!parsed.success) return { status: "error", fieldErrors: { available: parsed.error.issues[0]?.message ?? "Enter the number of units" } };
  const country = await countryFor(admin, parsed.data.countryId, "inventory.adjust");
  if (!country) return denied(admin, parsed.data.countryId, "inventory.adjust");

  const api = await countryApiFor(admin, country);
  const result = await api.setProductStock(admin.actor.userId, parsed.data.slug, parsed.data.available);
  if (!result.available) return unavailable(result.reason);
  if (!result.data.ok) return { status: "error", message: result.data.code === "not_found" ? "That product no longer exists." : "The country did not accept that number." };
  if (!result.data.replayed) {
    await audit(admin, { countryId: country.id, action: "product.stock", targetId: parsed.data.slug, summary: { available: result.data.available } });
  }
  return done(`Stock set to ${result.data.available}.`);
}

const imageSchema = z.object({
  countryId,
  slug,
  alt: z.string().trim().max(PRODUCT_LIMITS.alt, `Keep the description under ${PRODUCT_LIMITS.alt} characters`).optional(),
  image: z.string().min(1, "Choose a photo first"),
});

export async function addProductImageAction(_previous: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = imageSchema.safeParse({
    countryId: formText(form, "countryId"),
    slug: formText(form, "slug"),
    alt: formText(form, "alt") || undefined,
    image: formText(form, "image"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: { [String(parsed.error.issues[0]?.path[0] ?? "image")]: parsed.error.issues[0]?.message ?? "Choose a photo first" } };
  const country = await countryFor(admin, parsed.data.countryId, "products.update");
  if (!country) return denied(admin, parsed.data.countryId, "products.update");
  // The browser made the photo smaller and sends it as a data URL.
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(parsed.data.image);
  if (!match || Math.floor(((match[2] as string).length * 3) / 4) > PRODUCT_IMAGE_MAX_BYTES) {
    return { status: "error", fieldErrors: { image: "That photo could not be read or is still over 1 MB. Try another photo." } };
  }

  const api = await countryApiFor(admin, country);
  const result = await api.addProductImage(admin.actor.userId, parsed.data.slug, {
    contentType: match[1] as "image/jpeg" | "image/png" | "image/webp",
    data: match[2] as string,
    ...(parsed.data.alt ? { alt: parsed.data.alt } : {}),
  });
  if (!result.available) return unavailable(result.reason);
  const answer = result.data;
  if (!answer.ok) {
    if (answer.code === "too_many_images") return { status: "error", message: `A product has at most ${PRODUCT_IMAGES_MAX} photos. Remove one first.` };
    return { status: "error", message: answer.code === "not_found" ? "That product no longer exists." : "The country did not accept that photo. Try a JPEG, PNG or WebP photo." };
  }
  if (!answer.replayed) await audit(admin, { countryId: country.id, action: "product.image_add", targetId: parsed.data.slug, summary: { imageId: answer.imageId } });
  return done("Photo added.");
}

const arrangeSchema = z.object({ countryId, slug, keep: z.string().max(PRODUCT_IMAGES_MAX * 37) });

/** Keeps the photos listed in `keep` (comma-separated ids), in that order; the first is the main photo. */
export async function arrangeProductImagesAction(_previous: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = arrangeSchema.safeParse({ countryId: formText(form, "countryId"), slug: formText(form, "slug"), keep: formText(form, "keep") });
  const keep = parsed.success ? parsed.data.keep.split(",").filter(Boolean) : [];
  if (!parsed.success || keep.length > PRODUCT_IMAGES_MAX || keep.some((id) => !z.string().uuid().safeParse(id).success)) {
    return { status: "error", message: "Reload the page and try again." };
  }
  const country = await countryFor(admin, parsed.data.countryId, "products.update");
  if (!country) return denied(admin, parsed.data.countryId, "products.update");

  const api = await countryApiFor(admin, country);
  const result = await api.arrangeProductImages(admin.actor.userId, parsed.data.slug, keep);
  if (!result.available) return unavailable(result.reason);
  const answer = result.data;
  if (!answer.ok) {
    if (answer.code === "last_image") return { status: "error", message: "A live product keeps at least one photo. Add another photo first, or hide the product." };
    return { status: "error", message: answer.code === "not_found" ? "That product no longer exists." : "Those photos changed meanwhile. Reload the page." };
  }
  if (!answer.replayed) await audit(admin, { countryId: country.id, action: "product.image_arrange", targetId: parsed.data.slug, summary: { kept: keep.length } });
  return done("Photos updated.");
}
