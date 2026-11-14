"use server";

import { revalidatePath } from "next/cache";
import { NAME_MAX } from "@/features/auth/rules";
import { authConfigured, currentUser, supabaseServer } from "@/features/auth/server";
import { normalizeTzPhone } from "@/features/checkout/validation";
import { AVATAR_BUCKET, AVATAR_MAX_BYTES, avatarObjectPath, sniffImageType } from "./avatar";

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

/**
 * Photo form's POST handler: uploads, replaces or removes the signed-in
 * customer's optional profile photo in the private "avatars" bucket, with
 * the customer's own session (Storage policies, migration 0005). The object
 * path comes from the session, never from the form. The file is checked
 * here whatever the browser did: size, and the real type from its first
 * bytes (JPEG, PNG or WebP only).
 */
export type PhotoFormState = { status: "idle" } | { status: "saved" } | { status: "removed" } | { status: "error"; message: string };

/** The server log gets Storage's status code only: never the file or its name. */
function logStorageRefusal(operation: string, error: object): void {
  const status = "statusCode" in error && typeof error.statusCode === "string" ? error.statusCode : "none";
  console.error(`account: ${operation} refused by storage`, { status });
}

export async function photoAction(_previous: PhotoFormState, form: FormData): Promise<PhotoFormState> {
  if (!authConfigured()) return { status: "error", message: "Account services are not connected yet." };
  const user = await currentUser();
  if (!user) return { status: "error", message: "Your session has ended. Sign in again to change your photo." };

  const supabase = await supabaseServer();
  const bucket = supabase.storage.from(AVATAR_BUCKET);
  const path = avatarObjectPath(user.id);

  if (form.get("intent") === "remove") {
    const failed: PhotoFormState = { status: "error", message: "We could not remove your photo. Please try again." };
    const { error } = await bucket.remove([path]);
    if (error) {
      logStorageRefusal("photo removal", error);
      return failed;
    }
    const { error: profileError } = await supabase.auth.updateUser({ data: { avatar_version: null } });
    if (profileError) return failed;
    revalidatePath("/account", "layout");
    return { status: "removed" };
  }

  const file = form.get("photo");
  if (!(file instanceof Blob) || file.size === 0) return { status: "error", message: "Choose a photo first." };
  if (file.size > AVATAR_MAX_BYTES) return { status: "error", message: "That photo is larger than 2 MB. Choose a smaller one." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = sniffImageType(bytes);
  if (!contentType) return { status: "error", message: "Use a JPEG, PNG or WebP image." };

  const failed: PhotoFormState = { status: "error", message: "We could not save your photo. Please try again." };
  const { error } = await bucket.upload(path, bytes, { contentType, upsert: true });
  if (error) {
    logStorageRefusal("photo upload", error);
    return failed;
  }
  const { error: profileError } = await supabase.auth.updateUser({ data: { avatar_version: String(Date.now()) } });
  if (profileError) return failed;

  // The sidebar and the profile page show the photo.
  revalidatePath("/account", "layout");
  return { status: "saved" };
}
