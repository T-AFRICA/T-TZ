import { ROLES, isRoleKey } from "@tronic/permissions";
import type { AdminErrorCode, CountryStatus } from "@tronic/database/admin";
import type { CountryUnavailableReason } from "@tronic/api-contracts";

/** Display text for stored keys. Nothing here decides access. */

export function roleName(role: string): string {
  return isRoleKey(role) ? ROLES[role].name : role;
}

export const COUNTRY_STATUS_LABEL: Record<CountryStatus, string> = {
  active: "Active",
  planned: "Planned",
  pending_confirmation: "Awaiting confirmation",
  suspended: "Suspended",
};

export const COUNTRY_STATUS_TONE: Record<CountryStatus, "ok" | "neutral" | "warn" | "danger"> = {
  active: "ok",
  planned: "neutral",
  pending_confirmation: "warn",
  suspended: "danger",
};

const AUDIT_ACTION_LABEL: Record<string, string> = {
  "master.provision": "Master Super Admin provisioned",
  "master.revoke": "Master Super Admin role removed",
  "invitation.create": "Invitation sent",
  "invitation.accept": "Invitation accepted",
  "invitation.revoke": "Invitation withdrawn",
  "role.grant": "Role assigned",
  "role.revoke": "Role removed",
  "admin.suspend": "Account suspended",
  "admin.reinstate": "Account reinstated",
  "country.update": "Country configuration changed",
  "country_service.update": "Country service registration changed",
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABEL[action] ?? action;
}

/** One line describing an audit entry's details, from its stored summary. */
export function auditSummaryText(action: string, summary: Record<string, unknown>): string {
  const role = typeof summary.role === "string" ? roleName(summary.role) : null;
  const email = typeof summary.email === "string" ? summary.email : null;
  if (action === "country.update" || action === "country_service.update") {
    const before = (summary.before ?? {}) as Record<string, unknown>;
    const after = (summary.after ?? {}) as Record<string, unknown>;
    const changed = Object.keys(after).filter((key) => before[key] !== after[key]);
    if (changed.length === 0) return "No values changed";
    return changed.map((key) => `${key.replaceAll("_", " ")}: ${show(before[key])} → ${show(after[key])}`).join("; ");
  }
  if (action === "admin.suspend") {
    const reason = typeof summary.reason === "string" ? summary.reason : null;
    return [email, reason ? `Reason: ${reason}` : null].filter(Boolean).join(" · ");
  }
  return [role, email].filter(Boolean).join(" · ");
}

function show(value: unknown): string {
  if (value === null || value === undefined || value === "") return "not set";
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}

export const SECURITY_EVENT_LABEL: Record<string, string> = {
  permission_denied: "Permission refused",
  country_denied: "Country access refused",
  grant_denied: "Role change refused",
  suspended_access: "Suspended account tried to sign in",
  mfa_required: "Second factor missing",
  service_signature_rejected: "Service signature rejected",
};

/** Text for a refusal from the admin database. Never a database message. */
export const ADMIN_ERROR_TEXT: Record<AdminErrorCode, string> = {
  not_allowed: "You don't have permission to do this.",
  invalid_request: "Some of the values are not valid. Check them and try again.",
  not_found: "That record no longer exists.",
  own_account: "You can't change your own access.",
  account_suspended: "This account is suspended. Reinstate it before giving it a role.",
  already_assigned: "This person already has that role in that country.",
  already_invited: "An invitation for that role is already waiting for this person.",
  already_exists: "Another country already uses that value.",
  not_pending: "That invitation is no longer waiting.",
  not_active: "That role was already removed.",
  master_is_provisioned: "Master Super Admin accounts are managed by the provisioning process only.",
  email_not_confirmed: "The email address of this account is not confirmed yet.",
  email_in_use: "Another administrator record already uses this email address.",
};

export const SERVICE_UNAVAILABLE_TEXT: Record<CountryUnavailableReason, string> = {
  not_configured: "No service address is registered for this country.",
  disabled: "The country service is registered but switched off.",
  no_iso_code: "This country is not confirmed yet, so it has no service.",
  signing_not_configured: "The Central Admin has no signing key configured, so it cannot call country services.",
  signing_key_invalid:
    "The Central Admin's signing key (COUNTRY_API_SIGNING_KEY) cannot be read. An owner has to paste the private key into the admin deployment again and redeploy.",
  country_key_invalid:
    "The country's deployment cannot read its copy of the Central Admin's public key (CENTRAL_ADMIN_VERIFY_KEY). An owner has to paste the public key there again and redeploy.",
  country_orders_missing:
    "The country's database does not have the order administration yet. An owner has to run database/migrations/0006_order_admin.sql in that country's Supabase SQL editor.",
  country_database_denied:
    "The country's database refused the role the admin requests run as (service_role). The country's DATABASE_URL must be the project's own pooler connection string.",
  unreachable: "The country service could not be reached.",
  timeout: "The country service did not answer in time.",
  rejected: "The country service refused the request.",
  not_found: "The country service has no admin API at that address.",
  server_error: "The country service answered with an error.",
  invalid_response: "The country service answered, but not in the agreed format.",
};

const DATE_TIME = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

/** Timestamps are shown in UTC, labelled, so administrators in different countries read the same time. */
export function formatDateTime(isoText: string): string {
  return `${DATE_TIME.format(new Date(isoText))} UTC`;
}

/** What is known about a country's service, from its registration and its last real check. */
export function serviceState(service: { apiBaseUrl: string | null; enabled: boolean; lastCheck: { ok: boolean } | null } | null | undefined): {
  label: string;
  tone: "ok" | "neutral" | "warn" | "danger" | "info";
  connected: boolean;
} {
  if (!service || !service.apiBaseUrl) return { label: "Not registered", tone: "neutral", connected: false };
  if (!service.enabled) return { label: "Registered, switched off", tone: "warn", connected: false };
  if (!service.lastCheck) return { label: "Switched on, never checked", tone: "info", connected: false };
  return service.lastCheck.ok ? { label: "Connected", tone: "ok", connected: true } : { label: "Not answering", tone: "danger", connected: false };
}

/** Up to two initials for the avatar. */
export function initials(name: string | null, email: string): string {
  const parts = (name?.trim() || email.split("@")[0] || email).split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length >= 2 ? `${parts[0]![0]}${parts[1]![0]}` : (parts[0]?.slice(0, 2) ?? "A");
  return letters.toUpperCase();
}
