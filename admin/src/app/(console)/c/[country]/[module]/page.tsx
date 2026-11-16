import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listCountryServices } from "@tronic/database/admin";
import { can } from "@tronic/permissions";
import { Notice, PageHeader, Panel, StatusPill, buttonClass } from "@/components/ui";
import { serviceState } from "@/features/labels";
import { COUNTRY_MODULES, isCountryModule } from "@/features/nav";
import { getAdminDb } from "@/server/db";
import { requireCountry } from "@/server/session";

export const metadata: Metadata = { title: "Country module" };

/**
 * A country module (products, orders, ...). Its records live in the
 * country's own database and are reached through the country's service, so
 * this page shows the state of that connection and nothing else until the
 * module's endpoints exist: no sample rows, no placeholder numbers, no
 * buttons that do nothing.
 */
export default async function CountryModulePage({ params }: { params: Promise<{ country: string; module: string }> }) {
  const { country: countryId, module: moduleKey } = await params;
  if (!isCountryModule(moduleKey)) notFound();
  const section = COUNTRY_MODULES[moduleKey];
  const { admin, country } = await requireCountry(countryId, section.permission);

  const seesSettings = can(admin.actor, "settings.read", country.id);
  const service = seesSettings ? ((await listCountryServices(getAdminDb(), admin.access)).find((candidate) => candidate.countryId === country.id) ?? null) : null;
  const state = serviceState(service);

  return (
    <>
      <PageHeader eyebrow={country.name} title={section.label} description={section.summary} />
      <Panel title="Not available yet" actions={seesSettings ? <StatusPill tone={state.tone}>{state.label}</StatusPill> : undefined}>
        <div className="flex flex-col gap-4">
          <Notice tone="neutral" title={`${section.label} for ${country.name} cannot be shown yet`}>
            {state.connected
              ? `${country.name}'s service is connected, but the ${section.label.toLowerCase()} part of the country API has not been built yet.`
              : `These records live in ${country.name}'s own database. This console reaches them only through ${country.name}'s service, which is not connected yet.`}
          </Notice>
          <p className="text-sm text-muted">
            Your role already includes this area, so it will open here as soon as it is connected. Nothing is shown in the meantime rather than sample data.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href={`/c/${country.id}`} className={buttonClass.secondary}>
              Back to the dashboard
            </Link>
            {seesSettings ? (
              <Link href={`/c/${country.id}/settings`} className={buttonClass.secondary}>
                Service connection
              </Link>
            ) : null}
          </div>
        </div>
      </Panel>
    </>
  );
}
