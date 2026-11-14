import type { CustomerOrderQuery } from "@tronic/database";

/**
 * Turns the order list's URL parameters into a database query. Everything
 * is validated here on the server: an unknown tab, sort or date is dropped,
 * never passed through. The query still only ever reads the signed-in
 * customer's own orders (Row Level Security).
 */
export type SearchParams = Record<string, string | string[] | undefined>;

export interface OrderFilters {
  tab: string;
  q: string;
  sort: "newest" | "oldest";
  from: string;
  to: string;
  page: number;
}

/** Which order statuses each tab of the list covers. */
export const TAB_STATUSES: Record<string, readonly string[]> = {
  all: [],
  pending: ["pending_payment"],
  processing: ["confirmed", "processing", "packed"],
  shipped: ["dispatched", "in_transit"],
  delivered: ["delivered"],
  cancelled: ["cancelled"],
};

/** Tanzania, Kenya and Uganda are all on East Africa Time (UTC+3, no daylight saving). */
const EAT_OFFSET = "+03:00";
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function validDay(value: string): string {
  if (!DAY.test(value)) return "";
  const date = new Date(`${value}T12:00:00Z`);
  // Rejects impossible dates such as 2026-02-31, which Date would roll over.
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : "";
}

function nextDay(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function parseOrderFilters(searchParams: SearchParams): OrderFilters {
  const tabRaw = first(searchParams.status);
  const tab = Object.hasOwn(TAB_STATUSES, tabRaw) ? tabRaw : "all";
  const q = first(searchParams.q).replace(/[^A-Za-z0-9-]/g, "").slice(0, 40);
  const sort = first(searchParams.sort) === "oldest" ? "oldest" : "newest";
  let from = validDay(first(searchParams.from));
  let to = validDay(first(searchParams.to));
  // A reversed range is read the way it was meant.
  if (from && to && from > to) [from, to] = [to, from];
  const pageRaw = Number.parseInt(first(searchParams.page), 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.min(pageRaw, 10_000) : 1;
  return { tab, q, sort, from, to, page };
}

export function toOrderQuery(filters: OrderFilters, pageSize?: number): CustomerOrderQuery {
  return {
    statuses: TAB_STATUSES[filters.tab] ?? [],
    search: filters.q,
    sort: filters.sort,
    from: filters.from ? `${filters.from}T00:00:00${EAT_OFFSET}` : undefined,
    // "To" is inclusive for the customer: up to the end of that day.
    to: filters.to ? `${nextDay(filters.to)}T00:00:00${EAT_OFFSET}` : undefined,
    page: filters.page,
    pageSize,
  };
}

/** The filters as URL parameters, without the page (for pagination and links). */
export function filterParams(filters: OrderFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.tab !== "all") params.set("status", filters.tab);
  if (filters.q) params.set("q", filters.q);
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return params;
}
