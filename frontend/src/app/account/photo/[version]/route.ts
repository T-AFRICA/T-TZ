import { AVATAR_BUCKET, avatarObjectPath, sniffImageType } from "@/features/account/avatar";
import { currentUser, supabaseServer } from "@/features/auth/server";

/**
 * GET /account/photo/<version> — the signed-in customer's own profile
 * photo, read from the private "avatars" bucket with their session. There
 * is no public URL and no id in the address: whose photo is returned comes
 * from the session alone, so this route cannot be used to see anyone
 * else's. Anything else (signed out, no photo, an old version, a file that
 * is not an image) is the same empty 404.
 *
 * The browser may keep a copy but must ask again before showing it
 * (private, no-cache): a signed-out browser gets no photo from its cache.
 */
function notFound(): Response {
  return new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: Request, { params }: { params: Promise<{ version: string }> }): Promise<Response> {
  const user = await currentUser();
  const { version } = await params;
  if (!user || !user.avatarVersion || version !== user.avatarVersion) return notFound();

  const etag = `"${user.id}-${version}"`;
  const headers = { "Cache-Control": "private, no-cache", ETag: etag, "X-Content-Type-Options": "nosniff" };
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });

  const supabase = await supabaseServer();
  const { data, error } = await supabase.storage.from(AVATAR_BUCKET).download(avatarObjectPath(user.id));
  if (error || !data) return notFound();
  const bytes = new Uint8Array(await data.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) return notFound();
  return new Response(bytes, { headers: { ...headers, "Content-Type": type, "Content-Length": String(bytes.byteLength) } });
}
