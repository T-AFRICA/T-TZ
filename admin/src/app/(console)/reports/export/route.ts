import { recordSecurityEvent } from "@tronic/database/admin";
import { globalReportCsv, globalReportFileName } from "@/features/global-reports/csv";
import { loadGlobalReport } from "@/features/global-reports/load";
import { readGlobalQuery } from "@/features/global-reports/query";
import { todayIn } from "@/features/reports/period";
import { getAdminDb } from "@/server/db";
import { getSessionState } from "@/server/session";

/**
 * The Global Combined Reports as a CSV file, for a Master Super Admin
 * only. Same period and country as the page (?from&to&country); a period
 * the page would not show is refused rather than replaced. Anyone else
 * gets the same "Not found" as for an address that does not exist, and the
 * attempt is recorded. No customer details.
 */
const plain = (status: number, text: string) =>
  new Response(text, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });

export async function GET(request: Request) {
  const session = await getSessionState();
  if (session.state !== "ok") return plain(404, "Not found");
  const admin = session.admin;
  if (!admin.isMaster) {
    await recordSecurityEvent(getAdminDb(), admin.access, { kind: "permission_denied", countryId: null, detail: { what: "global reports" } });
    return plain(404, "Not found");
  }

  const raw = Object.fromEntries(new URL(request.url).searchParams);
  const query = readGlobalQuery(raw, todayIn(null));
  if (query.problem || !raw.from || !raw.to) return plain(400, query.problem ?? "Choose a period.");
  if (query.country && !admin.countries.some((country) => country.id === query.country)) return plain(404, "Not found");

  const report = await loadGlobalReport(admin, query.period, query.country);
  return new Response(globalReportCsv(query.period, report, report.readAt), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${globalReportFileName(query.period, query.country)}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
