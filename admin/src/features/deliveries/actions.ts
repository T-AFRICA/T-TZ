"use server";

import { z } from "zod";
import {
  DELIVERY_FAILURE_REASONS,
  DELIVERY_NOTE_MAX,
  DELIVERY_PROOF_MAX_BYTES,
  ORDER_NUMBER_PATTERN,
  type CountryUnavailableReason,
  type RiderDeliveryUpdate,
} from "@tronic/api-contracts";
import { listRiders, recordCountryAction, setRiderContact, type CountryAction } from "@tronic/database/admin";
import { can } from "@tronic/permissions";
import type { FormState } from "@/features/form-state";
import { SERVICE_UNAVAILABLE_TEXT } from "@/features/labels";
import { ORDER_STATUS_LABEL } from "@/features/orders/labels";
import { fieldErrors, formText, riderContactSchema } from "@/features/rules";
import { denied, done } from "@/server/action-results";
import { countryApiFor } from "@/server/country-api";
import { getAdminDb } from "@/server/db";
import { requireAdmin, type AdminContext } from "@/server/session";

/**
 * Deliveries by TRONIC's riders. The order and its delivery live in the
 * country's database; these actions ask the country with signed requests.
 * Assigning needs deliveries.assign; the rider's own steps need
 * deliveries.perform, and the country accepts them only for orders given to
 * the administrator who signs the request.
 */

const target = {
  countryId: z.string().regex(/^[a-z][a-z0-9_]{1,23}$/),
  orderNumber: z.string().regex(ORDER_NUMBER_PATTERN),
};

function unavailable(reason: CountryUnavailableReason): FormState {
  const unsure = reason === "timeout" || reason === "unreachable" || reason === "server_error" || reason === "invalid_response";
  return { status: "error", message: `${SERVICE_UNAVAILABLE_TEXT[reason]}${unsure ? " Reload the page to see whether the step was saved before trying again." : ""}` };
}

async function audit(admin: AdminContext, entry: { countryId: string; action: CountryAction; targetId: string; summary: Record<string, string | number | boolean | null> }) {
  try {
    const result = await recordCountryAction(getAdminDb(), admin.access, entry);
    if (!result.ok) console.error("admin: a delivery step was not written to the audit log", { action: entry.action, code: result.code });
  } catch (error) {
    console.error("admin: a delivery step was not written to the audit log", { action: entry.action, error: error instanceof Error ? error.name : "unknown" });
  }
}

async function countryFor(admin: AdminContext, countryId: string, permission: "deliveries.assign" | "deliveries.perform") {
  const country = admin.countries.find((candidate) => candidate.id === countryId);
  if (!country || !can(admin.actor, permission, country.id)) return null;
  return country;
}

// ------------------------------------------------------------------ assign --

export async function assignRiderAction(_previous: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = z.object({ ...target, riderId: z.string().uuid("Choose a rider") }).safeParse({
    countryId: formText(form, "countryId"),
    orderNumber: formText(form, "orderNumber"),
    riderId: formText(form, "riderId"),
  });
  if (!parsed.success) return { status: "error", message: "Choose a rider.", fieldErrors: fieldErrors(parsed.error) };
  const { countryId, orderNumber, riderId } = parsed.data;
  const country = await countryFor(admin, countryId, "deliveries.assign");
  if (!country) return denied(admin, countryId, "deliveries.assign");

  // The rider must hold the Rider role in this country now; the name comes from our own records.
  const rider = (await listRiders(getAdminDb(), admin.access, country.id)).find((candidate) => candidate.userId === riderId);
  if (!rider) return { status: "error", message: "That person is not an active rider in this country." };
  const riderName = (rider.name ?? rider.email).slice(0, 80);

  const api = await countryApiFor(admin, country);
  const result = await api.assignDelivery(admin.actor.userId, orderNumber, { riderId, riderName, ...(rider.phone ? { riderPhone: rider.phone } : {}) });
  if (!result.available) return unavailable(result.reason);
  const answer = result.data;
  if (!answer.ok) {
    if (answer.code === "not_assignable") {
      return { status: "error", message: `A rider can be given an order while it is confirmed, processing or packed. This order is "${answer.status ? ORDER_STATUS_LABEL[answer.status] : "past that"}".` };
    }
    return { status: "error", message: answer.code === "not_found" ? "That order no longer exists." : "The country did not accept that rider." };
  }
  await audit(admin, { countryId: country.id, action: "delivery.assign", targetId: orderNumber, summary: { rider: riderId } });
  return done(`Order ${orderNumber} is now with ${riderName}.`);
}

