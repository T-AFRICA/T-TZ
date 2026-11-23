import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminOverview, listAuditLog, listCountryServices } from "@tronic/database/admin";
import { OverviewFigures, OverviewFiguresLoading } from "@/components/overview-figures";
import { Cell, DataTable, EmptyRow, PageHeader, Panel, StatCard, StatusPill } from "@/components/ui";
import { COUNTRY_STATUS_LABEL, COUNTRY_STATUS_TONE, auditActionLabel, auditSummaryText, formatDateTime, serviceState } from "@/features/labels";
import { getAdminDb } from "@/server/db";
import { requireAdmin } from "@/server/session";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage() {
  const admin = await requireAdmin();
  // An administrator of one country starts in that country.
  if (!admin.isMaster && admin.countries.length === 1) redirect(`/c/${admin.countries[0]!.id}`);

  const db = getAdminDb();
  const [overview, services, activity] = await Promise.all([
    getAdminOverview(db, admin.access),
    listCountryServices(db, admin.access),
    admin.isMaster ? listAuditLog(db, admin.access) : null,
  ]);
  const serviceByCountry = new Map(services.map((service) => [service.countryId, service]));
  const connected = services.filter((service) => serviceState(service).connected).length;

  return (
    <>
      <PageHeader
        eyebrow={admin.isMaster ? "Master Super Admin" : "Your countries"}
        title="Overview"
        description={
          admin.isMaster
            ? "Every TRONIC country, its administrators and the state of its connection to this console."
            : "The countries you have a role in."
        }
      />

      {admin.isMaster ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Configured countries" value={overview.countries} hint={`${overview.activeCountries} active`} href="/countries" />
          <StatCard
            label="Administrators"
            value={overview.administrators}
            hint={overview.suspendedAdministrators > 0 ? `${overview.suspendedAdministrators} suspended` : "None suspended"}
            href="/administrators"
          />
          <StatCard label="Pending invitations" value={overview.pendingInvitations} hint="Waiting for a first sign-in" href="/administrators#invitations" />
          <StatCard label="Country services switched on" value={overview.connectedServices} hint={`${connected} answered their last check`} href="/countries" />
        </div>
      ) : null}

      <Panel title="Countries" description="Status of each country and of its service connection." flush>
        {admin.countries.length === 0 ? (
          <EmptyRow title="No countries" description="Your account has no role in any country." />
        ) : (
          <DataTable caption="Countries" head={["Country", "Code", "Currency", "Status", "Service", "Last check"]}>
            {admin.countries.map((country) => {
              const service = serviceByCountry.get(country.id);
              const state = serviceState(service);
              return (
                <tr key={country.id}>
                  <Cell>
                    <Link href={`/c/${country.id}`} className="font-semibold text-ink underline-offset-4 hover:underline">
                      {country.name}
                    </Link>
                  </Cell>
                  <Cell className="text-muted">{country.isoCode ?? "Not confirmed"}</Cell>
                  <Cell className="text-muted">{country.currency ?? "Not confirmed"}</Cell>
                  <Cell>
                    <StatusPill tone={COUNTRY_STATUS_TONE[country.status]}>{COUNTRY_STATUS_LABEL[country.status]}</StatusPill>
                  </Cell>
                  <Cell>{service ? <StatusPill tone={state.tone}>{state.label}</StatusPill> : <span className="text-muted">Not shown for your role</span>}</Cell>
                  <Cell className="text-muted">{service?.lastCheck ? formatDateTime(service.lastCheck.checkedAt) : "Never"}</Cell>
                </tr>
              );
            })}
          </DataTable>
        )}
      </Panel>

      <Panel title="Business figures" description="Products, customers, orders, sales and stock live in each country's own database and reach this console only through that country's service.">
        {/* Asked from the countries while the rest of the page is already shown. Never estimated or invented here. */}
        <Suspense fallback={<OverviewFiguresLoading />}>
          <OverviewFigures admin={admin} />
        </Suspense>
      </Panel>

      {activity ? (
        <Panel
          title="Recent activity"
          description="The latest privileged actions in this console."
          flush
          actions={
            <Link href="/audit" className="text-sm font-semibold text-accent-ink underline-offset-4 hover:underline">
              Open the audit log
            </Link>
          }
        >
          {activity.entries.length === 0 ? (
            <EmptyRow title="Nothing recorded yet" />
          ) : (
            <DataTable caption="Recent activity" head={["When", "Who", "What", "Country", "Details"]}>
              {activity.entries.slice(0, 6).map((entry) => (
                <tr key={entry.id}>
                  <Cell className="whitespace-nowrap text-muted">{formatDateTime(entry.occurredAt)}</Cell>
                  <Cell>{entry.actorEmail ?? "Provisioning"}</Cell>
                  <Cell className="font-medium text-ink">{auditActionLabel(entry.action)}</Cell>
                  <Cell className="text-muted">{admin.countries.find((country) => country.id === entry.countryId)?.name ?? "Global"}</Cell>
                  <Cell className="text-muted">{auditSummaryText(entry.action, entry.summary)}</Cell>
                </tr>
              ))}
            </DataTable>
          )}
        </Panel>
      ) : null}
    </>
  );
}
