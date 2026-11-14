/**
 * The customer's optional profile photo: one object in the private
 * "avatars" bucket of Supabase Storage (database/migrations/0005), named
 * after the customer's own id. Nothing here trusts the browser: the path
 * comes from the session, the type from the file's first bytes.
 */
export const AVATAR_BUCKET = "avatars";
/** Same limit as the bucket's own (0005_customer_avatars.sql). */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_ACCEPT = "image/jpeg,image/png,image/webp";

export type AvatarImageType = "image/jpeg" | "image/png" | "image/webp";

/** The one object a customer may have. Always built from the session's user id. */
export function avatarObjectPath(userId: string): string {
  return `${userId}/avatar`;
}

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

/**
 * JPEG, PNG or WebP by the file's signature, or null. The name and the
 * type the browser claims are ignored, so an HTML or SVG file renamed to
 * .png is refused and can never be served back as a page.
 */
export function sniffImageType(bytes: Uint8Array): AvatarImageType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // "RIFF" <size> "WEBP"
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

/**
 * Where the signed-in customer's photo is served, or null without one. The
 * version (set on each upload) only makes a replaced photo a new address;
 * whose photo it is always comes from the session.
 */
export function avatarUrl(version: string | null): string | null {
  return version ? `/account/photo/${version}` : null;
}
