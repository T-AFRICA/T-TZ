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

/**
 * A phone number as people type it: spaces, dashes and brackets are dropped,
 * a Tanzanian 06xx/07xx number gets +255, anything else needs its country
 * code. Empty means none.
 */
export function normalizePhone(value: string): string | null {
  const raw = value.replace(/[\s\-().]/g, "");
  if (raw === "") return null;
  if (/^0[67]\d{8}$/.test(raw)) return `+255${raw.slice(1)}`;
  return raw.startsWith("+") ? raw : `+${raw}`;
}

const PHONE_MESSAGE = "Enter a phone number like 0712 345 678 or +255 712 345 678";
const personName = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s+/g, " "))
  .pipe(z.string().min(2, "Enter the person's name").max(80, "Keep the name under 80 characters"));
const phone = z
  .string()
  .optional()
  .transform((value) => normalizePhone(value ?? ""))
  .pipe(z.string().regex(/^\+[0-9]{9,15}$/, PHONE_MESSAGE).nullable());

/**
 * Giving a role, optionally with the person's name and phone. A rider needs
 * both: the customer sees the rider's name and calls that phone.
 */
export const inviteSchema = z
  .object({
    email,
    role: z.enum(COUNTRY_ROLE_KEYS as [string, ...string[]], { message: "Choose a role" }),
    countryId,
    name: z
      .string()
      .optional()
      .transform((value) => (value ?? "").trim() || null)
      .pipe(personName.nullable()),
    phone,
  })
  .superRefine((value, context) => {
    if (value.role !== "rider") return;
    if (!value.name) context.addIssue({ code: "custom", path: ["name"], message: "Enter the rider's name; the customer sees it" });
    if (!value.phone) context.addIssue({ code: "custom", path: ["phone"], message: "Enter the rider's phone; the customer calls it" });
  });

/** A rider's name and phone, edited on the rider's page. */
export const riderContactSchema = z.object({ countryId, riderId: z.string().uuid(), name: personName, phone });

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
