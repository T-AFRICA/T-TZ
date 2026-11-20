import { recordSecurityEvent } from "@tronic/database/admin";
import { can } from "@tronic/permissions";
import { countryApiFor } from "@/server/country-api";
import { getAdminDb } from "@/server/db";
import { getSessionState } from "@/server/session";

/**
 * A category's banner photo as an image, for administrators who manage the
 * country's categories (a hidden category's too). Fetched from the country
 * with a signed request; the address carries the photo's version, so a new
 * photo is a new address.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const notFound = () => new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });

export async function GET(_request: Request, { params }: { params: Promise<{ country: string; categoryId: string }> }) {
  const { country: countryId, categoryId } = await params;
  const session = await getSessionState();
  if (session.state !== "ok") return notFound();
  const admin = session.admin;
  const country = admin.countries.find((candidate) => candidate.id === countryId);
  if (!country || !can(admin.actor, "categories.manage", country.id)) {
    await recordSecurityEvent(getAdminDb(), admin.access, { kind: "permission_denied", countryId: countryId.slice(0, 24), detail: { what: "categories.manage" } });
    return notFound();
  }
  if (!UUID.test(categoryId)) return notFound();
  const api = await countryApiFor(admin, country);
  const result = await api.getCategoryBanner(admin.actor.userId, categoryId);
  if (!result.available) return new Response("The country service is not available", { status: 502, headers: { "cache-control": "no-store" } });
  if (!result.data.ok) return notFound();
  return new Response(Buffer.from(result.data.file.data, "base64"), {
    headers: { "content-type": result.data.file.contentType, "cache-control": "private, max-age=86400", "x-content-type-options": "nosniff" },
  });
}
