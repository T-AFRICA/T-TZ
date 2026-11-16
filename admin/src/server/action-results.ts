import "server-only";
import { revalidatePath } from "next/cache";
import { recordSecurityEvent, type AdminErrorCode } from "@tronic/database/admin";
import { ADMIN_ERROR_TEXT } from "@/features/labels";
import type { FormState } from "@/features/form-state";
import { getAdminDb } from "./db";
import type { AdminContext } from "./session";

/** What server actions hand back to their forms. A refusal is a plain sentence, never a database or provider message. */

export function refused(code: AdminErrorCode): FormState {
  return { status: "error", message: ADMIN_ERROR_TEXT[code] };
}

/** Records the refused attempt (a country or a permission the administrator does not have) and answers "not allowed". */
export async function denied(admin: AdminContext, countryId: string | null, what: string): Promise<FormState> {
  await recordSecurityEvent(getAdminDb(), admin.access, {
    kind: countryId && !admin.countries.some((country) => country.id === countryId) ? "country_denied" : "permission_denied",
    countryId: countryId?.slice(0, 24) ?? null,
    detail: { what },
  });
  return refused("not_allowed");
}

export function done(message: string): FormState {
  revalidatePath("/", "layout");
  return { status: "ok", message };
}
