"use server";

import { revalidatePath } from "next/cache";
import {
  inviteAdmin,
  recordCountryHealthCheck,
  revokeAdminInvitation,
  revokeAdminRole,
  setAdminStatus,
  updateCountry,
  updateCountryService,
} from "@tronic/database/admin";
import { can, grantRefusal, isRoleKey } from "@tronic/permissions";
import { SERVICE_UNAVAILABLE_TEXT, roleName } from "@/features/labels";
import {
  adminStatusSchema,
  countrySchema,
  countryServiceSchema,
  fieldErrors,
  formText,
  idSchema,
  inviteSchema,
  type FormState,
} from "@/features/rules";
import { denied, done, refused } from "@/server/action-results";
import { countryApiFor } from "@/server/country-api";
import { getAdminDb } from "@/server/db";
import { requireAdmin } from "@/server/session";

/**
 * Server actions of the console. Each one, in this order:
 *   1. resolves the administrator from the verified session (requireAdmin);
 *   2. validates the form;
 *   3. checks the permission in the country the form names, where the
 *      country is a request that must match the administrator's own roles;
 *   4. calls the admin database function, which checks everything again
 *      and writes the audit log in the same transaction.
 * A refusal returns a plain sentence, never a database message.
 */

// ------------------------------------------------------- roles and accounts --

export async function inviteAdminAction(_previous: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = inviteSchema.safeParse({ email: formText(form, "email"), role: formText(form, "role"), countryId: formText(form, "countryId") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  const { email, role, countryId } = parsed.data;
  if (!isRoleKey(role) || grantRefusal(admin.actor, role, countryId, null) !== null) return denied(admin, countryId, `invite:${role}`);

  const result = await inviteAdmin(getAdminDb(), admin.access, { email, role, countryId });
  if (!result.ok) return refused(result.code);
  return done(
    result.outcome === "granted"
      ? `${email} now has the ${roleName(role)} role.`
      : `Invitation recorded. ${email} gets the ${roleName(role)} role when they first sign in with that address.`,
  );
}

export async function revokeInvitationAction(_previous: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = idSchema.safeParse({ id: formText(form, "id") });
  if (!parsed.success) return refused("invalid_request");
  const result = await revokeAdminInvitation(getAdminDb(), admin.access, parsed.data.id);
  return result.ok ? done("Invitation withdrawn.") : refused(result.code);
}

export async function revokeRoleAction(_previous: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = idSchema.safeParse({ id: formText(form, "id") });
  if (!parsed.success) return refused("invalid_request");
  const result = await revokeAdminRole(getAdminDb(), admin.access, parsed.data.id);
  return result.ok ? done("Role removed.") : refused(result.code);
}

export async function setAdminStatusAction(_previous: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = adminStatusSchema.safeParse({
    userId: formText(form, "userId"),
    status: formText(form, "status"),
    reason: formText(form, "reason") || undefined,
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  if (!can(admin.actor, "global.admins.manage")) return denied(admin, null, "set_admin_status");
  const result = await setAdminStatus(getAdminDb(), admin.access, parsed.data);
  if (!result.ok) return refused(result.code);
  return done(parsed.data.status === "suspended" ? "Account suspended. It can no longer do anything in the console." : "Account reinstated.");
}

// ------------------------------------------------------------------ countries --

export async function updateCountryAction(_previous: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = countrySchema.safeParse({
    countryId: formText(form, "countryId"),
    name: formText(form, "name"),
    isoCode: formText(form, "isoCode"),
    currency: formText(form, "currency"),
    timezone: formText(form, "timezone"),
    websiteDomain: formText(form, "websiteDomain"),
    status: formText(form, "status"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  const { countryId, ...patch } = parsed.data;
  if (!can(admin.actor, "global.countries.manage")) return denied(admin, countryId, "update_country");
  if (patch.status === "active" && (!patch.isoCode || !patch.currency || !patch.timezone)) {
    return { status: "error", fieldErrors: { status: "A country can be active only once its ISO code, currency and time zone are set." } };
  }
  const result = await updateCountry(getAdminDb(), admin.access, countryId, {
    ...patch,
    isoCode: patch.isoCode?.toUpperCase() ?? null,
    currency: patch.currency?.toUpperCase() ?? null,
  });
  return result.ok ? done("Country configuration saved.") : refused(result.code);
}

export async function updateCountryServiceAction(_previous: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = countryServiceSchema.safeParse({
    countryId: formText(form, "countryId"),
    apiBaseUrl: formText(form, "apiBaseUrl"),
    vercelProject: formText(form, "vercelProject"),
    supabaseProjectRef: formText(form, "supabaseProjectRef"),
    enabled: form.get("enabled") === "on",
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  const { countryId, ...patch } = parsed.data;
  if (!can(admin.actor, "global.services.manage")) return denied(admin, countryId, "update_country_service");
  if (patch.enabled && !patch.apiBaseUrl) {
    return { status: "error", fieldErrors: { apiBaseUrl: "Enter the service address before switching the service on." } };
  }
  const result = await updateCountryService(getAdminDb(), admin.access, countryId, patch);
  return result.ok ? done("Service registration saved.") : refused(result.code);
}

/**
 * Asks the country's service whether it answers, with a signed request, and
 * records what happened. The result shown is the result of that request:
 * nothing is assumed about a country that was not asked.
 */
export async function checkCountryServiceAction(_previous: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const countryId = formText(form, "countryId");
  const country = admin.countries.find((candidate) => candidate.id === countryId);
  if (!country || !can(admin.actor, "settings.read", country.id)) return denied(admin, countryId, "check_country_service");

  const db = getAdminDb();
  const api = await countryApiFor(admin, country);
  const result = await api.health(admin.actor.userId);

  // "Not asked" outcomes (nothing registered, switched off, no key) are not health checks.
  const asked = result.available || result.latencyMs !== null;
  if (asked) {
    await recordCountryHealthCheck(db, admin.access, country.id, {
      ok: result.available,
      statusCode: result.statusCode,
      latencyMs: result.latencyMs,
      errorCode: result.available ? null : result.reason,
    });
  }
  if (!result.available) {
    revalidatePath("/", "layout");
    return { status: "error", message: SERVICE_UNAVAILABLE_TEXT[result.reason] };
  }
  const source = result.data.dataSource === "database" ? "live records" : "the sample catalogue";
  return done(`${country.name}'s service answered in ${result.latencyMs} ms. It is serving ${source}.`);
}
