import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangleIcon,
  BanknoteIcon,
  ChartIcon,
  CheckCircleIcon,
  CreditCardIcon,
  DownloadIcon,
  GlobeIcon,
  InfoIcon,
  ShoppingBagIcon,
  TrendingUpIcon,
  UsersIcon,
  type IconProps,
} from "@tronic/ui";
import { CountryFlag } from "@/components/flag";
import { CountryColumns, Donut, LineChart, Sparkline, StackedBars } from "@/components/global-charts";
import { CountryTable, ExchangeRateForm, FilterDrawer, RefreshLink, type CountryTableRow } from "@/components/global-reports";
import { RankedBars, TableView } from "@/components/report-charts";
import { Cell, DataTable, EmptyRow, Notice, Panel, StatusPill, buttonClass, type Tone } from "@/components/ui";
import { STATUS_GROUP_LABELS, sortRows, type CountryRow, type SortKey, type StatusGroups } from "@/features/global-reports/combine";
import { loadGlobalReport } from "@/features/global-reports/load";
import { globalHref, readGlobalQuery, signedPercent, usd, usdShort, type GlobalQuery } from "@/features/global-reports/query";
import { CONNECTION_LABEL, CONNECTION_TONE, FIGURE_STATE_LABEL, connectionOf, type FigureState } from "@/features/global-reports/states";
import { COUNTRY_STATUS_LABEL, COUNTRY_STATUS_TONE, SERVICE_UNAVAILABLE_TEXT, formatDateTime } from "@/features/labels";
import { formatMinor } from "@/features/orders/labels";
import { REPORT_DEFAULT_DAYS, REPORT_PRESETS, formatDay, formatPeriod, formatShortDay, periodDays, shiftDay, todayIn } from "@/features/reports/period";
import { requireMaster } from "@/server/session";

export const metadata: Metadata = { title: "Global Combined Reports" };

const BASE = "/reports";
const count = (value: number) => value.toLocaleString("en-US");

/** A row of choices where one is current: the quick periods, the currency view. Each choice is a link, so the choice is in the address. */
function Segmented({ label, items }: { label: string; items: { href: string; text: string; current: boolean }[] }) {
  return (
    <div role="group" aria-label={label} className="flex rounded-lg border border-line bg-raised p-0.5 md:inline-flex">
      {items.map((item) => (
        <Link
          key={item.text}
          href={item.href}
          prefetch={false}
          aria-current={item.current ? "true" : undefined}
          className={`flex min-h-9 flex-1 items-center justify-center whitespace-nowrap rounded-md px-1.5 text-[13px] transition-colors sm:px-3 sm:text-sm md:min-h-8 md:flex-none md:px-3.5 ${
            item.current ? "bg-surface font-semibold text-accent-ink shadow-sm ring-1 ring-line" : "font-medium text-muted hover:text-ink"
          }`}
        >
          {item.text}
        </Link>
      ))}
    </div>
  );
}

/** A change against the period before: an arrow, a signed number and the words, so it never rests on colour. */
function Delta({ now, before }: { now: number; before: number | null }) {
  if (before === null) return <>No earlier period to compare</>;
  if (!(before > 0)) return <>Nothing in the previous period</>;
  const change = ((now - before) / before) * 100;
  const up = change >= 0;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold tabular-nums ${up ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger"}`}>
        <span aria-hidden="true" className="text-[9px]">
          {up ? "▲" : "▼"}
        </span>
        {signedPercent(change)}
      </span>
      vs previous period
    </span>
  );
}

/**
 * One figure of the summary. A figure that has no number says why in words
 * (unavailable, not configured, no data) where the number would be; a zero
 * is a number and is shown as one.
 */
