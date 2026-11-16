import type { Metadata } from "next";
import Link from "next/link";
import { listAdministrators, listCountryServices } from "@tronic/database/admin";
import { Cell, DataTable, PageHeader, Panel, StatusPill, buttonClass } from "@/components/ui";
import { COUNTRY_STATUS_LABEL, COUNTRY_STATUS_TONE, formatDateTime, serviceState } from "@/features/labels";
import { getAdminDb } from "@/server/db";
import { requireGlobalPermission } from "@/server/session";

export const metadata: Metadata = { title: "Countries" };

export default async function CountriesPage() {
  const admin = await requireGlobalPermission("global.countries.manage");
  const db = getAdminDb();
  const [services, administrators] = await Promise.all([listCountryServices(db, admin.access), listAdministrators(db, admin.access)]);
  const serviceByCountry = new Map(services.map((service) => [service.countryId, service]));
  const superAdmins = (countryId: string) =>
    administrators.filter((person) => person.assignments.some((a) => a.role === "country_super_admin" && a.countryId === countryId));

  return (
    <>
      <PageHeader
        eyebrow="Master Super Admin"
        title="Countries"
        description="Each country keeps its own storefront, database and deployment. This is the roster the console works from: its configuration, its Super Admins and where its service is."
      />
      <Panel title="Country roster" flush>
        <DataTable caption="Country roster" head={["Country", "Code / currency", "Time zone", "Domain", "Status", "Super Admin", "Service", ""]}>
          {admin.countries.map((country) => {
            const service = serviceByCountry.get(country.id);
            const state = serviceState(service);
            const supers = superAdmins(country.id);
            return (
              <tr key={country.id}>
                <Cell>
                  <Link href={`/c/${country.id}`} className="font-semibold text-ink underline-offset-4 hover:underline">
                    {country.name}
                  </Link>
                </Cell>
                <Cell className="text-muted">{country.isoCode && country.currency ? `${country.isoCode} · ${country.currency}` : "Not confirmed"}</Cell>
                <Cell className="text-muted">{country.timezone ?? "Not set"}</Cell>
                <Cell className="text-muted">{country.websiteDomain ?? "Not set"}</Cell>
                <Cell>
                  <StatusPill tone={COUNTRY_STATUS_TONE[country.status]}>{COUNTRY_STATUS_LABEL[country.status]}</StatusPill>
                </Cell>
                <Cell>
                  {supers.length === 0 ? (
                    <span className="text-muted">Not assigned</span>
                  ) : (
                    <ul className="flex flex-col gap-0.5">
                      {supers.map((person) => (
                        <li key={person.userId} className="whitespace-nowrap">
                          {person.email}
                        </li>
                      ))}
                    </ul>
                  )}
                </Cell>
                <Cell>
                  <StatusPill tone={state.tone}>{state.label}</StatusPill>
                  {service?.lastCheck ? <p className="mt-1 text-xs text-muted">Checked {formatDateTime(service.lastCheck.checkedAt)}</p> : null}
                </Cell>
                <Cell>
                  <Link href={`/c/${country.id}/settings`} className={buttonClass.quiet} aria-label={`Configure ${country.name}`}>
                    Configure
                  </Link>
                </Cell>
              </tr>
            );
          })}
        </DataTable>
      </Panel>
      <p className="text-sm text-muted">
        Congo is listed without a code, currency or time zone until an owner confirms which country is meant. It cannot be made active before that.
      </p>
    </>
  );
}
