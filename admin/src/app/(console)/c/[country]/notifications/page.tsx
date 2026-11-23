import type { Metadata } from "next";
import Link from "next/link";
import { NOTIFICATION_AUDIENCES } from "@tronic/api-contracts";
import { UnreadSync } from "@/components/notifications";
import { EmptyRow, Notice, PageHeader, Panel, StatusPill, buttonClass } from "@/components/ui";
import { SERVICE_UNAVAILABLE_TEXT, formatDateTime } from "@/features/labels";
import { markNotificationsSeenAction } from "@/features/notifications/actions";
import { notificationAudiences } from "@/features/notifications/audiences";
import { AUDIENCE_LABEL, NOTIFICATION_TITLE, NOTIFICATION_TONE, describeNotification } from "@/features/notifications/labels";
import { loadNotifications } from "@/features/notifications/load";
import { countryApiFor } from "@/server/country-api";
import { requireCountry } from "@/server/session";

export const metadata: Metadata = { title: "Notifications" };

/**
 * What happened in the country that this administrator should know about,
 * from the country's own records (migration 0023): new and cancelled
 * orders, failed and completed deliveries, stock running low, and for a
 * rider the deliveries given to them. Each kind is shown only to those
 * whose role covers it; the country checks that again for every request.
 * Shown in the console: nothing is sent by email, SMS or push.
 */
export default async function NotificationsPage({ params }: { params: Promise<{ country: string }> }) {
  const { country: countryId } = await params;
  const { admin, country } = await requireCountry(countryId);
  const base = `/c/${country.id}`;
  const audiences = notificationAudiences(admin.actor, country.id);

  if (audiences.length === 0) {
    return (
      <>
        <PageHeader eyebrow={country.name} title="Notifications" />
        <Notice tone="info" title="Nothing to show for your role">
          Notifications are about orders, deliveries and stock. Your role in {country.name} does not include any of them.
        </Notice>
      </>
    );
  }

  const loaded = await loadNotifications(await countryApiFor(admin, country), admin.actor.userId, audiences);
  const riderOnly = audiences.length === 1 && audiences[0] === "rider";
  const about = audiences.map((audience) => AUDIENCE_LABEL[audience].toLowerCase()).join(", ");

  return (
    <>
      <UnreadSync count={loaded.unread} />
      <PageHeader
        eyebrow={country.name}
        title="Notifications"
        description={
          riderOnly
            ? "Deliveries given to you, moved to another rider or cancelled, in the last 30 days."
            : `What happened in ${country.name} in the last 30 days: ${about}. Your own actions are not listed.`
        }
        actions={
          loaded.unread > 0 ? (
            <form action={markNotificationsSeenAction}>
              <input type="hidden" name="countryId" value={country.id} />
              {NOTIFICATION_AUDIENCES.map((audience) =>
                loaded.newest[audience] === undefined ? null : (
                  <input key={audience} type="hidden" name={`through_${audience}`} value={loaded.newest[audience]} />
                ),
              )}
              <button type="submit" className={buttonClass.secondary}>
                Mark all as read
              </button>
            </form>
          ) : null
        }
      />

      {loaded.unavailable ? (
        <Notice tone="warn" title={`Some of ${country.name}'s notifications cannot be shown right now`}>
          {SERVICE_UNAVAILABLE_TEXT[loaded.unavailable]}
        </Notice>
      ) : null}

      <Panel title={loaded.unread > 0 ? `${loaded.unread} unread` : "All read"} flush>
        {loaded.items.length === 0 ? (
          <EmptyRow
            title="No notifications"
            description={riderOnly ? "A delivery given to you appears here." : "New orders, delivery problems and stock running low appear here as they happen."}
          />
        ) : (
          <ul aria-label="Notifications" className="divide-y divide-line">
            {loaded.items.map((item) => {
              const { body, href } = describeNotification(item, base);
              return (
                <li key={`${item.audience}-${item.id}`} className={`flex items-start gap-3 px-5 py-4 ${item.unread ? "bg-raised" : ""}`}>
                  <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.unread ? "bg-accent" : "bg-line"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className={`text-sm text-ink ${item.unread ? "font-bold" : "font-semibold"}`}>
                        {NOTIFICATION_TITLE[item.kind]}
                        {item.unread ? <span className="sr-only"> (unread)</span> : null}
                      </span>
                      {audiences.length > 1 ? <StatusPill tone={NOTIFICATION_TONE[item.kind]}>{AUDIENCE_LABEL[item.audience]}</StatusPill> : null}
                    </p>
                    <p className="mt-0.5 text-sm text-muted">{body}</p>
                    <p className="mt-1 text-xs text-muted">{formatDateTime(item.createdAt)}</p>
                  </div>
                  {href ? (
                    <Link href={href} className={`${buttonClass.secondary} shrink-0`} aria-label={`Open: ${body}`}>
                      Open
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}
