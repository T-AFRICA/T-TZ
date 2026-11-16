import { z } from "zod";
import { COUNTRY_ROLE_KEYS } from "@tronic/permissions";

/**
 * Validation of everything a form sends. Server actions parse their input
 * with these before anything else; the database checks again.
 */

export { IDLE, type FormState } from "./form-state";

const email = z.string().trim().toLowerCase().min(3, "Enter an email address").max(254, "That email address is too long").email("Enter a valid email address");
const countryId = z.string().regex(/^[a-z][a-z0-9_]{1,23}$/, "Choose a country");
const uuid = z.string().uuid();

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password").max(200, "That password is too long"),
});

export const totpSchema = z.object({
  code: z
    .string()
    .transform((value) => value.replace(/\s+/g, ""))
    .pipe(z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app")),
});

export const inviteSchema = z.object({
  email,
  role: z.enum(COUNTRY_ROLE_KEYS as [string, ...string[]], { message: "Choose a role" }),
  countryId,
});

export const idSchema = z.object({ id: uuid });

export const adminStatusSchema = z.object({
  userId: uuid,
  status: z.enum(["active", "suspended"]),
  reason: z.string().trim().max(300, "Keep the reason under 300 characters").optional(),
});

/** An empty field clears the value. */
const optional = (schema: z.ZodString) =>
  z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .pipe(schema.nullable());

export const TIME_ZONES: readonly string[] = Intl.supportedValuesOf("timeZone").filter((zone) => zone.startsWith("Africa/"));

export const countrySchema = z.object({
  countryId,
  name: z.string().trim().min(2, "Enter the country's name").max(60, "That name is too long"),
  isoCode: optional(z.string().regex(/^[A-Za-z]{2}$/, "Use the two-letter ISO code, for example TZ")),
  currency: optional(z.string().regex(/^[A-Za-z]{3}$/, "Use the three-letter ISO currency code, for example TZS")),
  timezone: optional(z.string().refine((zone) => TIME_ZONES.includes(zone), "Choose a time zone from the list")),
  websiteDomain: optional(
    z
      .string()
      .toLowerCase()
      .regex(/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/, "Enter a domain only, for example tronic.co.tz"),
  ),
  status: z.enum(["active", "planned", "pending_confirmation", "suspended"]),
});

export const countryServiceSchema = z.object({
  countryId,
  apiBaseUrl: optional(
    z
      .string()
      .max(200, "That address is too long")
      .regex(/^https:\/\/[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[0-9]{1,5})?(\/[A-Za-z0-9._~-]+)*$/, "Enter an https:// address without a trailing slash"),
  ),
  vercelProject: optional(z.string().regex(/^[A-Za-z0-9._-]{1,100}$/, "Use the Vercel project name or id")),
  supabaseProjectRef: optional(z.string().regex(/^[a-z0-9]{8,40}$/, "Use the Supabase project reference (letters and digits)")),
  enabled: z.boolean(),
});

/** Field errors of a failed parse, one message per field. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return errors;
}

export function formText(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}
