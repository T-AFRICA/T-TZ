import type { Metadata } from "next";
import { listCountryServices } from "@tronic/database/admin";
import { can } from "@tronic/permissions";
import { CheckServiceForm, CountryForm, CountryServiceForm } from "@/components/console-forms";
import { Notice, PageHeader, Panel, StatusPill } from "@/components/ui";
import { COUNTRY_STATUS_LABEL, SERVICE_UNAVAILABLE_TEXT, formatDateTime, serviceState } from "@/features/labels";
import { TIME_ZONES } from "@/features/rules";
import { countryApiSigningKey } from "@/server/config";
import { getAdminDb } from "@/server/db";
import { requireCountry } from "@/server/session";
import type { CountryUnavailableReason } from "@tronic/api-contracts";

export const metadata: Metadata = { title: "Country settings" };

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 break-all text-sm text-ink">{value}</dd>
    </div>
  );
}

export default async function CountrySettingsPage({ params }: { params: Promise<{ country: string }> }) {
  const { admin, country } = await requireCountry((await params).country, "settings.read");
  const service = (await listCountryServices(getAdminDb(), admin.access)).find((candidate) => candidate.countryId === country.id) ?? null;
  const editCountry = can(admin.actor, "global.countries.manage");
  const editService = can(admin.actor, "global.services.manage");
  const state = serviceState(service);
  const lastError = service?.lastCheck && !service.lastCheck.ok ? service.lastCheck.errorCode : null;

  return (
    <>
      <PageHeader
        eyebrow={country.name}
        title="Settings"
        description="The country's configuration in this console and where its service is. Changes here are for a Master Super Admin and are written to the audit log."
      />

      <Panel title="Country configuration" description={editCountry ? undefined : "Only a Master Super Admin can change these values."}>
        {editCountry ? (
          <CountryForm country={country} timeZones={TIME_ZONES} />
        ) : (
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Fact label="Country name" value={country.name} />
            <Fact label="Operational status" value={COUNTRY_STATUS_LABEL[country.status]} />
            <Fact label="ISO country code" value={country.isoCode ?? "Not confirmed"} />
            <Fact label="Currency" value={country.currency ?? "Not confirmed"} />
            <Fact label="Time zone" value={country.timezone ?? "Not set"} />
            <Fact label="Website domain" value={country.websiteDomain ?? "Not set"} />
          </dl>
        )}
      </Panel>

      <Panel
        title="Service connection"
        description="The Central Admin never connects to a country's database. It calls the country's own backend over HTTPS, and every request is signed."
        actions={<StatusPill tone={state.tone}>{state.label}</StatusPill>}
      >
        <div className="flex flex-col gap-5">
          {service && editService ? (
            <CountryServiceForm service={service} />
          ) : (
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Fact label="Country API address" value={service?.apiBaseUrl ?? "Not registered"} />
              <Fact label="Vercel project" value={service?.vercelProject ?? "Not set"} />
              <Fact label="Supabase project reference" value={service?.supabaseProjectRef ?? "Not set"} />
            </dl>
          )}

          <div className="border-t border-line pt-5">
            <h3 className="text-sm font-semibold text-ink">Connection check</h3>
            <p className="mt-1 text-sm text-muted">
              {service?.lastCheck
                ? `Last checked ${formatDateTime(service.lastCheck.checkedAt)}: ${
                    service.lastCheck.ok
                      ? `answered in ${service.lastCheck.latencyMs ?? "?"} ms.`
                      : (SERVICE_UNAVAILABLE_TEXT[lastError as CountryUnavailableReason] ?? "it did not answer as expected.")
                  }`
                : "This country's service has never been checked."}
            </p>
            {editService && !countryApiSigningKey() ? (
              <div className="mt-3">
                <Notice tone="warn" title="No signing key">
                  This deployment has no key to sign country requests with (COUNTRY_API_SIGNING_KEY), so no country can be called yet. An owner adds it to the admin deployment.
                </Notice>
              </div>
            ) : null}
            <div className="mt-4">
              <CheckServiceForm countryId={country.id} />
            </div>
          </div>
        </div>
      </Panel>
    </>
  );
}
