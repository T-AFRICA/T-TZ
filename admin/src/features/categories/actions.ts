"use server";

import { z } from "zod";
import {
  PRODUCT_IMAGE_MAX_BYTES,
  PRODUCT_SLUG_PATTERN,
  RESERVED_CATEGORY_SLUGS,
  TAXONOMY_LEVELS,
  TAXONOMY_LIMITS,
  type CountryUnavailableReason,
} from "@tronic/api-contracts";
import { recordCountryAction } from "@tronic/database/admin";
import { can } from "@tronic/permissions";
import type { FormState } from "@/features/form-state";
import { SERVICE_UNAVAILABLE_TEXT } from "@/features/labels";
import { slugify } from "@/features/products/form";
import { formText } from "@/features/rules";
import { denied, done } from "@/server/action-results";
import { countryApiFor } from "@/server/country-api";
import { getAdminDb } from "@/server/db";
import { requireAdmin, type AdminContext } from "@/server/session";

/**
 * Changes to a country's categories and brands. They live in the country's
 * own database: this console asks with a signed request and the country
 * decides. Accepted changes are written to the audit log. The website reads
 * its menu from the same records.
 */

const countryId = z.string().regex(/^[a-z][a-z0-9_]{1,23}$/);
const uuid = z.string().uuid();

const LEVEL_NAME = { category: "Category", group: "Group", subcategory: "Subcategory" } as const;

function unavailable(reason: CountryUnavailableReason): FormState {
  const unsure = reason === "timeout" || reason === "unreachable" || reason === "server_error" || reason === "invalid_response";
  return { status: "error", message: `${SERVICE_UNAVAILABLE_TEXT[reason]}${unsure ? " Reload the page to see whether the change was made before trying again." : ""}` };
}

async function countryFor(admin: AdminContext, id: string) {
  const country = admin.countries.find((candidate) => candidate.id === id);
  return country && can(admin.actor, "categories.manage", country.id) ? country : null;
}

async function audit(admin: AdminContext, entry: Parameters<typeof recordCountryAction>[2]): Promise<void> {
  try {
    const result = await recordCountryAction(getAdminDb(), admin.access, entry);
    if (!result.ok) console.error("admin: a category change was not written to the audit log", { action: entry.action, code: result.code });
  } catch (error) {
    console.error("admin: a category change was not written to the audit log", { action: entry.action, error: error instanceof Error ? error.name : "unknown" });
  }
}

const saveSchema = z.object({
  countryId,
  level: z.enum(TAXONOMY_LEVELS),
  id: uuid.optional(),
  parentId: uuid.optional(),
  name: z.string().trim().min(2, "Enter a name of at least 2 characters").max(TAXONOMY_LIMITS.name, `Keep the name under ${TAXONOMY_LIMITS.name} characters`),
  slug: z.string().trim().toLowerCase(),
  description: z.string().trim().max(TAXONOMY_LIMITS.description, `Keep it under ${TAXONOMY_LIMITS.description} characters`),
  sortOrder: z.coerce.number({ message: "Enter a number" }).int("Enter a whole number").min(0, "Enter 0 or more").max(TAXONOMY_LIMITS.sortOrder, `At most ${TAXONOMY_LIMITS.sortOrder}`),
  shown: z.enum(["true", "false"]),
});

