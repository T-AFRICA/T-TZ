import type { CountryUnavailableReason, OrdersReport, ProductsReport, SalesReport, StockReport } from "@tronic/api-contracts";

/**
 * The Global Combined Reports: every country's own figures, added up.
 *
 * Counts (orders, customers, units) add up as they are. Money does not:
 * each country reports in its own currency, so an amount joins a US dollar
 * total only through the rate the Master Super Admin typed for that country
 * (admin migration 0008). A country without a rate keeps its own currency
 * and is left out of the dollar totals; the page says so. Dollar figures
 * are for reading, rounded to the cent: nothing is charged or stored in
 * them. Growth compares a country with itself in its own currency, so it
 * needs no rate.
 *
 * Pure functions: the loader (load.ts) fetches, this file only counts.
 */

export interface CountryRate {
  /** Units of the country's currency for one US dollar. */
  unitsPerUsd: number;
  setAt: string;
}

/** What one country answered for the period. Null parts could not be read. */
export interface CountryData {
  sales: SalesReport;
  /** The same number of days just before the period, for growth. */
  previous: SalesReport | null;
  orders: OrdersReport | null;
  products: ProductsReport | null;
  stock: StockReport | null;
  /** Customer accounts, all time. */
  customers: number | null;
}

export interface CountryInput {
  id: string;
  name: string;
  isoCode: string | null;
  status: string;
  /** The currency in the Central Admin's own record of the country. */
  currency: string | null;
  rate: CountryRate | null;
  data: CountryData | null;
  /** Why the country has no figures, when it has none. */
  unavailable: CountryUnavailableReason | null;
}

export interface CountryRow {
  id: string;
  name: string;
  isoCode: string | null;
  status: string;
  currency: string | null;
  exponent: number;
  connected: boolean;
  unavailable: CountryUnavailableReason | null;
  rate: CountryRate | null;
  /** Orders placed in the period. */
  orders: number;
  paidOrders: number;
  salesMinor: number;
  /** Null without a rate. */
  salesUsdCents: number | null;
  customers: number | null;
  /** Average paid order, in the country's currency (minor units); null with no paid order. */
  averageMinor: number | null;
  averageUsdCents: number | null;
  delivered: number | null;
  /** Placed and neither delivered nor cancelled. */
  pending: number;
  cancelled: number;
  /** Paid sales against the period before, in percent; null when there is nothing to compare with. */
  growth: number | null;
  /** Share of the dollar total, in percent; null without a rate or without sales anywhere. */
  contribution: number | null;
  /** 1 for the largest dollar sales; null without a rate. */
  rank: number | null;
  /** Paid sales per day, in the country's currency, for the sparkline. */
  salesByDay: number[];
  topCategory: string | null;
  topProduct: string | null;
}

export interface Totals {
  countries: number;
  connected: number;
  active: number;
  orders: number;
  previousOrders: number | null;
  paidOrders: number;
  previousPaidOrders: number | null;
  customers: number | null;
  delivered: number;
  pending: number;
  cancelled: number;
  salesUsdCents: number;
  previousSalesUsdCents: number | null;
  averageUsdCents: number | null;
  previousAverageUsdCents: number | null;
  /** Connected countries whose money is not in the dollar totals. */
  withoutRate: string[];
}

export interface CombinedProduct {
  sku: string;
  name: string;
  units: number;
  /** Dollar revenue from the countries that have a rate. */
  usdCents: number;
  /** The country that sold the most units of it. */
  topCountry: string;
  /** Where it is out of stock or low, among the countries that sell it. */
  stock: "ok" | "low" | "out" | "unknown";
  stockWhere: string[];
}

export interface CombinedCategory {
  slug: string;
  name: string;
  units: number;
  usdCents: number;
  /** Dollar sales per country, largest first, for the hover text. */
  byCountry: { country: string; usdCents: number }[];
}

export interface TrendPoint {
  day: string;
  orders: number;
}

export interface Insight {
  key: string;
  label: string;
  text: string;
  tone: "ok" | "warn" | "info" | "danger";
}

export interface Combined {
  rows: CountryRow[];
  totals: Totals;
  products: CombinedProduct[];
  categories: CombinedCategory[];
  trend: TrendPoint[];
  insights: Insight[];
}

/** An amount in a country's minor units as US cents at that country's rate, rounded to the cent. */
export function toUsdCents(minor: number, exponent: number, unitsPerUsd: number): number {
  if (!(unitsPerUsd > 0) || !Number.isFinite(minor)) return 0;
  return Math.round((minor / 10 ** exponent / unitsPerUsd) * 100);
}

