"use server";

import { z } from "zod";
import { ORDER_NOTE_MAX, ORDER_NUMBER_PATTERN, ORDER_STATUSES, ORDER_STATUS_NOTE_MAX, type CountryUnavailableReason } from "@tronic/api-contracts";
import { recordCountryAction } from "@tronic/database/admin";
import { can } from "@tronic/permissions";
import type { FormState } from "@/features/form-state";
import { SERVICE_UNAVAILABLE_TEXT } from "@/features/labels";
import { fieldErrors, formText } from "@/features/rules";
import { denied, done } from "@/server/action-results";
import { countryApiFor } from "@/server/country-api";
import { getAdminDb } from "@/server/db";
import { requireAdmin, type AdminContext } from "@/server/session";
import { ORDER_STATUS_LABEL } from "./labels";

/**
 * Changes to a country's orders. The order lives in the country's own
 * database: this console asks the country's backend with a signed request
 * and the country decides (it checks the signature, the country, the
 * permission and whether the order may move to that status).
 *
 * Here, in this order: the administrator from the verified session, the
 * form, the permission in the country the form names (which must be one of
 * the administrator's own), the request to the country, and after a change
 * the audit entry in the Central Admin.
 */

const target = {
  countryId: z.string().regex(/^[a-z][a-z0-9_]{1,23}$/),
  orderNumber: z.string().regex(ORDER_NUMBER_PATTERN),
};
const statusSchema = z.object({
  ...target,
  status: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(ORDER_STATUS_NOTE_MAX, `Keep the note under ${ORDER_STATUS_NOTE_MAX} characters`).optional(),
});
const noteSchema = z.object({
  ...target,
  body: z.string().trim().min(1, "Write the note first").max(ORDER_NOTE_MAX, `Keep the note under ${ORDER_NOTE_MAX} characters`),
});

function unavailable(reason: CountryUnavailableReason, changing: boolean): FormState {
  // A request that got no answer may still have been applied by the country.
  const unsure = changing && (reason === "timeout" || reason === "unreachable" || reason === "server_error" || reason === "invalid_response");
  return { status: "error", message: `${SERVICE_UNAVAILABLE_TEXT[reason]}${unsure ? " Reload the order to see whether the change was made before trying again." : ""}` };
}

async function audit(admin: AdminContext, entry: Parameters<typeof recordCountryAction>[2]): Promise<void> {
  // The country has already made and recorded the change. If this entry
  // cannot be written the action still succeeded; the failure goes to the log.
  try {
    const result = await recordCountryAction(getAdminDb(), admin.access, entry);
    if (!result.ok) console.error("admin: an order change was not written to the audit log", { action: entry.action, code: result.code });
  } catch (error) {
    console.error("admin: an order change was not written to the audit log", { action: entry.action, error: error instanceof Error ? error.name : "unknown" });
  }
}

export async function updateOrderStatusAction(_previous: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = statusSchema.safeParse({
    countryId: formText(form, "countryId"),
    orderNumber: formText(form, "orderNumber"),
    status: formText(form, "status"),
    note: formText(form, "note") || undefined,
  });
  if (!parsed.success) return { status: "error", message: "That change is not valid.", fieldErrors: fieldErrors(parsed.error) };
  const { countryId, orderNumber, status, note } = parsed.data;
  const country = admin.countries.find((candidate) => candidate.id === countryId);
  if (!country || !can(admin.actor, "orders.update", country.id)) return denied(admin, countryId, "orders.update");

  const api = await countryApiFor(admin, country);
  const result = await api.updateOrderStatus(admin.actor.userId, orderNumber, { status, ...(note ? { note } : {}) });
  if (!result.available) return unavailable(result.reason, true);
  const answer = result.data;
  if (!answer.ok) {
    if (answer.code === "invalid_transition" && answer.status) {
      return { status: "error", message: `This order is now "${ORDER_STATUS_LABEL[answer.status]}" and cannot move to "${ORDER_STATUS_LABEL[status]}". Reload the page.` };
    }
    return { status: "error", message: answer.code === "not_found" ? "That order no longer exists." : "The country did not accept that change." };
  }
  if (!answer.replayed) {
    await audit(admin, { countryId: country.id, action: "order.status_change", targetId: orderNumber, summary: { from: answer.from, to: answer.status, note: note ?? null } });
  }
  return done(status === "cancelled" ? `Order ${orderNumber} cancelled. Its stock is available again.` : `Order ${orderNumber} is now "${ORDER_STATUS_LABEL[answer.status]}".`);
}

export async function addOrderNoteAction(_previous: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = noteSchema.safeParse({ countryId: formText(form, "countryId"), orderNumber: formText(form, "orderNumber"), body: formText(form, "body") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  const { countryId, orderNumber, body } = parsed.data;
  const country = admin.countries.find((candidate) => candidate.id === countryId);
  if (!country || !can(admin.actor, "orders.update", country.id)) return denied(admin, countryId, "orders.update");

  const api = await countryApiFor(admin, country);
  const result = await api.addOrderNote(admin.actor.userId, orderNumber, body);
  if (!result.available) return unavailable(result.reason, true);
  if (!result.data.ok) return { status: "error", message: result.data.code === "not_found" ? "That order no longer exists." : "The country did not accept that note." };
  // The note's text stays in the country; the audit log records that one was added.
  if (!result.data.replayed) await audit(admin, { countryId: country.id, action: "order.note_add", targetId: orderNumber, summary: { length: body.length } });
  return done("Note added.");
}