function Kpi({
  slug,
  icon: Icon,
  label,
  value,
  state = "unavailable",
  lead,
  children,
}: {
  slug: string;
  icon: (props: IconProps) => ReactNode;
  label: string;
  /** Null when there is no number to show; `state` then says why. */
  value: string | null;
  state?: FigureState;
  /** A small picture before the value (a flag). */
  lead?: ReactNode;
  children?: ReactNode;
}) {
  // A name (it comes with a flag) is cut with an ellipsis, never broken mid-word; a long amount steps down a size and may wrap.
  const size = value === null ? "" : lead ? "text-lg sm:text-xl xl:text-2xl" : value.length <= 9 ? "text-2xl" : value.length <= 12 ? "text-xl xl:text-2xl" : "text-lg xl:text-xl";
  return (
    <div data-kpi={slug} data-state={value === null ? state : "value"} className="flex min-w-0 flex-col rounded-xl border border-line bg-surface p-3.5 shadow-panel sm:p-4">
      {/* Two lines of label are as tall as the icon, so a label that wraps does not push its figure down. */}
      <div className="flex min-h-7 items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase leading-[0.875rem] tracking-[0.08em] text-muted">{label}</p>
        <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-ink">
          <Icon size={15} />
        </span>
      </div>
      {value !== null ? (
        <p className={`font-display mt-1.5 flex min-w-0 items-center gap-2 leading-tight tabular-nums text-ink ${size}`}>
          {lead}
          <span className={`min-w-0 ${lead ? "truncate" : "[overflow-wrap:anywhere]"}`} title={lead ? value : undefined}>
            {value}
          </span>
        </p>
      ) : (
        <p className="mt-1.5 text-lg font-semibold leading-tight text-muted">{FIGURE_STATE_LABEL[state]}</p>
      )}
      <div className="mt-1.5 text-xs leading-snug text-muted">{children}</div>
    </div>
  );
}

/** A line under a chart that says which countries are not in it, and why. */
function LeftOut({ unrated, offline }: { unrated: CountryRow[]; offline: CountryRow[] }) {
  if (unrated.length === 0 && offline.length === 0) return null;
  const parts = [
    unrated.length > 0 ? `${unrated.map((row) => row.name).join(", ")} (no US dollar rate)` : null,
    offline.length > 0 ? `${offline.map((row) => row.name).join(", ")} (no figures)` : null,
  ].filter(Boolean);
  return (
    <p className="mt-4 flex items-start gap-2 border-t border-line pt-3 text-xs text-muted">
      <InfoIcon size={14} className="mt-px shrink-0" />
      <span>Not in this chart: {parts.join("; ")}.</span>
    </p>
  );
}

const STOCK_PILL: Record<"ok" | "low" | "out" | "unknown", { tone: Tone; label: string }> = {
  ok: { tone: "ok", label: "In stock" },
  low: { tone: "warn", label: "Low" },
  out: { tone: "danger", label: "Out of stock" },
  unknown: { tone: "neutral", label: "Not known" },
};

const INSIGHT_EDGE: Record<"ok" | "warn" | "info" | "danger", string> = { ok: "border-l-ok", warn: "border-l-warn", info: "border-l-info", danger: "border-l-danger" };
const INSIGHT_INK: Record<"ok" | "warn" | "info" | "danger", string> = { ok: "text-ok", warn: "text-warn", info: "text-info", danger: "text-danger" };

/** The status chart's groups in the order an order moves through them, each with its colour (checked for colour blindness in both themes). */
const STATUS_GROUPS: { key: keyof StatusGroups; fill: string }[] = [
  { key: "awaiting", fill: "bg-chart-4" },
  { key: "inProgress", fill: "bg-chart-1" },
  { key: "delivered", fill: "bg-chart-3" },
  { key: "cancelled", fill: "bg-chart-2" },
];

const field = "flex min-h-9 min-w-0 items-center gap-2 rounded-lg border border-line-strong bg-surface pl-3 text-xs font-medium text-muted transition-colors hover:border-muted focus-within:border-ink";
const fieldInput = "min-w-0 flex-1 rounded-r-lg bg-transparent py-1.5 pr-2 text-sm text-ink";
const cell = "px-2.5 py-3";
const numeric = `${cell} whitespace-nowrap text-right tabular-nums`;

