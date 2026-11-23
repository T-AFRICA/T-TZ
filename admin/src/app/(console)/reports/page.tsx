import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  BanknoteIcon,
  ChartIcon,
  CheckCircleIcon,
  CreditCardIcon,
  GlobeIcon,
  ShoppingBagIcon,
  TrendingUpIcon,
  UsersIcon,
  type IconProps,
} from "@tronic/ui";
import { CountryFlag } from "@/components/flag";
import { CountryColumns, Donut, LineChart, Sparkline, StackedBars } from "@/components/global-charts";
import { ExchangeRateForm } from "@/components/global-reports";
import { RankedBars, TableView } from "@/components/report-charts";
import { Cell, DataTable, EmptyRow, Notice, PageHeader, Panel, StatusPill, buttonClass, inputClass, type Tone } from "@/components/ui";
import { sortRows, type CountryRow, type SortKey } from "@/features/global-reports/combine";
import { loadGlobalReport } from "@/features/global-reports/load";
import { globalHref, readGlobalQuery, signedPercent, usd, usdShort, type GlobalQuery } from "@/features/global-reports/query";
import { COUNTRY_STATUS_LABEL, COUNTRY_STATUS_TONE, SERVICE_UNAVAILABLE_TEXT, formatDateTime } from "@/features/labels";
import { formatMinor } from "@/features/orders/labels";
import { REPORT_PRESETS, formatPeriod, formatShortDay, periodDays, shiftDay, todayIn } from "@/features/reports/period";
import { requireMaster } from "@/server/session";

export const metadata: Metadata = { title: "Global Combined Reports" };

const BASE = "/reports";
const count = (value: number) => value.toLocaleString("en-US");

const chip = (current: boolean) =>
  `inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
    current ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-surface text-ink hover:bg-raised"
  }`;

/** A change against the period before: an arrow, a signed number and the words, so it never rests on colour. */
function Delta({ now, before }: { now: number; before: number | null }) {
  if (before === null) return <span className="text-xs text-muted">No earlier period to compare</span>;
  if (!(before > 0)) return <span className="text-xs text-muted">Nothing in the period before</span>;
  const change = ((now - before) / before) * 100;
  const up = change >= 0;
  return (
    <span className={`text-xs font-semibold ${up ? "text-ok" : "text-danger"}`}>
      <span aria-hidden="true">{up ? "▲" : "▼"} </span>
      {signedPercent(change)} <span className="font-normal text-muted">vs period before</span>
    </span>
  );
}

function Kpi({ icon: Icon, label, value, children }: { icon: (props: IconProps) => ReactNode; label: string; value: string; children?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-line bg-surface p-4 shadow-panel sm:p-5">
      <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-lg bg-accent-soft text-accent-ink">
        <Icon size={18} />
      </span>
      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="font-display text-2xl leading-tight tabular-nums text-ink [overflow-wrap:anywhere] sm:text-[1.7rem]">{value}</p>
      <div className="min-h-4">{children}</div>
    </div>
  );
}

const STOCK_PILL: Record<"ok" | "low" | "out" | "unknown", { tone: Tone; label: string }> = {
  ok: { tone: "ok", label: "In stock" },
  low: { tone: "warn", label: "Low" },
  out: { tone: "danger", label: "Out of stock" },
  unknown: { tone: "neutral", label: "Not known" },
};

const INSIGHT_TONE: Record<"ok" | "warn" | "info" | "danger", Tone> = { ok: "ok", warn: "warn", info: "info", danger: "danger" };

/**
 * Every country's figures in one place, for a Master Super Admin: orders,
 * paid sales, customers, products and categories, each asked from the
 * country's own backend when the page is opened and added up here.
 *
 * Money is added up in US dollars at the rates the Master Super Admin
 * typed at the bottom of this page (owner decision 2026-11-23); a country
 * without a rate keeps its own currency and is left out of the dollar
 * totals. A country that is not connected is listed as such, never with a
 * made-up figure. A sale is a paid order.
 */
