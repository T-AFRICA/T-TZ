import type { Metadata } from "next";
import Link from "next/link";
import { listPendingInvitations, listRiders } from "@tronic/database/admin";
import { grantRefusal } from "@tronic/permissions";
import { InviteForm } from "@/components/console-forms";
import { Cell, DataTable, EmptyRow, Notice, PageHeader, Panel } from "@/components/ui";
import { SERVICE_UNAVAILABLE_TEXT, formatDateTime } from "@/features/labels";
import { formatMinor } from "@/features/orders/labels";
import { countryApiFor } from "@/server/country-api";
import { getAdminDb } from "@/server/db";
import { requireCountry } from "@/server/session";

export const metadata: Metadata = { title: "Riders" };

/**
 * The country's riders (people holding the Rider role here) with what the
 * country records for each: orders with them now, on the way, delivered,
 * failed attempts and the cash collected today.
 */
export default async function RidersPage({ params }: { params: Promise<{ country: string }> }) {
  const { country: countryId } = await params;
  const { admin, country } = await requireCountry(countryId, "deliveries.assign");
  const mayAdd = grantRefusal(admin.actor, "rider", country.id, null) === null;
  const [riders, figures, invitations] = await Promise.all([
    listRiders(getAdminDb(), admin.access, country.id),
    countryApiFor(admin, country).then((api) => api.riderFigures(admin.actor.userId)),
    mayAdd ? listPendingInvitations(getAdminDb(), admin.access, { countryId: country.id }) : Promise.resolve([]),
  ]);
  const waiting = invitations.filter((invitation) => invitation.role === "rider");
  const base = `/c/${country.id}/riders`;
  const money = figures.available ? figures.data : null;

  return (
    <>
      <PageHeader
        eyebrow={country.name}
        title="Riders"
        description={`${riders.length} ${riders.length === 1 ? "rider" : "riders"} with the Rider role in ${country.name}.`}
      />
      {!figures.available ? (
        <Notice tone="warn" title="Delivery figures cannot be shown right now">
          {SERVICE_UNAVAILABLE_TEXT[figures.reason]}
        </Notice>
      ) : null}
      {mayAdd ? (
        <Panel
          title="Add a rider"
          description="The rider signs in to this console with the email address. Their name and phone are what the customer sees while the rider brings an order."
        >
          <InviteForm countries={[]} roles={[]} fixedCountryId={country.id} fixedRole="rider" />
        </Panel>
      ) : null}
      <Panel title="All riders" flush>
        {riders.length === 0 ? (
          <EmptyRow title="No riders yet" description="Add a rider above. They get the role when they first sign in to this console with that email address." />
        ) : (
          <DataTable caption="Riders" head={["Rider", "With them now", "On the way", "Delivered (7 days)", "Failed (7 days)", "Cash today", "Last delivery"]}>
            {riders.map((rider) => {
              const f = money?.riders[rider.userId];
              const dash = money ? "0" : "–";
              return (
                <tr key={rider.userId}>
                  <Cell>
                    <Link href={`${base}/${rider.userId}`} className="font-medium text-ink underline-offset-4 hover:underline">
                      {rider.name ?? rider.email}
                    </Link>
                    {rider.name ? <p className="text-xs text-muted">{rider.email}</p> : null}
                    <p className="text-xs text-muted">{rider.phone ?? "No phone yet"}</p>
                  </Cell>
                  <Cell className="tabular-nums">{f ? f.open : dash}</Cell>
                  <Cell className="tabular-nums">{f ? f.onTheWay : dash}</Cell>
                  <Cell className="tabular-nums">{f ? f.delivered7Days : dash}</Cell>
                  <Cell className={`tabular-nums ${f && f.failed7Days > 0 ? "font-medium text-warn" : ""}`}>{f ? f.failed7Days : dash}</Cell>
                  <Cell className="whitespace-nowrap tabular-nums">{f && money ? formatMinor(f.cashTodayMinor, money.currency, money.currencyExponent) : money ? formatMinor(0, money.currency, money.currencyExponent) : "–"}</Cell>
                  <Cell className="whitespace-nowrap text-muted">{f?.lastDeliveredAt ? formatDateTime(f.lastDeliveredAt) : "None yet"}</Cell>
                </tr>
              );
            })}
          </DataTable>
        )}
      </Panel>
      {waiting.length > 0 ? (
        <Panel title="Waiting for their first sign-in" description="These riders get the role when they first sign in with that email address. An invitation lasts seven days; withdraw one under Staff." flush>
          <DataTable caption="Riders waiting for their first sign-in" head={["Rider", "Phone", "Email", "Expires"]}>
            {waiting.map((invitation) => (
              <tr key={invitation.id}>
                <Cell className="font-medium text-ink">{invitation.name ?? "No name given"}</Cell>
                <Cell className="whitespace-nowrap tabular-nums">{invitation.phone ?? "–"}</Cell>
                <Cell className="text-muted">{invitation.email}</Cell>
                <Cell className={`whitespace-nowrap ${invitation.expired ? "font-medium text-warn" : "text-muted"}`}>
                  {invitation.expired ? "Expired" : formatDateTime(invitation.expiresAt)}
                </Cell>
              </tr>
            ))}
          </DataTable>
        </Panel>
      ) : null}
    </>
  );
}