export async function saveTaxonomyAction(_previous: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = saveSchema.safeParse({
    countryId: formText(form, "countryId"),
    level: formText(form, "level"),
    id: formText(form, "id") || undefined,
    parentId: formText(form, "parentId") || undefined,
    name: formText(form, "name"),
    slug: formText(form, "slug"),
    description: formText(form, "description"),
    sortOrder: formText(form, "sortOrder").trim() || "0",
    shown: formText(form, "shown") || "true",
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "form")] ??= issue.message;
    return { status: "error", fieldErrors: errors };
  }
  const value = parsed.data;
  const creating = value.id === undefined;
  const slug = creating ? value.slug || slugify(value.name).slice(0, TAXONOMY_LIMITS.slug).replace(/-+$/, "") : undefined;
  if (creating && (!slug || !PRODUCT_SLUG_PATTERN.test(slug))) {
    return { status: "error", fieldErrors: { slug: "Use lower-case letters, digits and single dashes, e.g. solar-energy" } };
  }
  if (creating && value.level === "category" && (RESERVED_CATEGORY_SLUGS as readonly string[]).includes(slug ?? "")) {
    return { status: "error", fieldErrors: { slug: "That address belongs to the website's Shop by Use section. Choose another." } };
  }
  const country = await countryFor(admin, value.countryId);
  if (!country) return denied(admin, value.countryId, "categories.manage");

  const api = await countryApiFor(admin, country);
  const result = await api.saveTaxonomy(admin.actor.userId, {
    level: value.level,
    ...(value.id ? { id: value.id } : {}),
    ...(value.parentId ? { parentId: value.parentId } : {}),
    ...(slug ? { slug } : {}),
    name: value.name,
    description: value.level === "category" ? value.description || null : null,
    sortOrder: value.sortOrder,
    active: value.shown === "true",
  });
  if (!result.available) return unavailable(result.reason);
  const answer = result.data;
  if (!answer.ok) {
    if (answer.code === "slug_taken") return { status: "error", fieldErrors: { slug: "Another one here already uses that web address. Choose another." } };
    return { status: "error", message: answer.code === "not_found" ? "That no longer exists. Reload the page." : "The country did not accept that change." };
  }
  if (!answer.replayed) {
    await audit(admin, {
      countryId: country.id,
      action: "category.save",
      targetId: answer.slug,
      summary: { level: value.level, name: value.name.slice(0, 60), shown: value.shown === "true", created: creating },
    });
  }
  return done(`${LEVEL_NAME[value.level]} "${value.name}" ${creating ? "added" : "saved"}${value.shown === "true" ? "" : " (hidden from the website)"}.`);
}

const brandSchema = z.object({
  countryId,
  id: uuid.optional(),
  name: z.string().trim().min(1, "Enter the brand's name").max(TAXONOMY_LIMITS.brandName, `Keep it under ${TAXONOMY_LIMITS.brandName} characters`),
});

export async function saveBrandAction(_previous: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = brandSchema.safeParse({ countryId: formText(form, "countryId"), id: formText(form, "id") || undefined, name: formText(form, "name") });
  if (!parsed.success) return { status: "error", fieldErrors: { name: parsed.error.issues.find((issue) => issue.path[0] === "name")?.message ?? "Reload the page and try again." } };
  const country = await countryFor(admin, parsed.data.countryId);
  if (!country) return denied(admin, parsed.data.countryId, "categories.manage");

  const api = await countryApiFor(admin, country);
  const result = await api.saveBrand(admin.actor.userId, { ...(parsed.data.id ? { id: parsed.data.id } : {}), name: parsed.data.name });
  if (!result.available) return unavailable(result.reason);
  const answer = result.data;
  if (!answer.ok) {
    if (answer.code === "name_taken") return { status: "error", fieldErrors: { name: "Another brand already has that name." } };
    return { status: "error", message: answer.code === "not_found" ? "That brand no longer exists." : "The country did not accept that name." };
  }
  if (!answer.replayed) await audit(admin, { countryId: country.id, action: "brand.save", targetId: answer.id, summary: { name: parsed.data.name, created: !parsed.data.id } });
  return done(parsed.data.id ? `Brand renamed to "${parsed.data.name}".` : `Brand "${parsed.data.name}" added.`);
}

const bannerSchema = z.object({ countryId, categoryId: uuid, image: z.string() });

export async function setCategoryBannerAction(_previous: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = bannerSchema.safeParse({ countryId: formText(form, "countryId"), categoryId: formText(form, "categoryId"), image: formText(form, "image") });
  if (!parsed.success) return { status: "error", message: "Reload the page and try again." };
  const remove = parsed.data.image === "";
  const match = remove ? null : /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(parsed.data.image);
  if (!remove && (!match || Math.floor(((match[2] as string).length * 3) / 4) > PRODUCT_IMAGE_MAX_BYTES)) {
    return { status: "error", fieldErrors: { image: "That photo could not be read or is still over 1 MB. Try another photo." } };
  }
  const country = await countryFor(admin, parsed.data.countryId);
  if (!country) return denied(admin, parsed.data.countryId, "categories.manage");

  const api = await countryApiFor(admin, country);
  const result = await api.setCategoryBanner(
    admin.actor.userId,
    parsed.data.categoryId,
    match ? { contentType: match[1] as "image/jpeg" | "image/png" | "image/webp", data: match[2] as string } : { remove: true },
  );
  if (!result.available) return unavailable(result.reason);
  if (!result.data.ok) return { status: "error", message: result.data.code === "not_found" ? "That category no longer exists." : "The country did not accept that photo." };
  if (!result.data.replayed) await audit(admin, { countryId: country.id, action: "category.banner", targetId: parsed.data.categoryId, summary: { removed: remove } });
  return done(remove ? "Banner removed. The website shows the category's icon instead." : "Banner saved.");
}
