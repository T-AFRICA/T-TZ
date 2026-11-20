import { recordSecurityEvent } from "@tronic/database/admin";
import { can } from "@tronic/permissions";
import { reportCsv, reportFileName } from "@/features/reports/csv";
import { loadReport } from "@/features/reports/load";
import { readReportQuery, todayIn } from "@/features/reports/period";
import { countryApiFor } from "@/server/country-api";
import { getAdminDb } from "@/server/db";
import { getSessionState } from "@/server/session";

/**
 * One report as a CSV file, for administrators who may read the country's
 * reports. Same tab and period as the page (?tab&from&to); a period the page
 * would not show is refused rather than replaced. No customer details.
 */
const plain = (status: number, text: string) =>
  new Response(text, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });

export async function GET(request: Request, { params }: { params: Promise<{ country: string }> }) {
  const { country: countryId } = await params;
  const session = await getSessionState();
  if (session.state !== "ok") return plain(404, "Not found");
  const admin = session.admin;
  const country = admin.countries.find((candidate) => candidate.id === countryId);
  if (!country || !can(admin.actor, "reports.read", country.id)) {
    await recordSecurityEvent(getAdminDb(), admin.access, { kind: "permission_denied", countryId: countryId.slice(0, 24), detail: { what: "reports.read" } });
    return plain(404, "Not found");
  }

  const query = Object.fromEntries(new URL(request.url).searchParams);
  const { tab, period, problem } = readReportQuery(query, todayIn(country.timezone));
  if (problem || !query.from || !query.to) return plain(400, problem ?? "Choose a period.");

  const result = await loadReport(await countryApiFor(admin, country), admin.actor.userId, tab, period);
  if (!result.available) return plain(502, "The country service is not available");

  return new Response(reportCsv(country.name, period, result.data), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${reportFileName(country.id, tab, period)}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
