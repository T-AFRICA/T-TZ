import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listAuditLog } from "@tronic/database/admin";
import { countriesWith } from "@tronic/permissions";
import { Cell, DataTable, EmptyRow, PageHeader, Pagination, Panel, buttonClass, inputClass } from "@/components/ui";
import { auditActionLabel, auditSummaryText, formatDateTime } from "@/features/labels";
import { getAdminDb } from "@/server/db";
import { requireAdmin } from "@/server/session";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const admin = await requireAdmin();
  // Whose log may this administrator read? Decided from their roles, not from the address.
  const allowed = countriesWith(admin.actor, "audit.read");
  const readable = admin.countries.filter((country) => allowed === "all" || allowed.includes(country.id));
  if (!admin.isMaster && readable.length === 0) notFound();

  const params = await searchParams;
  const requested = typeof params.country === "string" ? params.country : "";
  const scope = requested === "global" && admin.isMaster ? "global" : readable.some((country) => country.id === requested) ? requested : undefined;
  const page = Number.parseInt(typeof params.page === "string" ? params.page : "1", 10);

  const log = await listAuditLog(getAdminDb(), admin.access, {
    ...(scope ? { countryId: scope } : {}),
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  });
  const countryName = (countryId: string | null) => admin.countries.find((country) => country.id === countryId)?.name ?? "Global";
  const hrefFor = (target: number) => `/audit?${new URLSearchParams({ ...(scope ? { country: scope } : {}), page: String(target) }).toString()}`;

  return (
    <>
      <PageHeader
        eyebrow={admin.isMaster ? "Master Super Admin" : "Your countries"}
        title="Audit log"
        description="Every privileged change made in this console: who did it, in which country, to what. Entries cannot be edited or deleted."
      />
      <Panel
        title={`${log.total} ${log.total === 1 ? "entry" : "entries"}`}
        flush
        actions={
          <form method="get" action="/audit" className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-muted">
              Country
              <select name="country" defaultValue={scope ?? ""} className={`${inputClass} min-w-44 py-2`}>
                <option value="">{admin.isMaster ? "Everything" : "All my countries"}</option>
                {admin.isMaster ? <option value="global">Global actions only</option> : null}
                {readable.map((country) => (
                  <option key={country.id} value={country.id}>
                    {country.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className={buttonClass.secondary}>
              Apply
            </button>
          </form>
        }
      >
        {log.entries.length === 0 ? (
          <EmptyRow title="Nothing recorded here yet" description="Actions appear as soon as they happen." />
        ) : (
          <DataTable caption="Audit log" head={["When", "Who", "What", "Country", "Details"]}>
            {log.entries.map((entry) => (
              <tr key={entry.id}>
                <Cell className="whitespace-nowrap text-muted">{formatDateTime(entry.occurredAt)}</Cell>
                <Cell className="whitespace-nowrap">{entry.actorEmail ?? "Provisioning (database owner)"}</Cell>
                <Cell className="font-medium text-ink">{auditActionLabel(entry.action)}</Cell>
                <Cell className="text-muted">{countryName(entry.countryId)}</Cell>
                <Cell className="text-muted">{auditSummaryText(entry.action, entry.summary)}</Cell>
              </tr>
            ))}
          </DataTable>
        )}
        <Pagination page={log.page} pageCount={log.pageCount} hrefFor={hrefFor} />
      </Panel>
    </>
  );
}