export default async function GlobalReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const admin = await requireMaster("global reports");
  const today = todayIn(null);
  const asked = readGlobalQuery(await searchParams, today);
  // A country in the address is a request: only one of the administrator's own is used.
  const only = asked.country && admin.countries.some((country) => country.id === asked.country) ? asked.country : null;
  const query: GlobalQuery = { ...asked, country: only };
  const { period, view } = query;
  const report = await loadGlobalReport(admin, period, only);
  const { totals } = report;
  const local = view === "local";

  const order = new Map(admin.countries.map((country, index) => [country.id, index]));
  const series = (id: string) => order.get(id) ?? 99;
  const connected = report.rows.filter((row) => row.connected);
  const inDollars = connected.filter((row) => row.salesUsdCents !== null);
  const rows = sortRows(report.rows, query.sort, query.direction);

  /** A country's money: dollars when it has a rate and dollars are shown, else its own currency. */
  const money = (row: CountryRow, minor: number | null, cents: number | null): string => {
    if (minor === null || !row.currency) return "—";
    if (!local && cents !== null) return usd(cents);
    return formatMinor(minor, row.currency, row.exponent);
  };
  const best = inDollars.find((row) => row.rank === 1 && (row.salesUsdCents ?? 0) > 0);
  const grower = connected.filter((row) => row.growth !== null && row.growth > 0).sort((a, b) => (b.growth ?? 0) - (a.growth ?? 0))[0];
  const days = periodDays(period);

  const sortHead = (key: SortKey, label: string) => {
    const current = query.sort === key;
    const next = current && query.direction === "desc" ? "asc" : current && query.direction === "asc" ? "desc" : key === "name" || key === "rank" ? "asc" : "desc";
    return (
      <th key={key} scope="col" aria-sort={current ? (query.direction === "asc" ? "ascending" : "descending") : undefined} className="whitespace-nowrap px-3 py-3">
        <Link href={`${globalHref(BASE, query, { sort: key, direction: next })}#countries`} className={`inline-flex items-center gap-1 hover:text-ink ${current ? "text-ink" : ""}`}>
          {label}
          <span aria-hidden="true">{current ? (query.direction === "asc" ? "↑" : "↓") : "↕"}</span>
        </Link>
      </th>
    );
  };

  return (
    <>
      <PageHeader
        eyebrow="Master Super Admin"
        title="Global Combined Reports"
        description="Consolidated orders, paid sales, country performance and business insights across all TRONIC markets."
        actions={
          <>
            <span className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-muted">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-ok" />
              Read live at {formatDateTime(report.readAt)}
            </span>
            <a href={`${globalHref(`${BASE}/export`, query)}`} className={buttonClass.secondary}>
              Export CSV
            </a>
          </>
        }
      />

      <section aria-label="Filters" className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4 shadow-panel">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">Period</span>
            {REPORT_PRESETS.map((preset) => (
              <Link
                key={preset}
                href={globalHref(BASE, query, { period: { from: shiftDay(today, -(preset - 1)), to: today } })}
                aria-current={query.preset === preset ? "true" : undefined}
                className={chip(query.preset === preset)}
              >
                {preset === 365 ? "12 months" : `${preset} days`}
              </Link>
            ))}
          </div>
          <div role="group" aria-label="Currency view" className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">Currency</span>
            <Link href={globalHref(BASE, query, { view: "usd" })} aria-current={!local ? "true" : undefined} className={chip(!local)}>
              USD (unified)
            </Link>
            <Link href={globalHref(BASE, query, { view: "local" })} aria-current={local ? "true" : undefined} className={chip(local)}>
              Local
            </Link>
          </div>
        </div>
        <form method="get" action={BASE} className="grid grid-cols-2 items-end gap-2 sm:flex sm:flex-wrap">
          {local ? <input type="hidden" name="view" value="local" /> : null}
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            From
            <input type="date" name="from" required defaultValue={period.from} max={today} className={`${inputClass} py-2`} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            To
            <input type="date" name="to" required defaultValue={period.to} max={today} className={`${inputClass} py-2`} />
          </label>
          <label className="col-span-2 flex flex-col gap-1 text-xs font-medium text-muted sm:col-span-1">
            Country
            <select name="country" defaultValue={only ?? ""} className={`${inputClass} py-2 sm:min-w-44`}>
              <option value="">All countries</option>
              {report.countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={`${buttonClass.secondary} col-span-2 sm:col-span-1`}>
            Show
          </button>
        </form>
        <p className="text-xs text-muted">
          {formatPeriod(period)} ({days} {days === 1 ? "day" : "days"}), each country&apos;s own calendar days. A sale is a paid order; Cash on Delivery is paid once delivered.
        </p>
      </section>

      {query.problem ? (
        <Notice tone="warn" title="That period cannot be shown">
          {query.problem}
        </Notice>
      ) : null}
      {connected.length === 0 ? (
        <Notice tone="warn" title="No country could be read">
          None of the countries answered, so there are no figures to add up. Each country and the reason are in the table below.
        </Notice>
      ) : null}
      {totals.withoutRate.length > 0 ? (
        <Notice tone="warn" title="Some sales are not in the dollar totals">
          {totals.withoutRate.join(", ")}: no US dollar rate has been set, so {totals.withoutRate.length === 1 ? "its" : "their"} sales are shown in local currency only.{" "}
          <a href="#rates" className="font-semibold underline">
            Set the rate
          </a>
          .
        </Notice>
      ) : null}

      <section aria-label="Summary" className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Kpi icon={ShoppingBagIcon} label="Total orders" value={count(totals.orders)}>
          <Delta now={totals.orders} before={totals.previousOrders} />
        </Kpi>
        <Kpi icon={BanknoteIcon} label="Paid sales" value={inDollars.length > 0 ? usd(totals.salesUsdCents) : "—"}>
          {inDollars.length > 0 ? <Delta now={totals.salesUsdCents} before={totals.previousSalesUsdCents} /> : <span className="text-xs text-muted">Needs a US dollar rate</span>}
        </Kpi>
        <Kpi icon={CheckCircleIcon} label="Paid orders" value={count(totals.paidOrders)}>
          <Delta now={totals.paidOrders} before={totals.previousPaidOrders} />
        </Kpi>
        <Kpi icon={CreditCardIcon} label="Avg. order value" value={totals.averageUsdCents !== null ? usd(totals.averageUsdCents) : "—"}>
          {totals.averageUsdCents !== null ? <Delta now={totals.averageUsdCents} before={totals.previousAverageUsdCents} /> : <span className="text-xs text-muted">No paid order in dollars yet</span>}
        </Kpi>
        <Kpi icon={UsersIcon} label="Customer accounts" value={totals.customers !== null ? count(totals.customers) : "—"}>
          <span className="text-xs text-muted">All time, not only this period</span>
        </Kpi>
        <Kpi icon={GlobeIcon} label="Active countries" value={count(totals.active)}>
          <span className="text-xs text-muted">
            {totals.connected} of {totals.countries} answered
          </span>
        </Kpi>
        <Kpi icon={ChartIcon} label="Top country" value={best ? best.name : "—"}>
          <span className="text-xs text-muted">{best ? `${usd(best.salesUsdCents ?? 0)}${best.contribution !== null ? ` (${best.contribution.toFixed(1)}%)` : ""}` : "No paid sales in dollars"}</span>
        </Kpi>
        <Kpi icon={TrendingUpIcon} label="Best growth" value={grower ? grower.name : "—"}>
          <span className={`text-xs ${grower ? "font-semibold text-ok" : "text-muted"}`}>{grower ? `▲ ${signedPercent(grower.growth ?? 0)} paid sales` : "No country grew on the period before"}</span>
        </Kpi>
      </section>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <Panel title="Sales by country" description="Paid sales in US dollars, at the rates set below.">
          {inDollars.some((row) => (row.salesUsdCents ?? 0) > 0) ? (
            <CountryColumns
              label="Paid sales by country, in US dollars"
              formatTick={usdShort}
              items={inDollars.map((row) => ({ key: row.id, label: row.name, series: series(row.id), value: row.salesUsdCents ?? 0, display: usdShort(row.salesUsdCents ?? 0) }))}
            />
          ) : (
            <EmptyRow title="No paid sales in dollars for this period" description="A country appears here once it has paid orders and a US dollar rate." />
          )}
        </Panel>

        <Panel title="Orders trend" description={`Orders placed per day, all countries together (${formatPeriod(period)}).`}>
          {report.trend.some((point) => point.orders > 0) ? (
            <>
              <LineChart
                label="Orders placed per day"
                formatTick={(value) => count(Math.round(value))}
                points={report.trend.map((point) => ({
                  key: point.day,
                  label: formatShortDay(point.day),
                  value: point.orders,
                  tip: `${formatShortDay(point.day)}: ${count(point.orders)} ${point.orders === 1 ? "order" : "orders"}`,
                }))}
              />
              <TableView>
                <DataTable caption="Orders placed per day" head={["Day", "Orders"]}>
                  {report.trend.map((point) => (
                    <tr key={point.day}>
                      <Cell>{formatShortDay(point.day)}</Cell>
                      <Cell className="tabular-nums">{count(point.orders)}</Cell>
                    </tr>
                  ))}
                </DataTable>
              </TableView>
            </>
          ) : (
            <EmptyRow title="No orders in this period" />
          )}
        </Panel>

        <Panel title="Revenue share by country" description="Each country's part of the paid sales in US dollars.">
          {totals.salesUsdCents > 0 ? (
            <Donut
              label="Share of paid sales by country"
              centre={usdShort(totals.salesUsdCents)}
              centreLabel="Paid sales"
              parts={inDollars.map((row) => ({ key: row.id, label: row.name, series: series(row.id), value: row.salesUsdCents ?? 0, display: usd(row.salesUsdCents ?? 0) }))}
            />
          ) : (
            <EmptyRow title="Nothing to share out yet" description="There are no paid sales in dollars for this period." />
          )}
        </Panel>

        <Panel title="Order status by country" description="Orders placed in the period, by where they stand now.">
          {connected.some((row) => row.orders > 0) ? (
            <StackedBars
              label="Orders by status and country"
              segments={["Delivered", "In progress", "Cancelled"]}
              rows={connected.map((row) => ({ key: row.id, label: row.name, values: [row.delivered ?? 0, row.pending, row.cancelled] }))}
            />
          ) : (
            <EmptyRow title="No orders in this period" />
          )}
        </Panel>
      </div>

      <Panel
        id="countries"
        title="Country performance"
        description={local ? "Money in each country's own currency. Click a heading to sort." : "Money in US dollars where a rate is set, otherwise in the country's own currency. Click a heading to sort."}
        flush
      >
        <div className="table-scroll">
          <table className="w-full min-w-[60rem] border-collapse text-left text-sm">
            <caption className="sr-only">Country performance, combined</caption>
            <thead>
              <tr className="border-b border-line bg-raised text-[11px] font-semibold uppercase text-muted">
                {sortHead("rank", "#")}
                {sortHead("name", "Country")}
                <th scope="col" className="px-3 py-3">
                  Currency
                </th>
                {sortHead("orders", "Orders")}
                {sortHead("sales", "Paid sales")}
                {sortHead("customers", "Customers")}
                {sortHead("average", "Avg. order")}
                {sortHead("delivered", "Delivered")}
                {sortHead("pending", "In progress")}
                {sortHead("cancelled", "Cancelled")}
                {sortHead("growth", "Growth")}
                {sortHead("contribution", "Contribution")}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-raised/60">
                  <td className="px-3 py-3.5 tabular-nums text-muted">{row.rank ?? "—"}</td>
                  <td className="px-3 py-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <CountryFlag isoCode={row.isoCode} size="sm" />
                      {row.connected ? (
                        <Link href={`/c/${row.id}/reports?from=${period.from}&to=${period.to}`} className="font-semibold text-ink underline-offset-2 hover:underline">
                          {row.name}
                        </Link>
                      ) : (
                        <span className="font-semibold text-ink">{row.name}</span>
                      )}
                      <StatusPill tone={COUNTRY_STATUS_TONE[row.status as keyof typeof COUNTRY_STATUS_TONE] ?? "neutral"}>
                        {COUNTRY_STATUS_LABEL[row.status as keyof typeof COUNTRY_STATUS_LABEL] ?? row.status}
                      </StatusPill>
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-muted">{row.currency ?? "Not set"}</td>
                  {row.connected ? (
                    <>
                      <td className="px-3 py-3.5 tabular-nums">{count(row.orders)}</td>
                      <td className="px-3 py-3.5 font-semibold tabular-nums">
                        {money(row, row.salesMinor, row.salesUsdCents)}
                        {!local && row.salesUsdCents === null ? <span className="ml-1.5 text-xs font-normal text-warn">no rate</span> : null}
                      </td>
                      <td className="px-3 py-3.5 tabular-nums">{row.customers !== null ? count(row.customers) : "—"}</td>
                      <td className="px-3 py-3.5 tabular-nums">{money(row, row.averageMinor, row.averageUsdCents)}</td>
                      <td className="px-3 py-3.5 tabular-nums">{row.delivered !== null ? count(row.delivered) : "—"}</td>
                      <td className="px-3 py-3.5 tabular-nums">{count(row.pending)}</td>
                      <td className="px-3 py-3.5 tabular-nums">{count(row.cancelled)}</td>
                      <td className="px-3 py-3.5 tabular-nums">
                        {row.growth === null ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <span className={`font-semibold ${row.growth >= 0 ? "text-ok" : "text-danger"}`}>
                            <span aria-hidden="true">{row.growth >= 0 ? "▲" : "▼"} </span>
                            {signedPercent(row.growth)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3.5">
                        {row.contribution === null ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span aria-hidden="true" className="h-2 w-12 overflow-hidden rounded-full bg-raised ring-1 ring-inset ring-line">
                              <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.min(100, row.contribution)}%` }} />
                            </span>
                            <span className="tabular-nums">{row.contribution.toFixed(1)}%</span>
                          </div>
                        )}
                      </td>
                    </>
                  ) : (
                    <td colSpan={9} className="px-3 py-3.5 text-sm text-muted">
                      No figures: {row.unavailable ? SERVICE_UNAVAILABLE_TEXT[row.unavailable] : "the country did not answer."}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-line-strong bg-accent-soft font-semibold text-ink">
                <td className="px-3 py-3.5" />
                <td className="px-3 py-3.5">
                  Total ({totals.connected} of {totals.countries} {totals.countries === 1 ? "country" : "countries"})
                </td>
                <td className="px-3 py-3.5 text-muted">{local ? "—" : "USD"}</td>
                <td className="px-3 py-3.5 tabular-nums">{count(totals.orders)}</td>
                <td className="px-3 py-3.5 tabular-nums">{local ? "—" : inDollars.length > 0 ? usd(totals.salesUsdCents) : "—"}</td>
                <td className="px-3 py-3.5 tabular-nums">{totals.customers !== null ? count(totals.customers) : "—"}</td>
                <td className="px-3 py-3.5 tabular-nums">{local || totals.averageUsdCents === null ? "—" : usd(totals.averageUsdCents)}</td>
                <td className="px-3 py-3.5 tabular-nums">{count(totals.delivered)}</td>
                <td className="px-3 py-3.5 tabular-nums">{count(totals.pending)}</td>
                <td className="px-3 py-3.5 tabular-nums">{count(totals.cancelled)}</td>
                <td className="px-3 py-3.5 tabular-nums">
                  {totals.previousSalesUsdCents !== null && totals.previousSalesUsdCents > 0 ? signedPercent(((totals.salesUsdCents - totals.previousSalesUsdCents) / totals.previousSalesUsdCents) * 100) : "—"}
                </td>
                <td className="px-3 py-3.5 tabular-nums">{totals.salesUsdCents > 0 ? "100%" : "—"}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {local ? <p className="border-t border-line px-5 py-3 text-xs text-muted">Money totals need one currency: switch to USD (unified) to see them.</p> : null}
      </Panel>

      <section aria-labelledby="highlights">
        <h2 id="highlights" className="text-base font-semibold text-ink">
          Country highlights
        </h2>
        <p className="mt-0.5 text-sm text-muted">Each country at a glance, in its own figures.</p>
        <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {report.rows.map((row) => (
            <li key={row.id} className="flex min-w-0 flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-panel">
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex min-w-0 items-center gap-2 text-base font-bold text-ink">
                  <CountryFlag isoCode={row.isoCode} />
                  <span className="min-w-0 truncate">{row.name}</span>
                </h3>
                <StatusPill tone={COUNTRY_STATUS_TONE[row.status as keyof typeof COUNTRY_STATUS_TONE] ?? "neutral"}>
                  {COUNTRY_STATUS_LABEL[row.status as keyof typeof COUNTRY_STATUS_LABEL] ?? row.status}
                </StatusPill>
              </div>
              {row.connected ? (
                <>
                  <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-2 gap-y-1 text-sm">
                    <dt className="order-2 text-muted">orders</dt>
                    <dd className="order-1 font-bold tabular-nums text-ink">{count(row.orders)}</dd>
                    <dt className="order-4 text-muted">paid sales</dt>
                    <dd className="order-3 font-bold tabular-nums text-ink">{money(row, row.salesMinor, row.salesUsdCents)}</dd>
                  </dl>
                  <p className="text-xs">
                    {row.growth === null ? (
                      <span className="text-muted">No sales in the period before</span>
                    ) : (
                      <span className={`font-semibold ${row.growth >= 0 ? "text-ok" : "text-danger"}`}>
                        <span aria-hidden="true">{row.growth >= 0 ? "▲" : "▼"} </span>
                        {signedPercent(row.growth)} <span className="font-normal text-muted">vs period before</span>
                      </span>
                    )}
                  </p>
                  <Sparkline values={row.salesByDay} label={`${row.name}: paid sales per day`} />
                  <dl className="flex flex-col gap-1 text-xs">
                    <div className="flex gap-1.5">
                      <dt className="shrink-0 font-semibold text-ink">Top category:</dt>
                      <dd className="min-w-0 truncate text-muted">{row.topCategory ?? "None sold"}</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="shrink-0 font-semibold text-ink">Best product:</dt>
                      <dd className="min-w-0 truncate text-muted">{row.topProduct ?? "None sold"}</dd>
                    </div>
                  </dl>
                  <Link href={`/c/${row.id}/reports?from=${period.from}&to=${period.to}`} className={`${buttonClass.secondary} mt-auto`} aria-label={`View details for ${row.name}`}>
                    View details
                  </Link>
                </>
              ) : (
                <p className="text-sm text-muted">{row.unavailable ? SERVICE_UNAVAILABLE_TEXT[row.unavailable] : "The country did not answer."}</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[3fr_2fr]">
        <Panel title="Best-selling products" description="Across all countries, joined by SKU. Paid orders only." flush>
          {report.products.length === 0 ? (
            <EmptyRow title="Nothing sold in this period" description="Products appear here once an order that contains them is paid." />
          ) : (
            <DataTable caption="Best-selling products across all countries" head={["#", "Product", "SKU", "Units sold", "Revenue (USD)", "Top country", "Stock"]}>
              {report.products.slice(0, 10).map((product, index) => (
                <tr key={product.sku}>
                  <Cell className="tabular-nums text-muted">{index + 1}</Cell>
                  <Cell className="font-medium text-ink">{product.name}</Cell>
                  <Cell className="text-muted">{product.sku}</Cell>
                  <Cell className="tabular-nums">{count(product.units)}</Cell>
                  <Cell className="font-semibold tabular-nums">{product.usdCents > 0 ? usd(product.usdCents) : "—"}</Cell>
                  <Cell>{product.topCountry}</Cell>
                  <Cell>
                    <span title={product.stockWhere.length > 0 ? `In ${product.stockWhere.join(", ")}` : undefined}>
                      <StatusPill tone={STOCK_PILL[product.stock].tone}>{STOCK_PILL[product.stock].label}</StatusPill>
                    </span>
                    {product.stockWhere.length > 0 ? <span className="mt-1 block text-xs text-muted">{product.stockWhere.join(", ")}</span> : null}
                  </Cell>
                </tr>
              ))}
            </DataTable>
          )}
        </Panel>

        <Panel title="Category performance" description="Paid sales by category, all countries, in US dollars.">
          {report.categories.some((category) => category.usdCents > 0) ? (
            <RankedBars
              label="Paid sales by category"
              rows={report.categories
                .filter((category) => category.usdCents > 0)
                .map((category) => ({
                  key: category.slug,
                  label: category.name,
                  value: category.usdCents,
                  display: `${usd(category.usdCents)} (${((category.usdCents / Math.max(totals.salesUsdCents, 1)) * 100).toFixed(1)}%)`,
                  sub: `${count(category.units)} ${category.units === 1 ? "unit" : "units"}${category.byCountry.length > 1 ? ` · ${category.byCountry.map((part) => `${part.country} ${usdShort(part.usdCents)}`).join(", ")}` : ""}`,
                  tip: `${category.name}: ${category.byCountry.map((part) => `${part.country} ${usd(part.usdCents)}`).join(", ")}`,
                }))}
            />
          ) : (
            <EmptyRow title="No category sales in dollars" description="Categories appear here once products are sold in a country with a US dollar rate." />
          )}
        </Panel>
      </div>

      <Panel title="Executive insights" description="Worked out from the figures above for this period. Facts, not a forecast.">
        {report.insights.length === 0 ? (
          <EmptyRow title="Nothing to point out yet" description="Insights appear once there are paid sales to compare." />
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {report.insights.map((insight) => (
              <li key={insight.key} className="flex items-start gap-3 rounded-lg border border-line bg-raised px-4 py-3">
                <StatusPill tone={INSIGHT_TONE[insight.tone]}>{insight.label}</StatusPill>
                <p className="min-w-0 text-sm text-ink">{insight.text}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        id="rates"
        title="US dollar rates"
        description="How many units of each country's currency one US dollar is. You type them; no rate service is used. Every change is in the audit log. For reports only: nothing is priced or charged with them."
      >
        <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {report.countries.map((country) => (
            <li key={country.id} className="flex flex-col gap-2 rounded-lg border border-line p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <CountryFlag isoCode={country.isoCode} size="sm" />
                {country.name}
              </p>
              {country.currency ? (
                <>
                  <ExchangeRateForm countryId={country.id} countryName={country.name} currency={country.currency} current={country.rate ? String(country.rate.unitsPerUsd) : null} />
                  <p className="text-xs text-muted">
                    {country.rate
                      ? `1 USD = ${country.rate.unitsPerUsd.toLocaleString("en-GB", { maximumFractionDigits: 6 })} ${country.currency}, set ${formatDateTime(country.rate.setAt)}`
                      : "No rate yet: this country is left out of the dollar totals."}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted">No currency is set for this country yet. Set it under Countries first.</p>
              )}
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
