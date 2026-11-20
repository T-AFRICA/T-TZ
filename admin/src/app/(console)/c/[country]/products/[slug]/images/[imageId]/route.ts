import { PRODUCT_SLUG_PATTERN } from "@tronic/api-contracts";
import { getCountryEndpoint, recordSecurityEvent } from "@tronic/database/admin";
import { can } from "@tronic/permissions";
import { countryApiFor } from "@/server/country-api";
import { getAdminDb } from "@/server/db";
import { getSessionState } from "@/server/session";

/**
 * A product photo as an image, for administrators who may read the
 * country's products (a draft's photos too, which the storefront does not
 * serve). An uploaded photo comes from the country with a signed request; a
 * SAMPLE photo that is only a path is fetched from the country's own site.
 * The console's address is the only one the browser sees.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Paths the storefront serves product photos from. */
const STOREFRONT_PHOTO_PATH = /^\/(?:products|media\/products)\/[A-Za-z0-9._-]+(?:\.[a-z]{3,4})?$/;
const MAX_PATH_PHOTO_BYTES = 5 * 1024 * 1024;

const notFound = () => new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });

export async function GET(_request: Request, { params }: { params: Promise<{ country: string; slug: string; imageId: string }> }) {
  const { country: countryId, slug: rawSlug, imageId } = await params;
  const session = await getSessionState();
  if (session.state !== "ok") return notFound();
  const admin = session.admin;
  const country = admin.countries.find((candidate) => candidate.id === countryId);
  if (!country || !can(admin.actor, "products.read", country.id)) {
    await recordSecurityEvent(getAdminDb(), admin.access, { kind: "permission_denied", countryId: countryId.slice(0, 24), detail: { what: "products.read" } });
    return notFound();
  }
  const slug = decodeURIComponent(rawSlug).toLowerCase();
  if (!PRODUCT_SLUG_PATTERN.test(slug) || !UUID.test(imageId)) return notFound();

  const api = await countryApiFor(admin, country);
  const result = await api.getProductImage(admin.actor.userId, slug, imageId);
  if (!result.available) return new Response("The country service is not available", { status: 502, headers: { "cache-control": "no-store" } });
  if (!result.data.ok) return notFound();

  const { file, url } = result.data;
  if (file) {
    return new Response(Buffer.from(file.data, "base64"), {
      headers: {
        "content-type": file.contentType,
        // An uploaded photo never changes (a new one gets a new id).
        "cache-control": "private, max-age=86400, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  }

  // A path-only photo (the SAMPLE catalogue): only from the country's own registered site, only an image.
  if (!STOREFRONT_PHOTO_PATH.test(url) || url.includes("..")) return notFound();
  const endpoint = await getCountryEndpoint(getAdminDb(), admin.access, country.id);
  if (!endpoint?.apiBaseUrl) return notFound();
  try {
    const base = new URL(endpoint.apiBaseUrl);
    const response = await fetch(new URL(url, base.origin), { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(8000) });
    const type = response.headers.get("content-type") ?? "";
    if (response.status !== 200 || !/^image\/(?:png|jpeg|webp|avif|gif)$/.test(type.split(";")[0]!.trim())) return notFound();
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_PATH_PHOTO_BYTES) return notFound();
    return new Response(bytes, { headers: { "content-type": type, "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff" } });
  } catch {
    return notFound();
  }
}
