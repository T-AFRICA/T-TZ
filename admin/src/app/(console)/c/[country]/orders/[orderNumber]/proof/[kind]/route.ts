import { DELIVERY_PROOF_KINDS, ORDER_NUMBER_PATTERN } from "@tronic/api-contracts";
import { recordSecurityEvent } from "@tronic/database/admin";
import { can } from "@tronic/permissions";
import { countryApiFor } from "@/server/country-api";
import { getAdminDb } from "@/server/db";
import { getSessionState } from "@/server/session";

/**
 * A delivery proof (photo or signature) as an image, for administrators who
 * may follow deliveries in that country. Fetched from the country with a
 * signed request; never cached by the browser or a proxy.
 */
const notFound = () => new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });

export async function GET(_request: Request, { params }: { params: Promise<{ country: string; orderNumber: string; kind: string }> }) {
  const { country: countryId, orderNumber: raw, kind: rawKind } = await params;
  const session = await getSessionState();
  if (session.state !== "ok") return notFound();
  const admin = session.admin;
  const country = admin.countries.find((candidate) => candidate.id === countryId);
  if (!country || !can(admin.actor, "deliveries.assign", country.id)) {
    await recordSecurityEvent(getAdminDb(), admin.access, { kind: "permission_denied", countryId: countryId.slice(0, 24), detail: { what: "deliveries.assign" } });
    return notFound();
  }
  const orderNumber = decodeURIComponent(raw).toUpperCase();
  const kind = DELIVERY_PROOF_KINDS.find((candidate) => candidate === rawKind);
  if (!kind || !ORDER_NUMBER_PATTERN.test(orderNumber)) return notFound();

  const api = await countryApiFor(admin, country);
  const result = await api.getDeliveryProof(admin.actor.userId, orderNumber, kind);
  if (!result.available) return new Response("The country service is not available", { status: 502, headers: { "cache-control": "no-store" } });
  if (!result.data.ok) return notFound();
  const { proof } = result.data;
  return new Response(Buffer.from(proof.data, "base64"), {
    headers: {
      "content-type": proof.contentType,
      "cache-control": "private, no-store",
      "content-disposition": `inline; filename="${orderNumber}-${kind}"`,
      "x-content-type-options": "nosniff",
    },
  });
}
