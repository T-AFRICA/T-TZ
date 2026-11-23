import "server-only";
import type { CountryAdminApi, CountryUnavailableReason, NotificationAudience, StaffNotification } from "@tronic/api-contracts";

export interface LoadedNotification extends StaffNotification {
  audience: NotificationAudience;
}

export interface LoadedNotifications {
  /** Every audience's notifications together, newest first. */
  items: LoadedNotification[];
  unread: number;
  /** The newest notification shown per audience: what "mark all as read" records. */
  newest: Partial<Record<NotificationAudience, number>>;
  /** Why an audience could not be read, when one could not; the others are still shown. */
  unavailable: CountryUnavailableReason | null;
}

/**
 * The administrator's notifications in one country: one signed request per
 * audience they belong to (each audience is behind its own permission, and
 * the country checks it), put together newest first.
 */
export async function loadNotifications(api: CountryAdminApi, actorId: string, audiences: readonly NotificationAudience[]): Promise<LoadedNotifications> {
  const results = await Promise.all(audiences.map(async (audience) => ({ audience, result: await api.listNotifications(actorId, audience) })));
  const loaded: LoadedNotifications = { items: [], unread: 0, newest: {}, unavailable: null };
  for (const { audience, result } of results) {
    if (!result.available) {
      loaded.unavailable ??= result.reason;
      continue;
    }
    loaded.unread += result.data.unread;
    const newest = result.data.items[0]?.id;
    if (newest !== undefined) loaded.newest[audience] = newest;
    for (const item of result.data.items) loaded.items.push({ ...item, audience });
  }
  loaded.items.sort((a, b) => (a.createdAt === b.createdAt ? b.id - a.id : a.createdAt < b.createdAt ? 1 : -1));
  return loaded;
}
