"use server";

import { revalidatePath } from "next/cache";
import { NAME_MAX } from "@/features/auth/rules";
import { authConfigured, currentUser, supabaseServer } from "@/features/auth/server";
import { normalizeTzPhone } from "@/features/checkout/validation";

/**
 * Profile form's POST handler (server action). Updates the signed-in
 * customer's own name and phone in Supabase Auth: the session decides whose
 * profile changes, never a field in the form. Returns only a status; the
 * values travel in the POST body, never in a URL.
 */
export type ProfileFormState =
  | { status: "idle" }
  | { status: "invalid"; fieldErrors: { fullName?: string; phone?: string } }
  | { status: "error"; message: string }
  | { status: "saved" };

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function updateProfileAction(_previous: ProfileFormState, form: FormData): Promise<ProfileFormState> {
  if (!authConfigured()) return { status: "error", message: "Account services are not connected yet." };
  const user = await currentUser();
  if (!user) return { status: "error", message: "Your session has ended. Sign in again to update your profile." };

  const fullName = text(form, "fullName").replace(/\s+/g, " ");
  const phoneRaw = text(form, "phone");
  const fieldErrors: { fullName?: string; phone?: string } = {};
  if (fullName.length < 2) fieldErrors.fullName = "Enter your full name.";
  else if (fullName.length > NAME_MAX) fieldErrors.fullName = `Keep your name under ${NAME_MAX} characters.`;
  const phone = phoneRaw === "" ? null : normalizeTzPhone(phoneRaw);
  if (phoneRaw !== "" && phone === null) fieldErrors.phone = "Enter a Tanzania mobile number, e.g. 0712 345 678.";
  if (fieldErrors.fullName || fieldErrors.phone) return { status: "invalid", fieldErrors };

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.updateUser({ data: { full_name: fullName, phone: phone ?? "" } });
  if (error) return { status: "error", message: "We could not save your profile. Please try again." };

  // The sidebar and the dashboard greeting show the name.
  revalidatePath("/account", "layout");
  return { status: "saved" };
}