/**
 * Every country's figures in one place, for a Master Super Admin: orders,
 * paid sales, customers, products and categories, each asked from the
 * country's own backend when the page is opened and added up here.
 *
 * Money is added up in US dollars at the rates the Master Super Admin
 * typed at the bottom of this page (owner decision 2026-11-23); a country
 * without a rate keeps its own currency and is left out of the dollar
 * totals, and the page says so wherever a dollar total is shown. A country
 * that is not connected is listed as such, never with a made-up figure. A
 * sale is a paid order.
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
  const offline = report.rows.filter((row) => !row.connected);
  const failed = offline.filter((row) => connectionOf(false, row.unavailable) === "failed");
  const inDollars = connected.filter((row) => row.salesUsdCents !== null);
  /** Connected countries whose money cannot join a dollar total. */
  const unrated = connected.filter((row) => row.salesUsdCents === null);
  /** Dollar totals that leave a connected country out are partial, and are marked so. */
  const partial = unrated.length > 0 && inDollars.length > 0;
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
  const chosen = only ? report.countries.find((country) => country.id === only) : undefined;
  const changed = only !== null || local || query.preset !== REPORT_DEFAULT_DAYS || query.sort !== "rank" || query.direction !== "asc";
  /** Why a dollar figure has no number: nobody answered, or nobody who answered has a rate. */
  const dollarState: FigureState = connected.length === 0 ? "unavailable" : "not_configured";
  /** The sales the dollar totals leave out, each in its own currency: listed, never added together. */
  const unratedLocal = unrated.map((row) => (row.currency ? formatMinor(row.salesMinor, row.currency, row.exponent) : row.name)).join(" · ");
  const statusRows = connected.filter((row) => row.statusGroups !== null);

  const sortHead = (key: SortKey, label: string, align: "left" | "right" = "right") => {
    const current = query.sort === key;
    const next = current && query.direction === "desc" ? "asc" : current && query.direction === "asc" ? "desc" : key === "name" || key === "rank" ? "asc" : "desc";
    return (
      <th key={key} scope="col" aria-sort={current ? (query.direction === "asc" ? "ascending" : "descending") : undefined} className={`whitespace-nowrap px-2.5 py-2.5 ${align === "right" ? "text-right" : ""}`}>
        <Link href={`${globalHref(BASE, query, { sort: key, direction: next })}#countries`} prefetch={false} className={`inline-flex items-center gap-1 hover:text-ink ${current ? "text-ink" : ""}`}>
          {label}
          <span aria-hidden="true" className={current ? "text-accent-ink" : "opacity-50"}>
            {current ? (query.direction === "asc" ? "↑" : "↓") : "↕"}
          </span>
        </Link>
      </th>
    );
  };

  const tableRows: CountryTableRow[] = rows.map((row) => {
    const connection = connectionOf(row.connected, row.unavailable);
    const statusLabel = COUNTRY_STATUS_LABEL[row.status as keyof typeof COUNTRY_STATUS_LABEL] ?? row.status;
    return {
      id: row.id,
      search: [row.name, row.isoCode ?? "", row.currency ?? "", statusLabel, CONNECTION_LABEL[connection]].join(" ").toLowerCase(),
      node: (
        <tr className="hover:bg-raised/60">
          <td className={`${cell} tabular-nums text-muted`}>{row.rank ?? "—"}</td>
          <td className={cell}>
            <div className="flex flex-wrap items-center gap-2">
              <CountryFlag isoCode={row.isoCode} size="sm" />
              {row.connected ? (
                <Link href={`/c/${row.id}/reports?from=${period.from}&to=${period.to}`} className="font-semibold text-ink underline-offset-2 hover:underline">
                  {row.name}
                </Link>
              ) : (
                <span className="font-semibold text-ink">{row.name}</span>
              )}
              <StatusPill tone={COUNTRY_STATUS_TONE[row.status as keyof typeof COUNTRY_STATUS_TONE] ?? "neutral"}>{statusLabel}</StatusPill>
            </div>
          </td>
          <td className={`${cell} text-muted`}>{row.currency ?? "Not set"}</td>
          {row.connected ? (
            <>
              <td className={numeric}>{count(row.orders)}</td>
              <td className={`${numeric} font-semibold`}>
                {money(row, row.salesMinor, row.salesUsdCents)}
                {!local && row.salesUsdCents === null ? <span className="ml-1.5 text-xs font-normal text-warn">no rate</span> : null}
              </td>
              <td className={numeric}>{count(row.paidOrders)}</td>
              <td className={numeric}>{money(row, row.averageMinor, row.averageUsdCents)}</td>
              <td className={numeric}>{row.customers !== null ? count(row.customers) : "—"}</td>
              <td className={numeric}>
                {row.growth === null ? (
                  <span className="text-muted">—</span>
                ) : (
                  <span className={`font-semibold ${row.growth >= 0 ? "text-ok" : "text-danger"}`}>
                    <span aria-hidden="true" className="text-[9px]">
                      {row.growth >= 0 ? "▲" : "▼"}{" "}
                    </span>
                    {signedPercent(row.growth)}
                  </span>
                )}
              </td>
              <td className={cell}>
                {row.contribution === null ? (
                  <span className="text-muted">—</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <span aria-hidden="true" className="h-1.5 w-12 overflow-hidden rounded-full bg-raised ring-1 ring-inset ring-line">
                      <span className={`block h-full rounded-full ${row.contribution > 0 ? "bg-accent" : ""}`} style={{ width: `${Math.min(100, row.contribution)}%` }} />
                    </span>
                    <span className="tabular-nums">{row.contribution.toFixed(1)}%</span>
                  </div>
                )}
              </td>
            </>
          ) : (
            <td colSpan={7} className={`${cell} text-sm text-muted`}>
              No figures: {row.unavailable ? SERVICE_UNAVAILABLE_TEXT[row.unavailable] : "the country did not answer."}
            </td>
          )}
          <td className={cell}>
            <StatusPill tone={CONNECTION_TONE[connection]}>{CONNECTION_LABEL[connection]}</StatusPill>
          </td>
        </tr>
      ),
    };
  });

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-ink">Master Super Admin</p>
          <h1 className="font-display mt-1 text-[1.625rem] leading-[1.1] text-ink [text-wrap:balance] sm:text-[2rem]">Global Combined Reports</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">Consolidated business performance, revenue, orders and country analytics across all TRONIC markets.</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="flex items-center gap-2 text-xs leading-tight text-muted">
            <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${connected.length > 0 ? "bg-ok" : "bg-danger"}`} />
            <span>
              <span className="block font-semibold text-ink">
                Last synchronised <time dateTime={report.readAt}>{formatDateTime(report.readAt)}</time>
              </span>
              {totals.connected} of {totals.countries} {totals.countries === 1 ? "country" : "countries"} connected
            </span>
          </p>
          <div className="flex items-center gap-2">
            <RefreshLink href={globalHref(BASE, query)} className={buttonClass.secondary} />
            <a href={globalHref(`${BASE}/export`, query)} className={buttonClass.secondary}>
              <DownloadIcon size={16} />
              Export CSV
            </a>
          </div>
        </div>
      </header>

      <section aria-label="Filters" className="rounded-xl border border-line bg-surface shadow-panel">
        <div className="flex flex-col gap-2 p-2.5 md:flex-row md:flex-wrap md:items-center md:justify-between">
          <Segmented
            label="Period"
            items={REPORT_PRESETS.map((preset) => ({
              href: globalHref(BASE, query, { period: { from: shiftDay(today, -(preset - 1)), to: today } }),
              text: preset === 365 ? "12 months" : `${preset} days`,
              current: query.preset === preset,
            }))}
          />
          <Segmented
            label="Currency view"
            items={[
              { href: globalHref(BASE, query, { view: "usd" }), text: "USD unified", current: !local },
              { href: globalHref(BASE, query, { view: "local" }), text: "Local", current: local },
            ]}
          />
        </div>
        <div className="flex flex-col gap-2 border-t border-line p-2.5 md:flex-row md:flex-wrap md:items-center md:gap-x-4">
          <FilterDrawer summary={`${formatShortDay(period.from)} – ${formatShortDay(period.to)} · ${chosen?.name ?? "All countries"}`} defaultOpen={query.preset === null || only !== null || query.problem !== null}>
            <form key={`${period.from}:${period.to}:${only ?? ""}:${view}`} method="get" action={BASE} className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center">
              {local ? <input type="hidden" name="view" value="local" /> : null}
              <label className={field}>
                From
                <input type="date" name="from" required defaultValue={period.from} max={today} className={fieldInput} />
              </label>
              <label className={field}>
                To
                <input type="date" name="to" required defaultValue={period.to} max={today} className={fieldInput} />
              </label>
              <label className={`${field} col-span-2`}>
                Country
                <select name="country" defaultValue={only ?? ""} className={`${fieldInput} md:min-w-40`}>
                  <option value="">All countries</option>
                  {report.countries.map((country) => (
                    <option key={country.id} value={country.id}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="col-span-2 flex items-center gap-2">
                <button type="submit" className="inline-flex min-h-9 flex-1 items-center justify-center rounded-lg bg-accent px-5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover md:flex-none">
                  Show
                </button>
                {changed ? (
                  <Link href={BASE} prefetch={false} className="inline-flex min-h-9 items-center justify-center rounded-lg px-3 text-sm font-medium text-muted transition-colors hover:bg-raised hover:text-ink">
                    Reset
                  </Link>
                ) : null}
              </div>
            </form>
          </FilterDrawer>
          <p className="text-xs leading-snug text-muted md:ml-auto md:max-w-md md:text-right">
            <span className="font-semibold text-ink">{formatPeriod(period)}</span> · {days} {days === 1 ? "day" : "days"}, each country&apos;s own calendar days. A sale is a paid order; Cash on Delivery is paid once delivered.
          </p>
        </div>
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
      {failed.length > 0 && connected.length > 0 ? (
        <Notice tone="danger" title={`Connection failed: ${failed.map((row) => row.name).join(", ")}`}>
          {failed.length === 1 ? "Its figures are" : "Their figures are"} missing from every total on this page. The reason is beside {failed.length === 1 ? "the country" : "each country"} in the table below.
        </Notice>
      ) : null}
      {unrated.length > 0 ? (
        <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-warn/40 bg-warn-soft px-3.5 py-2.5 text-sm text-warn">
          <AlertTriangleIcon size={18} className="shrink-0" />
          <p className="min-w-0 flex-1 basis-64">
            <span className="font-semibold">Some sales are not in the dollar totals.</span> {unrated.map((row) => row.name).join(", ")}: no US dollar rate is set, so {unrated.length === 1 ? "its" : "their"} paid sales ({unratedLocal}) stay in local
            currency and are left out of every US dollar total, share and ranking on this page.
          </p>
          <a href="#rates" className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg border border-warn/50 bg-surface px-3.5 text-sm font-semibold text-ink transition-colors hover:bg-raised">
            Set exchange rate
          </a>
        </div>
      ) : null}

      <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi slug="total-orders" icon={ShoppingBagIcon} label="Total orders" value={connected.length > 0 ? count(totals.orders) : null}>
          {connected.length > 0 ? <Delta now={totals.orders} before={totals.previousOrders} /> : "No country answered"}
        </Kpi>
        <Kpi slug="paid-sales" icon={BanknoteIcon} label="Paid sales" value={inDollars.length > 0 ? usd(totals.salesUsdCents) : null} state={dollarState}>
          {inDollars.length > 0 ? (
            <>
              <Delta now={totals.salesUsdCents} before={totals.previousSalesUsdCents} />
              {partial ? (
                <span className="mt-1 block">
                  <span className="font-semibold text-warn">Partial:</span> without {unrated.map((row) => row.name).join(", ")}
                </span>
              ) : null}
            </>
          ) : connected.length > 0 ? (
            <>
              Needs a US dollar rate. <span className="tabular-nums text-ink">{unratedLocal}</span> in local currency.
            </>
          ) : (
            "No country answered"
          )}
        </Kpi>
        <Kpi slug="paid-orders" icon={CheckCircleIcon} label="Paid orders" value={connected.length > 0 ? count(totals.paidOrders) : null}>
          {connected.length > 0 ? <Delta now={totals.paidOrders} before={totals.previousPaidOrders} /> : "No country answered"}
        </Kpi>
        <Kpi
          slug="average-order"
          icon={CreditCardIcon}
          label="Avg. order value"
          value={totals.averageUsdCents !== null ? usd(totals.averageUsdCents) : null}
          state={inDollars.length > 0 ? "no_data" : dollarState}
        >
          {totals.averageUsdCents !== null ? (
            <Delta now={totals.averageUsdCents} before={totals.previousAverageUsdCents} />
          ) : inDollars.length > 0 ? (
            "No paid order in this period"
          ) : connected.length > 0 ? (
            "Needs a US dollar rate"
          ) : (
            "No country answered"
          )}
        </Kpi>
        <Kpi slug="customers" icon={UsersIcon} label="Customer accounts" value={totals.customers !== null ? count(totals.customers) : null}>
          {totals.customers !== null ? "All time, not only this period" : connected.length > 0 ? "The countries did not report it" : "No country answered"}
        </Kpi>
        <Kpi slug="active-countries" icon={GlobeIcon} label="Active countries" value={count(totals.active)}>
          {totals.connected} of {totals.countries} connected
        </Kpi>
        <Kpi
          slug="top-country"
          icon={ChartIcon}
          label="Top country"
          value={best ? best.name : null}
          state={inDollars.length > 0 ? "no_data" : dollarState}
          lead={best ? <CountryFlag isoCode={best.isoCode} /> : undefined}
        >
          {best
            ? `${usd(best.salesUsdCents ?? 0)}${best.contribution !== null ? ` · ${best.contribution.toFixed(1)}% of paid sales` : ""}`
            : inDollars.length > 0
              ? "No paid sales in this period"
              : connected.length > 0
                ? "Ranking needs a US dollar rate"
                : "No country answered"}
        </Kpi>
        <Kpi slug="best-growth" icon={TrendingUpIcon} label="Best growth" value={grower ? grower.name : null} state={connected.length > 0 ? "no_data" : "unavailable"} lead={grower ? <CountryFlag isoCode={grower.isoCode} /> : undefined}>
          {grower ? (
            <span className="inline-flex flex-wrap items-center gap-x-1.5">
              <span className="inline-flex items-center gap-1 rounded-md bg-ok-soft px-1.5 py-0.5 font-semibold tabular-nums text-ok">
                <span aria-hidden="true" className="text-[9px]">
                  ▲
                </span>
                {signedPercent(grower.growth ?? 0)}
              </span>
              paid sales
            </span>
          ) : connected.length > 0 ? (
            "No country grew on the previous period"
          ) : (
            "No country answered"
          )}
        </Kpi>
      </section>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <Panel title="Sales by country" description={`Paid sales in US dollars at the rates set below, ${formatPeriod(period)}.`}>
            {inDollars.some((row) => (row.salesUsdCents ?? 0) > 0) ? (
              <CountryColumns
                label="Paid sales by country, in US dollars"
                axis="Paid sales (USD)"
                formatTick={usdShort}
                items={report.rows.map((row) => ({
                  key: row.id,
                  label: row.name,
                  series: series(row.id),
                  value: row.salesUsdCents,
                  display: usdShort(row.salesUsdCents ?? 0),
                  detail: [usd(row.salesUsdCents ?? 0), ...(row.contribution !== null ? [`${row.contribution.toFixed(1)}% of paid sales`] : []), `${count(row.paidOrders)} paid ${row.paidOrders === 1 ? "order" : "orders"}`],
                  missing: row.connected ? "No rate" : CONNECTION_LABEL[connectionOf(false, row.unavailable)],
                }))}
              />
            ) : connected.length === 0 ? (
              <EmptyRow title="Unavailable" description="No country answered, so there are no sales to show." />
            ) : inDollars.length === 0 ? (
              <EmptyRow title="Not configured" description="No connected country has a US dollar rate yet. Set one under US dollar rates and its sales appear here." />
            ) : (
              <EmptyRow title="No paid sales in this period" description="A country appears here once it has paid orders in the period." />
            )}
          </Panel>
        </div>

        <div className="xl:col-span-2">
          <Panel title="Revenue share" description={`Each country's part of the paid sales in US dollars, ${formatPeriod(period)}.`}>
            {totals.salesUsdCents > 0 ? (
              <>
                <Donut
                  label="Share of paid sales by country"
                  centre={usdShort(totals.salesUsdCents)}
                  centreLabel={partial ? "Paid sales, partial" : "Paid sales"}
                  parts={inDollars.map((row) => ({ key: row.id, label: row.name, series: series(row.id), value: row.salesUsdCents ?? 0, display: usd(row.salesUsdCents ?? 0) }))}
                />
                <LeftOut unrated={unrated} offline={offline} />
              </>
            ) : connected.length === 0 ? (
              <EmptyRow title="Unavailable" description="No country answered." />
            ) : inDollars.length === 0 ? (
              <EmptyRow title="Not configured" description="A share needs one currency: set a US dollar rate first." />
            ) : (
              <EmptyRow title="No paid sales in this period" description="There is nothing to share out yet." />
            )}
          </Panel>
        </div>

        <div className="xl:col-span-3">
          <Panel title="Orders trend" description={`Orders placed per day, all connected countries together, ${formatPeriod(period)}.`}>
            {report.trend.some((point) => point.orders > 0) ? (
              <>
                <LineChart
                  label="Orders placed per day"
                  axis="Orders placed"
                  whole
                  formatTick={(value) => count(Math.round(value))}
                  points={report.trend.map((point) => ({
                    key: point.day,
                    label: formatShortDay(point.day),
                    value: point.orders,
                    heading: formatDay(point.day),
                    detail: `${count(point.orders)} ${point.orders === 1 ? "order" : "orders"}`,
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
            ) : connected.length === 0 ? (
              <EmptyRow title="Unavailable" description="No country answered." />
            ) : (
              <EmptyRow title="No orders in this period" />
            )}
          </Panel>
        </div>

        <div className="xl:col-span-2">
          <Panel title="Order status" description="Orders placed in the period, by where they stand now.">
            {statusRows.some((row) => row.orders > 0) ? (
              <>
                <StackedBars
                  label="Orders by status and country"
                  segments={STATUS_GROUPS.map((group) => STATUS_GROUP_LABELS[group.key])}
                  fills={STATUS_GROUPS.map((group) => group.fill)}
                  rows={statusRows.map((row) => ({ key: row.id, label: row.name, values: STATUS_GROUPS.map((group) => row.statusGroups?.[group.key] ?? 0) }))}
                />
                <TableView>
                  <DataTable caption="Orders by status and country" head={["Country", ...STATUS_GROUPS.map((group) => STATUS_GROUP_LABELS[group.key])]}>
                    {statusRows.map((row) => (
                      <tr key={row.id}>
                        <Cell className="font-medium text-ink">{row.name}</Cell>
                        {STATUS_GROUPS.map((group) => (
                          <Cell key={group.key} className="tabular-nums">
                            {count(row.statusGroups?.[group.key] ?? 0)}
                          </Cell>
                        ))}
                      </tr>
                    ))}
                  </DataTable>
                </TableView>
              </>
            ) : connected.length === 0 ? (
              <EmptyRow title="Unavailable" description="No country answered." />
            ) : statusRows.length === 0 ? (
              <EmptyRow title="Unavailable" description="The countries answered, but their order status report could not be read." />
            ) : (
              <EmptyRow title="No orders in this period" />
            )}
          </Panel>
        </div>
      </div>

      <Panel
        id="countries"
        title="Country performance"
        description={local ? "Money in each country's own currency." : "Money in US dollars where a rate is set, otherwise in the country's own currency."}
        flush
      >
        <CountryTable
          caption="Country performance, combined"
          columns={11}
          hint="Click a heading to sort. A country's name opens its own reports."
          rows={tableRows}
          head={
            <tr className="border-b border-line bg-raised text-[11px] font-semibold uppercase text-muted">
              {sortHead("rank", "#", "left")}
              {sortHead("name", "Country", "left")}
              <th scope="col" className="px-2.5 py-2.5">
                Currency
              </th>
              {sortHead("orders", "Orders")}
              {sortHead("sales", "Paid sales")}
              {sortHead("paidOrders", "Paid orders")}
              {sortHead("average", "Avg. order")}
              {sortHead("customers", "Customers")}
              {sortHead("growth", "Growth")}
              {sortHead("contribution", "Contribution", "left")}
              <th scope="col" className="px-2.5 py-2.5">
                Connection
              </th>
            </tr>
          }
          foot={
            <tr className="border-t-2 border-line-strong bg-raised font-semibold text-ink">
              <td className={cell} />
              <td className={cell}>
                Total ({totals.connected} of {totals.countries} {totals.countries === 1 ? "country" : "countries"})
              </td>
              <td className={`${cell} text-muted`}>{local ? "—" : "USD"}</td>
              <td className={numeric}>{count(totals.orders)}</td>
              <td className={numeric}>
                {local ? "—" : inDollars.length > 0 ? usd(totals.salesUsdCents) : "—"}
                {!local && partial ? <span className="ml-1.5 text-xs font-normal text-warn">partial</span> : null}
              </td>
              <td className={numeric}>{count(totals.paidOrders)}</td>
              <td className={numeric}>{local || totals.averageUsdCents === null ? "—" : usd(totals.averageUsdCents)}</td>
              <td className={numeric}>{totals.customers !== null ? count(totals.customers) : "—"}</td>
              <td className={numeric}>
                {totals.previousSalesUsdCents !== null && totals.previousSalesUsdCents > 0 ? signedPercent(((totals.salesUsdCents - totals.previousSalesUsdCents) / totals.previousSalesUsdCents) * 100) : "—"}
              </td>
              <td className={`${cell} tabular-nums`}>{totals.salesUsdCents > 0 ? "100%" : "—"}</td>
              <td className={cell} />
            </tr>
          }
        />
        {local ? <p className="border-t border-line px-5 py-3 text-xs text-muted">Money totals need one currency: switch to USD unified to see them.</p> : null}
        {!local && unrated.length > 0 ? (
          <p className="border-t border-line px-5 py-3 text-xs text-muted">
            The US dollar totals do not include {unrated.map((row) => row.name).join(", ")}: no rate is set.{" "}
            <a href="#rates" className="font-semibold text-ink underline underline-offset-2">
              Set exchange rate
            </a>
          </p>
        ) : null}
      </Panel>

      <section aria-labelledby="highlights">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="highlights" className="text-base font-semibold text-ink">
            Country highlights
          </h2>
          <p className="text-sm text-muted">Each country at a glance, in its own figures.</p>
        </div>
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {report.rows.map((row) => {
            const connection = connectionOf(row.connected, row.unavailable);
            return (
              <li key={row.id} className={`flex min-w-0 flex-col rounded-xl border p-4 ${row.connected ? "border-line bg-surface shadow-panel" : "self-start border-dashed border-line-strong bg-raised/50"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex min-w-0 items-center gap-2 text-[0.9375rem] font-bold text-ink">
                    <CountryFlag isoCode={row.isoCode} />
                    <span className="min-w-0 truncate">{row.name}</span>
                  </h3>
                  <StatusPill tone={COUNTRY_STATUS_TONE[row.status as keyof typeof COUNTRY_STATUS_TONE] ?? "neutral"}>
                    {COUNTRY_STATUS_LABEL[row.status as keyof typeof COUNTRY_STATUS_LABEL] ?? row.status}
                  </StatusPill>
                </div>
                {row.connected ? (
                  <>
                    <dl className="mt-3 flex flex-col gap-1.5 text-sm">
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-muted">Orders</dt>
                        <dd className="font-semibold tabular-nums text-ink">{count(row.orders)}</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="shrink-0 text-muted">Paid sales</dt>
                        <dd className="min-w-0 text-right font-semibold tabular-nums text-ink [overflow-wrap:anywhere]">{money(row, row.salesMinor, row.salesUsdCents)}</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="shrink-0 text-muted">Growth</dt>
                        <dd className="text-right">
                          {row.growth === null ? (
                            <span className="text-xs text-muted">No sales in the previous period</span>
                          ) : (
                            <span className={`font-semibold tabular-nums ${row.growth >= 0 ? "text-ok" : "text-danger"}`}>
                              <span aria-hidden="true" className="text-[9px]">
                                {row.growth >= 0 ? "▲" : "▼"}{" "}
                              </span>
                              {signedPercent(row.growth)}
                            </span>
                          )}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-3">
                      <Sparkline values={row.salesByDay} series={series(row.id)} label={`${row.name}: paid sales per day`} />
                    </div>
                    <dl className="mt-3 flex flex-col gap-1 border-t border-line pt-3 text-xs">
                      <div className="flex gap-1.5">
                        <dt className="shrink-0 text-muted">Top category</dt>
                        <dd className="min-w-0 flex-1 truncate text-right font-medium text-ink">{row.topCategory ?? "None sold"}</dd>
                      </div>
                      <div className="flex gap-1.5">
                        <dt className="shrink-0 text-muted">Best product</dt>
                        <dd className="min-w-0 flex-1 truncate text-right font-medium text-ink">{row.topProduct ?? "None sold"}</dd>
                      </div>
                    </dl>
                    <Link
                      href={`/c/${row.id}/reports?from=${period.from}&to=${period.to}`}
                      className="mt-3 inline-flex min-h-9 items-center justify-center rounded-lg border border-line-strong bg-surface px-3 text-sm font-semibold text-ink transition-colors hover:bg-raised"
                      aria-label={`View details for ${row.name}`}
                    >
                      View details
                    </Link>
                  </>
                ) : (
                  <div className="mt-3 flex flex-1 flex-col gap-1">
                    <p className="text-sm font-semibold text-ink">{CONNECTION_LABEL[connection]}</p>
                    <p className="text-xs leading-snug text-muted">{row.unavailable ? SERVICE_UNAVAILABLE_TEXT[row.unavailable] : "The country did not answer."}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[3fr_2fr]">
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
          ) : inDollars.length === 0 && connected.length > 0 ? (
            <EmptyRow title="Not configured" description="Categories are compared in US dollars: set a rate for a connected country first." />
          ) : (
            <EmptyRow title="No category sales in this period" description="Categories appear here once products are sold in a country with a US dollar rate." />
          )}
        </Panel>
      </div>

      <Panel title="Executive insights" description="Worked out from the figures on this page for this period. Facts, not a forecast.">
        {report.insights.length === 0 ? (
          <EmptyRow title="No insights yet" description="Insights will become available as more verified country data is connected." />
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {report.insights.map((insight) => (
              <li key={insight.key} className={`rounded-lg border border-l-[3px] border-line bg-raised/50 py-2.5 pl-3.5 pr-4 ${INSIGHT_EDGE[insight.tone]}`}>
                <p className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${INSIGHT_INK[insight.tone]}`}>{insight.label}</p>
                <p className="mt-0.5 text-sm leading-snug text-ink">{insight.text}</p>
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
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
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
