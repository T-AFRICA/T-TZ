import type { ReportPeriod } from "@tronic/api-contracts";
import { readReportQuery } from "@/features/reports/period";
import { SORT_KEYS, type SortKey } from "./combine";

/**
 * What the Global Combined Reports page was asked for, read from its
 * address: the period, one country or all, dollars or each country's own
 * currency, and how the comparison table is sorted. Nothing here decides
 * access: the page checks the administrator and the country.
 */

export type MoneyView = "usd" | "local";

export interface GlobalQuery {
  period: ReportPeriod;
  preset: number | null;
  problem: string | null;
  /** A country id as typed; the page keeps it only if it is one of the administrator's. */
  country: string | null;
  view: MoneyView;
  sort: SortKey;
  direction: "asc" | "desc";
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export function readGlobalQuery(query: Record<string, string | string[] | undefined>, today: string): GlobalQuery {
  const { period, preset, problem } = readReportQuery(query, today);
  const country = first(query.country);
  const sort = first(query.sort);
  const direction = first(query.dir);
  const key = (SORT_KEYS as readonly string[]).includes(sort ?? "") ? (sort as SortKey) : "rank";
  return {
    period,
    preset,
    problem,
    country: typeof country === "string" && /^[a-z][a-z0-9_]{1,23}$/.test(country) ? country : null,
    view: first(query.view) === "local" ? "local" : "usd",
    sort: key,
    // Names and ranks read from the top; figures largest first.
    direction: direction === "asc" || direction === "desc" ? direction : key === "rank" || key === "name" ? "asc" : "desc",
  };
}

/** The page's address with some of its settings changed. Defaults are left out, so addresses stay short. */
export function globalHref(base: string, query: GlobalQuery, change: Partial<Pick<GlobalQuery, "country" | "view" | "sort" | "direction">> & { period?: ReportPeriod } = {}): string {
  const next = { ...query, ...change };
  const params = new URLSearchParams();
  params.set("from", next.period.from);
  params.set("to", next.period.to);
  if (next.country) params.set("country", next.country);
  if (next.view === "local") params.set("view", "local");
  if (next.sort !== "rank") params.set("sort", next.sort);
  if (next.sort !== "rank" || next.direction !== "asc") params.set("dir", next.direction);
  return `${base}?${params.toString()}`;
}

export const usd = (cents: number): string => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "$1.76M", "$824.5K", "$950": for chart axes and labels. */
export function usdShort(cents: number): string {
  const dollars = cents / 100;
  if (Math.abs(dollars) >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M`;
  if (Math.abs(dollars) >= 1_000) return `$${(dollars / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return `$${Math.round(dollars).toLocaleString("en-US")}`;
}

/** "+8.4%" or "−3.0%"; the sign is in the text, never only in the colour. */
export function signedPercent(value: number): string {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}%`;
}