// ---------------------------------------------------- rider name and phone --

export async function setRiderContactAction(_previous: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = riderContactSchema.safeParse({
    countryId: formText(form, "countryId"),
    riderId: formText(form, "riderId"),
    name: formText(form, "name"),
    phone: formText(form, "phone"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  const country = await countryFor(admin, parsed.data.countryId, "deliveries.assign");
  if (!country) return denied(admin, parsed.data.countryId, "deliveries.assign");
  let result: Awaited<ReturnType<typeof setRiderContact>>;
  try {
    result = await setRiderContact(getAdminDb(), admin.access, { countryId: country.id, riderId: parsed.data.riderId, name: parsed.data.name, phone: parsed.data.phone });
  } catch (error) {
    if ((error as { code?: unknown } | null)?.code !== "42883") throw error;
    return { status: "error", message: "The Central Admin database needs database/admin-migrations/0004_admin_phone.sql before a rider's name and phone can be saved." };
  }
  if (!result.ok) return { status: "error", message: result.code === "not_allowed" ? "That person is not a rider you can manage here." : "That name or phone number was not accepted." };
  return done("Saved. The customer sees this name and phone with this rider's next orders.");
}

// ---------------------------------------------------------- rider location --

/** The rider's phone reports where it is, while an order is on its way. Quiet: no audit entry, no page refresh. */
export async function riderLocationAction(input: { countryId: string; orderNumber: string; lat: number; lng: number; accuracy: number | null }): Promise<"saved" | "skipped" | "stopped" | "missing" | "unavailable"> {
  const admin = await requireAdmin();
  const parsed = z
    .object({ ...target, lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), accuracy: z.number().nonnegative().max(100_000).nullable() })
    .safeParse(input);
  if (!parsed.success) return "stopped";
  const country = await countryFor(admin, parsed.data.countryId, "deliveries.perform");
  if (!country) return "stopped";
  const api = await countryApiFor(admin, country);
  const result = await api.reportLocation(admin.actor.userId, parsed.data.orderNumber, {
    lat: parsed.data.lat,
    lng: parsed.data.lng,
    ...(parsed.data.accuracy !== null ? { accuracy: Math.round(parsed.data.accuracy) } : {}),
  });
  if (!result.available) return result.reason === "country_tracking_missing" ? "missing" : "unavailable";
  if (!result.data.ok) return "stopped";
  return result.data.saved ? "saved" : "skipped";
}

// ------------------------------------------------------------ rider steps --

const STEP_DONE = {
  pickup: (orderNumber: string) => `Order ${orderNumber} picked up.`,
  start: (orderNumber: string) => `Delivery of ${orderNumber} started. The customer can now see their code.`,
} as const;

function refusal(code: string, extra: { status?: string; attemptsLeft?: number; lockedUntil?: string }): FormState {
  switch (code) {
    case "wrong_code":
      return { status: "error", message: `That code is not right. ${extra.attemptsLeft ?? 0} ${extra.attemptsLeft === 1 ? "try" : "tries"} left before the order is locked for 15 minutes.`, fieldErrors: { code: "Ask the customer for the code again." } };
    case "code_locked":
      return { status: "error", message: `Too many wrong codes. Try again after ${extra.lockedUntil ? new Date(extra.lockedUntil).toLocaleTimeString("en-GB", { timeZone: "Africa/Dar_es_Salaam", hour: "2-digit", minute: "2-digit" }) : "15 minutes"}, or call your order manager.` };
    case "proof_missing":
      return { status: "error", message: "Take the photo and get the customer's signature first." };
    case "cash_mismatch":
      return { status: "error", message: "Confirm that you collected the full amount in cash." };
    case "wrong_step":
      return { status: "error", message: `This order is "${extra.status ?? "somewhere else"}" now. Reload the page.` };
    case "not_found":
      return { status: "error", message: "This order is not one of your deliveries any more." };
    default:
      return { status: "error", message: "The country did not accept that step." };
  }
}

async function riderStep(
  admin: AdminContext,
  countryId: string,
  orderNumber: string,
  action: "pickup" | "start" | "deliver" | "fail",
  update: RiderDeliveryUpdate,
): Promise<FormState | { ok: true; status: string }> {
  const country = await countryFor(admin, countryId, "deliveries.perform");
  if (!country) return denied(admin, countryId, "deliveries.perform");
  const api = await countryApiFor(admin, country);
  const result = await api.updateMyDelivery(admin.actor.userId, orderNumber, action, update);
  if (!result.available) return unavailable(result.reason);
  const answer = result.data;
  if (!answer.ok) return refusal(answer.code, answer);
  if (!answer.replayed) {
    await audit(admin, { countryId: country.id, action: `delivery.${action}`, targetId: orderNumber, summary: { status: answer.status, reason: update.reason ?? null } });
  }
  return { ok: true, status: answer.status };
}

export async function riderStepAction(_previous: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = z.object({ ...target, step: z.enum(["pickup", "start"]) }).safeParse({
    countryId: formText(form, "countryId"),
    orderNumber: formText(form, "orderNumber"),
    step: formText(form, "step"),
  });
  if (!parsed.success) return { status: "error", message: "That step is not valid." };
  const { countryId, orderNumber, step } = parsed.data;
  const result = await riderStep(admin, countryId, orderNumber, step, {});
  return "ok" in result ? done(STEP_DONE[step](orderNumber)) : result;
}

export async function riderFailAction(_previous: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      ...target,
      reason: z.enum(DELIVERY_FAILURE_REASONS, { message: "Choose what happened" }),
      note: z.string().trim().max(DELIVERY_NOTE_MAX, `Keep the note under ${DELIVERY_NOTE_MAX} characters`).optional(),
    })
    .refine((value) => value.reason !== "other" || (value.note ?? "").length > 0, { path: ["note"], message: "Say what happened" })
    .safeParse({
      countryId: formText(form, "countryId"),
      orderNumber: formText(form, "orderNumber"),
      reason: formText(form, "reason"),
      note: formText(form, "note") || undefined,
    });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  const { countryId, orderNumber, reason, note } = parsed.data;
  const result = await riderStep(admin, countryId, orderNumber, "fail", { reason, ...(note ? { note } : {}) });
  return "ok" in result ? done("Attempt recorded. The order stays with you.") : result;
}

