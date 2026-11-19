import type { Metadata } from "next";
import Link from "next/link";
import { listRiders } from "@tronic/database/admin";
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
  const [riders, figures] = await Promise.all([
    listRiders(getAdminDb(), admin.access, country.id),
    countryApiFor(admin, country).then((api) => api.riderFigures(admin.actor.userId)),
  ]);
  const base = `/c/${country.id}/riders`;
  const money = figures.available ? figures.data : null;

  return (
    <>
      <PageHeader
        eyebrow={country.name}
        title="Riders"
        description={`${riders.length} ${riders.length === 1 ? "rider" : "riders"} with the Rider role in ${country.name}. Give the role from Staff.`}
      />
      {!figures.available ? (
        <Notice tone="warn" title="Delivery figures cannot be shown right now">
          {SERVICE_UNAVAILABLE_TEXT[figures.reason]}
        </Notice>
      ) : null}
      <Panel title="All riders" flush>
        {riders.length === 0 ? (
          <EmptyRow title="No riders yet" description="Create the person's account in the Central Admin's Supabase Auth, then give them the Rider role under Staff." />
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
    </>
  );
}
