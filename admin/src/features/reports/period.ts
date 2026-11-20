import { REPORT_MAX_DAYS, reportPeriodQuerySchema, type ReportPeriod } from "@tronic/api-contracts";

/**
 * The tab and period of the Reports page, read from its address. Days are
 * the country's own (its time zone); both ends are included. Nothing here
 * decides access: the page and the country check that.
 */

export const REPORT_TABS = ["sales", "products", "orders", "stock"] as const;
export type ReportTab = (typeof REPORT_TABS)[number];

export const REPORT_TAB_LABEL: Record<ReportTab, string> = {
  sales: "Sales",
  products: "Products & categories",
  orders: "Orders & delivery",
  stock: "Stock",
};

/** Quick periods, in days ending today. */
export const REPORT_PRESETS = [7, 30, 90, 365] as const;
export const REPORT_DEFAULT_DAYS = 30;

export function isReportTab(value: unknown): value is ReportTab {
  return typeof value === "string" && (REPORT_TABS as readonly string[]).includes(value);
}

/** Today's date ("2026-11-20") in a time zone; UTC when the zone is unknown. */
export function todayIn(timeZone: string | null, now: Date = new Date()): string {
  const format = (zone: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  try {
    return format(timeZone || "UTC");
  } catch {
    return format("UTC");
  }
}

/** A day moved by a number of days. */
export function shiftDay(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Days in a period, both ends included. */
export function periodDays(period: ReportPeriod): number {
  return Math.round((Date.parse(`${period.to}T00:00:00Z`) - Date.parse(`${period.from}T00:00:00Z`)) / 86_400_000) + 1;
}

export interface ReportQuery {
  tab: ReportTab;
  period: ReportPeriod;
  /** The quick period this is, if it is one. */
  preset: number | null;
  /** Why the period asked for was not used. */
  problem: string | null;
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export function readReportQuery(query: Record<string, string | string[] | undefined>, today: string): ReportQuery {
  const tab = isReportTab(first(query.tab)) ? (first(query.tab) as ReportTab) : "sales";
  const fallback = { from: shiftDay(today, -(REPORT_DEFAULT_DAYS - 1)), to: today };
  const from = first(query.from);
  const to = first(query.to);
  let period: ReportPeriod = fallback;
  let problem: string | null = null;
  if (from !== undefined || to !== undefined) {
    const parsed = reportPeriodQuerySchema.safeParse({ from, to });
    if (parsed.success && parsed.data.to <= today) period = parsed.data;
    else if (parsed.success) problem = "A period cannot end after today. Showing the last 30 days.";
    else if (typeof from === "string" && typeof to === "string" && from > to) problem = "The period ends before it starts. Showing the last 30 days.";
    else problem = `Choose a start and an end, at most ${REPORT_MAX_DAYS} days apart. Showing the last 30 days.`;
  }
  const days = periodDays(period);
  const preset = period.to === today && (REPORT_PRESETS as readonly number[]).includes(days) ? days : null;
  return { tab, period, preset, problem };
}

/** The address of a report page or its CSV file. */
export function reportHref(base: string, tab: ReportTab, period: ReportPeriod): string {
  return `${base}?${new URLSearchParams({ tab, from: period.from, to: period.to }).toString()}`;
}

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const SHORT_DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** "20 Nov 2026". */
export const formatDay = (day: string) => DAY.format(new Date(`${day}T00:00:00Z`));
/** "20 Nov". */
export const formatShortDay = (day: string) => SHORT_DAY.format(new Date(`${day}T00:00:00Z`));

export function formatPeriod(period: ReportPeriod): string {
  return period.from === period.to ? formatDay(period.from) : `${formatDay(period.from)} – ${formatDay(period.to)}`;
}
