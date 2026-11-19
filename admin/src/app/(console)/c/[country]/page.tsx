import type { Metadata } from "next";
import Link from "next/link";
import { listAdministrators, listAuditLog, listCountryServices } from "@tronic/database/admin";
import { can } from "@tronic/permissions";
import { RiderDashboard } from "@/components/rider-dashboard";
import { Cell, DataTable, EmptyRow, Notice, PageHeader, Panel, StatCard, StatusPill, UnavailableStat } from "@/components/ui";
import { isRiderOnly } from "@/features/nav";
import { COUNTRY_STATUS_LABEL, COUNTRY_STATUS_TONE, auditActionLabel, auditSummaryText, formatDateTime, serviceState } from "@/features/labels";
import { getAdminDb } from "@/server/db";
import { requireCountry } from "@/server/session";

export const metadata: Metadata = { title: "Country dashboard" };

const BUSINESS_FIGURES = ["Orders", "Pending orders", "Sales", "Customers", "Products", "Low-stock items"];

export default async function CountryDashboardPage({ params }: { params: Promise<{ country: string }> }) {
  const { admin, country } = await requireCountry((await params).country);
  // A rider's dashboard is about their own deliveries.
  if (isRiderOnly(admin.actor, country.id) && can(admin.actor, "deliveries.perform", country.id)) {
    return <RiderDashboard admin={admin} country={country} />;
  }
  const db = getAdminDb();
  const seesSettings = can(admin.actor, "settings.read", country.id);
  const seesStaff = can(admin.actor, "staff.read", country.id);
  const seesAudit = can(admin.actor, "audit.read", country.id);

  const [services, staff, audit] = await Promise.all([
    seesSettings ? listCountryServices(db, admin.access) : null,
    seesStaff ? listAdministrators(db, admin.access, { countryId: country.id }) : null,
    seesAudit ? listAuditLog(db, admin.access, { countryId: country.id }) : null,
  ]);
  const service = services?.find((candidate) => candidate.countryId === country.id) ?? null;
  const state = serviceState(service);
  const reason = state.connected
    ? "Reporting is not part of the country API yet."
    : `Comes from ${country.name}'s own service, which is not connected to this console yet.`;

  return (
    <>
      <PageHeader
        eyebrow="Country dashboard"
        title={country.name}
        description={
          country.isoCode && country.currency
            ? `${country.isoCode} · amounts in ${country.currency}${country.timezone ? ` · ${country.timezone}` : ""}`
            : "This country's ISO code, currency and time zone are not confirmed yet."
        }
        actions={<StatusPill tone={COUNTRY_STATUS_TONE[country.status]}>{COUNTRY_STATUS_LABEL[country.status]}</StatusPill>}
      />

      {country.status === "pending_confirmation" ? (
        <Notice tone="warn" title="Awaiting confirmation">
          It has not been confirmed which country this is. Nothing can be operated here until a Master Super Admin sets its ISO code, currency and time zone.
        </Notice>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {BUSINESS_FIGURES.map((label) => (
          <UnavailableStat key={label} label={label} reason={reason} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {seesSettings ? (
          <Panel
            title="Service connection"
            description="How this console reaches the country's own backend."
            actions={
              <Link href={`/c/${country.id}/settings`} className="text-sm font-semibold text-accent-ink underline-offset-4 hover:underline">
                Open settings
              </Link>
            }
          >
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">State</dt>
                <dd className="mt-1">
                  <StatusPill tone={state.tone}>{state.label}</StatusPill>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Last check</dt>
                <dd className="mt-1 text-ink">{service?.lastCheck ? formatDateTime(service.lastCheck.checkedAt) : "Never checked"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Website</dt>
                <dd className="mt-1 break-all text-ink">{country.websiteDomain ?? "Domain not set"}</dd>
              </div>
            </dl>
          </Panel>
        ) : null}

        {staff ? <StatCard label="Administrators in this country" value={staff.length} hint="People holding a role here" href={`/c/${country.id}/staff`} /> : null}
      </div>

      {audit ? (
        <Panel
          title="Recent activity"
          flush
          actions={
            <Link href={`/audit?country=${country.id}`} className="text-sm font-semibold text-accent-ink underline-offset-4 hover:underline">
              Open the audit log
            </Link>
          }
        >
          {audit.entries.length === 0 ? (
            <EmptyRow title="Nothing recorded for this country yet" />
          ) : (
            <DataTable caption="Recent activity" head={["When", "Who", "What", "Details"]}>
              {audit.entries.slice(0, 6).map((entry) => (
                <tr key={entry.id}>
                  <Cell className="whitespace-nowrap text-muted">{formatDateTime(entry.occurredAt)}</Cell>
                  <Cell className="whitespace-nowrap">{entry.actorEmail ?? "Provisioning"}</Cell>
                  <Cell className="font-medium text-ink">{auditActionLabel(entry.action)}</Cell>
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
