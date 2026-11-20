import type { Metadata } from "next";
import Link from "next/link";
import { can } from "@tronic/permissions";
import { OrdersReportView, ProductsReportView, SalesReportView, StockReportView } from "@/components/reports";
import { Notice, PageHeader, buttonClass, inputClass } from "@/components/ui";
import { SERVICE_UNAVAILABLE_TEXT } from "@/features/labels";
import { loadReport } from "@/features/reports/load";
import {
  REPORT_PRESETS,
  REPORT_TABS,
  REPORT_TAB_LABEL,
  formatPeriod,
  readReportQuery,
  reportHref,
  shiftDay,
  todayIn,
} from "@/features/reports/period";
import { countryApiFor } from "@/server/country-api";
import { requireCountry } from "@/server/session";

export const metadata: Metadata = { title: "Reports" };

const chip = (current: boolean) =>
  `inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
    current ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-surface text-ink hover:bg-raised"
  }`;

/**
 * Sales, products and categories, orders and delivery, and stock for one
 * country and a period of its own days, counted live by the country
 * (migration 0019). A sale is a paid order. Each report downloads as CSV.
 */
export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ country: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { admin, country } = await requireCountry((await params).country, "reports.read");
  const today = todayIn(country.timezone);
  const { tab, period, preset, problem } = readReportQuery(await searchParams, today);
  const base = `/c/${country.id}/reports`;
  const api = await countryApiFor(admin, country);
  const result = await loadReport(api, admin.actor.userId, tab, period);

  const header = (
    <PageHeader
      eyebrow={country.name}
      title="Reports"
      description={`${country.name}'s own figures, counted when the page is opened. A sale is a paid order; Cash on Delivery counts once delivered. Days are ${country.name}'s${country.timezone ? ` (${country.timezone})` : ""}.`}
      actions={
        result.available ? (
          <a href={reportHref(`${base}/export`, tab, period)} download className={buttonClass.secondary}>
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 3v10m0 0 4-4m-4 4-4-4M4 16h12" />
            </svg>
            Download CSV
          </a>
        ) : undefined
      }
    />
  );

  return (
    <>
      {header}

      <nav aria-label="Report" className="flex flex-wrap gap-2">
        {REPORT_TABS.map((value) => (
          <Link key={value} href={reportHref(base, value, period)} aria-current={tab === value ? "page" : undefined} className={chip(tab === value)}>
            {REPORT_TAB_LABEL[value]}
          </Link>
        ))}
      </nav>

      <section aria-label="Period" className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-line bg-surface p-4 shadow-panel">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-ink">{formatPeriod(period)}</p>
          <div className="flex flex-wrap gap-2">
            {REPORT_PRESETS.map((days) => (
              <Link
                key={days}
                href={reportHref(base, tab, { from: shiftDay(today, -(days - 1)), to: today })}
                aria-current={preset === days ? "true" : undefined}
                className={chip(preset === days)}
              >
                {days === 365 ? "Last 12 months" : `Last ${days} days`}
              </Link>
            ))}
          </div>
        </div>
        <form method="get" action={base} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="tab" value={tab} />
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            From
            <input type="date" name="from" required defaultValue={period.from} max={today} className={`${inputClass} py-2`} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            To
            <input type="date" name="to" required defaultValue={period.to} max={today} className={`${inputClass} py-2`} />
          </label>
          <button type="submit" className={buttonClass.secondary}>
            Show
          </button>
        </form>
      </section>

      {problem ? (
        <Notice tone="warn" title="That period cannot be shown">
          {problem}
        </Notice>
      ) : null}

      {!result.available ? (
        <Notice tone="warn" title={`${country.name}'s reports cannot be shown right now`}>
          {SERVICE_UNAVAILABLE_TEXT[result.reason]}
        </Notice>
      ) : result.data.tab === "sales" ? (
        <SalesReportView report={result.data.data} />
      ) : result.data.tab === "products" ? (
        <ProductsReportView report={result.data.data} productsHref={can(admin.actor, "products.read", country.id) ? `/c/${country.id}/products` : null} />
      ) : result.data.tab === "orders" ? (
        <OrdersReportView report={result.data.data} ridersHref={can(admin.actor, "deliveries.assign", country.id) ? `/c/${country.id}/riders` : null} />
      ) : (
        <StockReportView report={result.data.data} inventoryHref={can(admin.actor, "inventory.read", country.id) ? `/c/${country.id}/inventory` : null} />
      )}
    </>
  );
}
