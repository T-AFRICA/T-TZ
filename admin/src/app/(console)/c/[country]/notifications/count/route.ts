import { recordSecurityEvent } from "@tronic/database/admin";
import { notificationAudiences } from "@/features/notifications/audiences";
import { loadNotifications } from "@/features/notifications/load";
import { countryApiFor } from "@/server/country-api";
import { getAdminDb } from "@/server/db";
import { getSessionState } from "@/server/session";

/**
 * How many notifications the signed-in administrator has not seen in this
 * country, for the bell in the console's header. A number about the
 * caller's own notifications: the administrator comes from the verified
 * session, the country must be one of theirs, and the country's backend
 * checks each audience's permission again. Never cached.
 */
const json = (status: number, unread: number) =>
  new Response(JSON.stringify({ unread }), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" } });

export async function GET(_request: Request, { params }: { params: Promise<{ country: string }> }) {
  const { country: countryId } = await params;
  const session = await getSessionState();
  if (session.state !== "ok") return json(404, 0);
  const admin = session.admin;
  const country = admin.countries.find((candidate) => candidate.id === countryId);
  if (!country) {
    await recordSecurityEvent(getAdminDb(), admin.access, { kind: "country_denied", countryId: countryId.slice(0, 24), detail: { what: "notifications" } });
    return json(404, 0);
  }
  const audiences = notificationAudiences(admin.actor, country.id);
  if (audiences.length === 0) return json(200, 0);
  // A country that cannot be asked shows no badge; the page says why.
  const loaded = await loadNotifications(await countryApiFor(admin, country), admin.actor.userId, audiences);
  return json(200, loaded.unread);
}
