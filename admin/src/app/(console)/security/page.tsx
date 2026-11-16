import type { Metadata } from "next";
import { listAdministrators, listSecurityEvents } from "@tronic/database/admin";
import { Cell, DataTable, EmptyRow, PageHeader, Panel } from "@/components/ui";
import { SECURITY_EVENT_LABEL, formatDateTime } from "@/features/labels";
import { getAdminDb } from "@/server/db";
import { requireGlobalPermission } from "@/server/session";

export const metadata: Metadata = { title: "Security events" };

export default async function SecurityPage() {
  const admin = await requireGlobalPermission("global.security.read");
  const db = getAdminDb();
  const [events, people] = await Promise.all([listSecurityEvents(db, admin.access, 100), listAdministrators(db, admin.access)]);
  const emailOf = (userId: string | null) => people.find((person) => person.userId === userId)?.email ?? (userId ? "An account without a role" : "Unknown");
  const countryName = (countryId: string | null) => (countryId ? (admin.countries.find((country) => country.id === countryId)?.name ?? countryId) : "None");
  const detailText = (detail: Record<string, unknown>) =>
    Object.entries(detail)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join("; ");

  return (
    <>
      <PageHeader
        eyebrow="Master Super Admin"
        title="Security events"
        description="Attempts this console refused: a country or permission an account does not have, a role change it may not make, a suspended account trying to get in. The latest 100."
      />
      <Panel title="Refused attempts" flush>
        {events.length === 0 ? (
          <EmptyRow title="Nothing has been refused" />
        ) : (
          <DataTable caption="Security events" head={["When", "Account", "What", "Country asked for", "Details"]}>
            {events.map((event) => (
              <tr key={event.id}>
                <Cell className="whitespace-nowrap text-muted">{formatDateTime(event.occurredAt)}</Cell>
                <Cell className="whitespace-nowrap">{emailOf(event.actorId)}</Cell>
                <Cell className="font-medium text-ink">{SECURITY_EVENT_LABEL[event.kind] ?? event.kind}</Cell>
                <Cell className="text-muted">{countryName(event.countryId)}</Cell>
                <Cell className="min-w-48 text-muted [overflow-wrap:anywhere]">{detailText(event.detail)}</Cell>
              </tr>
            ))}
          </DataTable>
        )}
      </Panel>
    </>
  );
}
