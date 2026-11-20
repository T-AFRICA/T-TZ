"use server";

import { z } from "zod";
import {
  PRODUCT_SLUG_PATTERN,
  PRODUCT_STOCK_MAX,
  STOCK_ADJUST_MODES,
  STOCK_NOTE_MAX,
  STOCK_REASONS_FOR,
  type CountryUnavailableReason,
  type StockReason,
} from "@tronic/api-contracts";
import { recordCountryAction } from "@tronic/database/admin";
import { can } from "@tronic/permissions";
import type { FormState } from "@/features/form-state";
import { SERVICE_UNAVAILABLE_TEXT } from "@/features/labels";
import { formText } from "@/features/rules";
import { denied, done } from "@/server/action-results";
import { countryApiFor } from "@/server/country-api";
import { getAdminDb } from "@/server/db";
import { requireAdmin, type AdminContext } from "@/server/session";
import { STOCK_REASON_LABEL, signedChange } from "./labels";

/**
 * Changes to a country's stock. The stock lives in the country's own
 * database: this console asks with a signed request and the country decides
 * (never below zero, a reason that fits the change, once per request).
 * After a change the country accepted, the audit log records it.
 */

const countryId = z.string().regex(/^[a-z][a-z0-9_]{1,23}$/);
const slug = z.string().regex(PRODUCT_SLUG_PATTERN).max(80);
const quantity = (min: number) =>
  z.coerce
    .number({ message: "Enter a whole number" })
    .int("Enter a whole number")
    .min(min, min === 0 ? "Enter 0 or more" : "Enter at least 1")
    .max(PRODUCT_STOCK_MAX, `At most ${PRODUCT_STOCK_MAX}`);

function unavailable(reason: CountryUnavailableReason): FormState {
  const unsure = reason === "timeout" || reason === "unreachable" || reason === "server_error" || reason === "invalid_response";
  return { status: "error", message: `${SERVICE_UNAVAILABLE_TEXT[reason]}${unsure ? " Reload the page to see whether the change was made before trying again." : ""}` };
}

async function audit(admin: AdminContext, entry: Parameters<typeof recordCountryAction>[2]): Promise<void> {
  try {
    const result = await recordCountryAction(getAdminDb(), admin.access, entry);
    if (!result.ok) console.error("admin: a stock change was not written to the audit log", { action: entry.action, code: result.code });
  } catch (error) {
    console.error("admin: a stock change was not written to the audit log", { action: entry.action, error: error instanceof Error ? error.name : "unknown" });
  }
}

const adjustSchema = z
  .object({
    countryId,
    slug,
    mode: z.enum(STOCK_ADJUST_MODES, { message: "Choose what happened" }),
    quantity: z.string(),
    reason: z.string(),
    note: z.string().trim().max(STOCK_NOTE_MAX, `Keep the note under ${STOCK_NOTE_MAX} characters`),
  })
  .transform((value, context) => {
    const parsedQuantity = quantity(value.mode === "set" ? 0 : 1).safeParse(value.quantity.trim() || "x");
    if (!parsedQuantity.success) {
      context.addIssue({ code: "custom", path: ["quantity"], message: parsedQuantity.error.issues[0]?.message ?? "Enter the number of units" });
      return z.NEVER;
    }
    const reason = STOCK_REASONS_FOR[value.mode].find((candidate) => candidate === value.reason);
    if (!reason) {
      context.addIssue({ code: "custom", path: ["reason"], message: "Choose a reason that fits this change" });
      return z.NEVER;
    }
    if (reason === "other" && !value.note) {
      context.addIssue({ code: "custom", path: ["note"], message: "Say what happened" });
      return z.NEVER;
    }
    return { ...value, quantity: parsedQuantity.data, reason: reason as StockReason };
  });

export async function adjustStockAction(_previous: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = adjustSchema.safeParse({
    countryId: formText(form, "countryId"),
    slug: formText(form, "slug"),
    mode: formText(form, "mode"),
    quantity: formText(form, "quantity"),
    reason: formText(form, "reason"),
    note: formText(form, "note"),
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "form")] ??= issue.message;
    return { status: "error", fieldErrors: errors };
  }
  const { mode, reason, note } = parsed.data;
  const country = admin.countries.find((candidate) => candidate.id === parsed.data.countryId);
  if (!country || !can(admin.actor, "inventory.adjust", country.id)) return denied(admin, parsed.data.countryId, "inventory.adjust");

  const api = await countryApiFor(admin, country);
  const result = await api.adjustStock(admin.actor.userId, parsed.data.slug, { mode, quantity: parsed.data.quantity, reason, ...(note ? { note } : {}) });
  if (!result.available) return unavailable(result.reason);
  const answer = result.data;
  if (!answer.ok) {
    if (answer.code === "not_enough") return { status: "error", fieldErrors: { quantity: `There are only ${answer.available ?? 0} units to remove.` } };
    if (answer.code === "no_change") return { status: "error", fieldErrors: { quantity: `There are already ${answer.available ?? 0} units.` } };
    return { status: "error", message: answer.code === "not_found" ? "That product no longer exists." : "The country did not accept that change." };
  }
  if (!answer.replayed) {
    await audit(admin, {
      countryId: country.id,
      action: "inventory.adjust",
      targetId: parsed.data.slug,
      summary: { change: answer.change, available: answer.available, reason },
    });
  }
  return done(`${signedChange(answer.change)} (${STOCK_REASON_LABEL[reason]}). ${answer.available} in stock now.`);
}

const lowStockSchema = z.object({ countryId, slug, level: quantity(0) });

export async function setLowStockAction(_previous: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = lowStockSchema.safeParse({ countryId: formText(form, "countryId"), slug: formText(form, "slug"), level: formText(form, "level").trim() || "x" });
  if (!parsed.success) return { status: "error", fieldErrors: { level: parsed.error.issues.find((issue) => issue.path[0] === "level")?.message ?? "Reload the page and try again." } };
  const country = admin.countries.find((candidate) => candidate.id === parsed.data.countryId);
  if (!country || !can(admin.actor, "inventory.adjust", country.id)) return denied(admin, parsed.data.countryId, "inventory.adjust");

  const api = await countryApiFor(admin, country);
  const result = await api.setLowStock(admin.actor.userId, parsed.data.slug, parsed.data.level);
  if (!result.available) return unavailable(result.reason);
  if (!result.data.ok) return { status: "error", message: result.data.code === "not_found" ? "That product no longer exists." : "The country did not accept that level." };
  await audit(admin, { countryId: country.id, action: "inventory.low_stock", targetId: parsed.data.slug, summary: { level: result.data.lowStockAt } });
  return done(result.data.lowStockAt === 0 ? "This product is never counted as low." : `Counted as low at ${result.data.lowStockAt} units or fewer.`);
}