/** A data URL from the rider's phone (photo or signature), as an image the country accepts; null otherwise. */
function image(dataUrl: string): RiderDeliveryUpdate["photo"] | null {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) return null;
  const data = match[2] as string;
  const bytes = Math.floor((data.length * 3) / 4);
  if (bytes < 100 || bytes > DELIVERY_PROOF_MAX_BYTES) return null;
  return { contentType: match[1] as "image/jpeg" | "image/png" | "image/webp", data };
}

export async function riderDeliverAction(_previous: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({ ...target, code: z.string().trim().regex(/^[0-9]{6}$/, "Enter the customer's 6-digit code") })
    .safeParse({ countryId: formText(form, "countryId"), orderNumber: formText(form, "orderNumber"), code: formText(form, "code") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  const { countryId, orderNumber, code } = parsed.data;

  const photo = image(formText(form, "photo"));
  const signature = image(formText(form, "signature"));
  const errors: Record<string, string> = {};
  if (!photo) errors.photo = "Take a photo of the order at the door.";
  if (!signature) errors.signature = "Ask the customer to sign.";
  if (!photo || !signature) return { status: "error", message: "Take the photo and get the customer's signature first.", fieldErrors: errors };

  // The amount to collect comes from the country, never from the form.
  const country = await countryFor(admin, countryId, "deliveries.perform");
  if (!country) return denied(admin, countryId, "deliveries.perform");
  const api = await countryApiFor(admin, country);
  const current = await api.getMyDelivery(admin.actor.userId, orderNumber);
  if (!current.available) return unavailable(current.reason);
  if (!current.data.ok) return refusal("not_found", {});
  const cash = current.data.delivery.cashToCollectMinor;
  if (cash > 0 && formText(form, "cashCollected") !== "yes") {
    return { status: "error", message: "Confirm that you collected the full amount in cash.", fieldErrors: { cashCollected: "Collect the cash first." } };
  }

  const result = await riderStep(admin, countryId, orderNumber, "deliver", { code, photo, signature, ...(cash > 0 ? { cashCollectedMinor: cash } : {}) });
  return "ok" in result ? done(`Order ${orderNumber} delivered. Thank you.`) : result;
}