/** Change from `before` to `now` in percent; null when there was nothing before. */
export function growthPercent(now: number, before: number | null | undefined): number | null {
  if (before === null || before === undefined || !(before > 0)) return null;
  return ((now - before) / before) * 100;
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const top = <T,>(items: readonly T[], value: (item: T) => number): T | null =>
  items.reduce<T | null>((best, item) => (value(item) > 0 && (best === null || value(item) > value(best)) ? item : best), null);

/** The stock list of a country is cut at this many products: past it, a product that is not listed may still be short. */
export const STOCK_ATTENTION_LIMIT = 50;

function rowOf(input: CountryInput): CountryRow {
  const data = input.data;
  const base = {
    id: input.id,
    name: input.name,
    isoCode: input.isoCode,
    status: input.status,
    rate: input.rate,
    unavailable: input.unavailable,
  };
  if (!data) {
    return {
      ...base,
      currency: input.currency,
      exponent: 0,
      connected: false,
      orders: 0,
      paidOrders: 0,
      salesMinor: 0,
      salesUsdCents: null,
      customers: null,
      averageMinor: null,
      averageUsdCents: null,
      delivered: null,
      pending: 0,
      cancelled: 0,
      growth: null,
      contribution: null,
      rank: null,
      salesByDay: [],
      topCategory: null,
      topProduct: null,
    };
  }
  const { totals, currencyExponent: exponent } = data.sales;
  // A rate was typed for the currency in the Central Admin's record; it only applies if the country reports in that currency.
  const rate = input.rate && input.currency === data.sales.currency ? input.rate : null;
  const averageMinor = totals.paidOrders > 0 ? Math.round(totals.paidMinor / totals.paidOrders) : null;
  return {
    ...base,
    rate,
    currency: data.sales.currency,
    exponent,
    connected: true,
    orders: totals.placed,
    paidOrders: totals.paidOrders,
    salesMinor: totals.paidMinor,
    salesUsdCents: rate ? toUsdCents(totals.paidMinor, exponent, rate.unitsPerUsd) : null,
    customers: data.customers,
    averageMinor,
    averageUsdCents: rate && averageMinor !== null ? toUsdCents(averageMinor, exponent, rate.unitsPerUsd) : null,
    delivered: data.orders ? (data.orders.byStatus.delivered ?? 0) : null,
    pending: totals.open,
    cancelled: totals.cancelled,
    growth: growthPercent(totals.paidMinor, data.previous?.totals.paidMinor),
    contribution: null,
    rank: null,
    salesByDay: data.sales.days.map((day) => day.paidMinor),
    topCategory: top(data.products?.categories ?? [], (category) => category.amountMinor)?.name ?? null,
    topProduct: top(data.products?.products ?? [], (product) => product.amountMinor)?.name ?? null,
  };
}

function combineProducts(inputs: CountryInput[], rows: CountryRow[]): CombinedProduct[] {
  const bySku = new Map<string, { name: string; units: number; usdCents: number; perCountry: Map<string, number>; out: string[]; low: string[]; unknown: boolean }>();
  for (const input of inputs) {
    const row = rows.find((candidate) => candidate.id === input.id);
    const report = input.data?.products;
    if (!row || !report) continue;
    const stock = input.data?.stock ?? null;
    for (const product of report.products) {
      const key = product.sku.trim().toUpperCase();
      const entry = bySku.get(key) ?? { name: product.name, units: 0, usdCents: 0, perCountry: new Map<string, number>(), out: [], low: [], unknown: false };
      entry.units += product.units;
      if (row.rate) entry.usdCents += toUsdCents(product.amountMinor, row.exponent, row.rate.unitsPerUsd);
      entry.perCountry.set(input.name, (entry.perCountry.get(input.name) ?? 0) + product.units);
      const listed = stock?.attention.find((item) => item.slug === product.slug);
      if (listed) (listed.available === 0 ? entry.out : entry.low).push(input.name);
      else if (!stock || stock.attention.length >= STOCK_ATTENTION_LIMIT) entry.unknown = true;
      bySku.set(key, entry);
    }
  }
  return [...bySku.entries()]
    .map(([sku, entry]) => ({
      sku,
      name: entry.name,
      units: entry.units,
      usdCents: entry.usdCents,
      topCountry: [...entry.perCountry.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "",
      stock: entry.out.length > 0 ? ("out" as const) : entry.low.length > 0 ? ("low" as const) : entry.unknown ? ("unknown" as const) : ("ok" as const),
      stockWhere: entry.out.length > 0 ? entry.out : entry.low,
    }))
    .sort((a, b) => b.usdCents - a.usdCents || b.units - a.units || a.sku.localeCompare(b.sku));
}

function combineCategories(inputs: CountryInput[], rows: CountryRow[]): CombinedCategory[] {
  const bySlug = new Map<string, { name: string; units: number; usdCents: number; byCountry: { country: string; usdCents: number }[] }>();
  for (const input of inputs) {
    const row = rows.find((candidate) => candidate.id === input.id);
    const report = input.data?.products;
    if (!row || !report) continue;
    for (const category of report.categories) {
      const entry = bySlug.get(category.slug) ?? { name: category.name, units: 0, usdCents: 0, byCountry: [] };
      entry.units += category.units;
      if (row.rate) {
        const cents = toUsdCents(category.amountMinor, row.exponent, row.rate.unitsPerUsd);
        entry.usdCents += cents;
        if (cents > 0) entry.byCountry.push({ country: input.name, usdCents: cents });
      }
      bySlug.set(category.slug, entry);
    }
  }
  return [...bySlug.entries()]
    .map(([slug, entry]) => ({ slug, ...entry, byCountry: entry.byCountry.sort((a, b) => b.usdCents - a.usdCents) }))
    .sort((a, b) => b.usdCents - a.usdCents || b.units - a.units || a.name.localeCompare(b.name));
}

function combineTrend(inputs: CountryInput[]): TrendPoint[] {
  const byDay = new Map<string, number>();
  for (const input of inputs) for (const day of input.data?.sales.days ?? []) byDay.set(day.day, (byDay.get(day.day) ?? 0) + day.placed);
  return [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([day, orders]) => ({ day, orders }));
}

const usd = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = (percent: number) => `${percent >= 0 ? "+" : "−"}${Math.abs(percent).toFixed(1)}%`;

/** Sentences worked out from the figures, each one a fact the tables above show. No forecast. */
export function insightsOf(rows: CountryRow[], totals: Totals, products: CombinedProduct[], categories: CombinedCategory[]): Insight[] {
  const insights: Insight[] = [];
  const ranked = rows.filter((row) => row.salesUsdCents !== null).sort((a, b) => (b.salesUsdCents ?? 0) - (a.salesUsdCents ?? 0));
  const best = ranked[0];
  if (best && (best.salesUsdCents ?? 0) > 0) {
    insights.push({
      key: "highest",
      label: "Highest sales",
      text: `${best.name}: ${usd(best.salesUsdCents ?? 0)}${best.contribution !== null ? ` (${best.contribution.toFixed(1)}% of the total)` : ""}`,
      tone: "ok",
    });
  }
  const grower = top(
    rows.filter((row) => row.growth !== null && row.growth > 0),
    (row) => row.growth ?? 0,
  );
  if (grower) insights.push({ key: "growth", label: "Fastest growth", text: `${grower.name}: ${signed(grower.growth ?? 0)} on the period before`, tone: "ok" });
  const lowest = ranked.length > 1 ? ranked[ranked.length - 1] : undefined;
  if (lowest) insights.push({ key: "lowest", label: "Lowest sales", text: `${lowest.name}: ${usd(lowest.salesUsdCents ?? 0)}`, tone: "warn" });
  const falling = rows.filter((row) => row.growth !== null && row.growth < 0).sort((a, b) => (a.growth ?? 0) - (b.growth ?? 0))[0];
  if (falling) insights.push({ key: "falling", label: "Sales down", text: `${falling.name}: ${signed(falling.growth ?? 0)} on the period before`, tone: "danger" });
  const category = categories[0];
  if (category && category.usdCents > 0) {
    const share = totals.salesUsdCents > 0 ? ` (${((category.usdCents / totals.salesUsdCents) * 100).toFixed(1)}%)` : "";
    insights.push({ key: "category", label: "Best category", text: `${category.name}: ${usd(category.usdCents)}${share}`, tone: "info" });
  }
  const product = products[0];
  if (product && product.units > 0) {
    insights.push({ key: "product", label: "Top product", text: `${product.name}: ${product.units.toLocaleString("en-US")} units, ${usd(product.usdCents)}`, tone: "info" });
  }
  const short = products.slice(0, 10).find((item) => item.stock === "out" || item.stock === "low");
  if (short) {
    insights.push({
      key: "restock",
      label: "Needs attention",
      text: `${short.name} is a best seller and is ${short.stock === "out" ? "out of stock" : "low on stock"} in ${short.stockWhere.join(", ")}.`,
      tone: short.stock === "out" ? "danger" : "warn",
    });
  }
  if (totals.withoutRate.length > 0) {
    insights.push({
      key: "rate",
      label: "Not in the dollar totals",
      text: `${totals.withoutRate.join(", ")}: no US dollar rate has been set.`,
      tone: "warn",
    });
  }
  const cancelRate = totals.orders > 0 ? (totals.cancelled / totals.orders) * 100 : 0;
  if (totals.orders >= 10 && cancelRate >= 10) {
    insights.push({ key: "cancelled", label: "Cancellations", text: `${cancelRate.toFixed(1)}% of the orders placed in the period were cancelled.`, tone: "warn" });
  }
  return insights;
}

export function combine(inputs: CountryInput[]): Combined {
  const rows = inputs.map(rowOf);
  const connected = rows.filter((row) => row.connected);
  const withRate = connected.filter((row) => row.salesUsdCents !== null);
  const salesUsdCents = sum(withRate.map((row) => row.salesUsdCents ?? 0));

  [...withRate]
    .sort((a, b) => (b.salesUsdCents ?? 0) - (a.salesUsdCents ?? 0) || a.name.localeCompare(b.name))
    .forEach((row, index) => {
      row.rank = index + 1;
      row.contribution = salesUsdCents > 0 ? ((row.salesUsdCents ?? 0) / salesUsdCents) * 100 : null;
    });

  // The period before, counted only from the countries that answered for it, so a comparison never mixes two sets of countries.
  const compared = inputs.filter((input) => input.data?.previous);
  const comparedRows = rows.filter((row) => compared.some((input) => input.id === row.id));
  const previousSalesUsdCents = sum(
    compared.map((input) => {
      const row = rows.find((candidate) => candidate.id === input.id);
      return row?.rate && input.data?.previous ? toUsdCents(input.data.previous.totals.paidMinor, row.exponent, row.rate.unitsPerUsd) : 0;
    }),
  );
  const previousPaidOrders = sum(compared.map((input) => input.data?.previous?.totals.paidOrders ?? 0));
  const everyoneCompared = compared.length > 0 && comparedRows.length === connected.length;
  const paidOrdersWithRate = sum(withRate.map((row) => row.paidOrders));
  const previousPaidOrdersWithRate = sum(
    compared.filter((input) => rows.find((row) => row.id === input.id)?.rate).map((input) => input.data?.previous?.totals.paidOrders ?? 0),
  );
  const customers = connected.filter((row) => row.customers !== null);

  const totals: Totals = {
    countries: rows.length,
    connected: connected.length,
    active: rows.filter((row) => row.status === "active").length,
    orders: sum(connected.map((row) => row.orders)),
    previousOrders: everyoneCompared ? sum(compared.map((input) => input.data?.previous?.totals.placed ?? 0)) : null,
    paidOrders: sum(connected.map((row) => row.paidOrders)),
    previousPaidOrders: everyoneCompared ? previousPaidOrders : null,
    customers: customers.length > 0 ? sum(customers.map((row) => row.customers ?? 0)) : null,
    delivered: sum(connected.map((row) => row.delivered ?? 0)),
    pending: sum(connected.map((row) => row.pending)),
    cancelled: sum(connected.map((row) => row.cancelled)),
    salesUsdCents,
    previousSalesUsdCents: everyoneCompared ? previousSalesUsdCents : null,
    averageUsdCents: paidOrdersWithRate > 0 ? Math.round(salesUsdCents / paidOrdersWithRate) : null,
    previousAverageUsdCents: everyoneCompared && previousPaidOrdersWithRate > 0 ? Math.round(previousSalesUsdCents / previousPaidOrdersWithRate) : null,
    withoutRate: connected.filter((row) => row.salesUsdCents === null).map((row) => row.name),
  };

  const products = combineProducts(inputs, rows);
  const categories = combineCategories(inputs, rows);
  return { rows, totals, products, categories, trend: combineTrend(inputs), insights: insightsOf(rows, totals, products, categories) };
}

export const SORT_KEYS = ["rank", "name", "orders", "sales", "customers", "average", "delivered", "pending", "cancelled", "growth", "contribution"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

const SORT_VALUE: Record<Exclude<SortKey, "name">, (row: CountryRow) => number | null> = {
  rank: (row) => row.rank,
  orders: (row) => (row.connected ? row.orders : null),
  sales: (row) => row.salesUsdCents,
  customers: (row) => row.customers,
  average: (row) => row.averageUsdCents,
  delivered: (row) => row.delivered,
  pending: (row) => (row.connected ? row.pending : null),
  cancelled: (row) => (row.connected ? row.cancelled : null),
  growth: (row) => row.growth,
  contribution: (row) => row.contribution,
};

/** The rows in the order asked for. A country without the figure always comes last, whichever direction. */
export function sortRows(rows: CountryRow[], key: SortKey, direction: "asc" | "desc"): CountryRow[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === "name") return sign * a.name.localeCompare(b.name);
    const x = SORT_VALUE[key](a);
    const y = SORT_VALUE[key](b);
    if (x === null && y === null) return a.name.localeCompare(b.name);
    if (x === null) return 1;
    if (y === null) return -1;
    return sign * (x - y) || a.name.localeCompare(b.name);
  });
}
