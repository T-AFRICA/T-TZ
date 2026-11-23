import Link from "next/link";
import { Skeleton, VisuallyHidden } from "@tronic/ui";
import { CONNECTION_LABEL, connectionOf } from "@/features/global-reports/states";
import { SERVICE_UNAVAILABLE_TEXT } from "@/features/labels";
import { formatMinor } from "@/features/orders/labels";
import { addFigures, collectFigures, noFiguresReason, type NoFiguresReason } from "@/features/overview/figures";
import { countryApiFor } from "@/server/country-api";
import type { AdminContext } from "@/server/session";
import { CountryFlag } from "./flag";
import { StatCard, UnavailableStat } from "./ui";

const LABELS = ["Products on sale", "Customers", "Orders", "Pending orders", "Sales by country", "Inventory alerts"] as const;

const NO_FIGURES: Record<Exclude<NoFiguresReason, "failed">, string> = {
  no_countries: "Your account has no role in any country.",
  not_permitted: "Your role does not include reports in your countries.",
  not_connected: "Comes from each country's own service. No country service is connected yet.",
};

const whole = (value: number) => value.toLocaleString("en-US");
const plural = (value: number, one: string, many: string) => `${whole(value)} ${value === 1 ? one : many}`;

/** The outline of the figures while the countries are asked. */
export function OverviewFiguresLoading() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
      <VisuallyHidden>
        <span role="status">Reading the countries&apos; figures…</span>
      </VisuallyHidden>
      {LABELS.map((label) => (
        <Skeleton key={label} className="h-[7.25rem] w-full rounded-xl" />
      ))}
    </div>
  );
}

/**
 * The Overview's business figures, asked from each country's own service
 * when the page is opened: the summary the country's dashboard shows, for
 * every country the administrator holds reports.read in (checked here, and
 * by the country on the signed request). Counts are added up; sales stay in
 * each country's own currency. A figure that cannot be had says why, never
 * a number, and a count that leaves a country out names it.
 */
export async function OverviewFigures({ admin }: { admin: AdminContext }) {
  const results = await collectFigures(admin.actor, admin.countries, async (country) => (await countryApiFor(admin, country)).summary(admin.actor.userId));
  const figures = addFigures(results);

  if (figures.counted === 0) {
    const why = noFiguresReason(figures);
    const failed = figures.leftOut.find((left) => left.state === "unavailable" && left.reason !== "not_configured" && left.reason !== "no_iso_code");
    const reason = why !== "failed" ? NO_FIGURES[why] : failed?.state === "unavailable" ? `${failed.country.name}: ${SERVICE_UNAVAILABLE_TEXT[failed.reason]}` : "No country answered.";
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {LABELS.map((label) => (
          <UnavailableStat key={label} label={label} reason={reason} />
        ))}
      </div>
    );
  }

  const from = `in ${figures.counted} of ${plural(figures.countries, "country", "countries")}`;
  const alerts = figures.outOfStock + figures.lowStock;
  const leftOut = figures.leftOut.map((left) => `${left.country.name} (${left.state === "not_permitted" ? "not in your role" : CONNECTION_LABEL[connectionOf(false, left.reason)].toLowerCase()})`);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div data-figure="products" className="contents">
          <StatCard label="Products on sale" value={whole(figures.productsOnSale)} hint={`Active, with a price, ${from}`} />
        </div>
        <div data-figure="customers" className="contents">
          <StatCard label="Customers" value={whole(figures.customers)} hint="Accounts registered on the websites" />
        </div>
        <div data-figure="orders" className="contents">
          <StatCard label="Orders" value={whole(figures.orders)} hint={`All time · ${plural(figures.ordersToday, "order", "orders")} placed today`} />
        </div>
        <div data-figure="pending" className="contents">
          <StatCard label="Pending orders" value={whole(figures.ordersOpen)} hint={`Not delivered or cancelled · ${whole(figures.ordersAwaiting)} awaiting confirmation`} />
        </div>
        <div data-figure="sales" className="rounded-xl border border-line bg-surface p-5 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Sales by country</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {figures.sales.map((sale) => (
              <li key={sale.id} className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink">
                  <CountryFlag isoCode={sale.isoCode} size="sm" />
                  <span className="min-w-0 truncate">{sale.name}</span>
                </span>
                <span className="text-xl font-bold tabular-nums text-ink">{formatMinor(sale.minor, sale.currency, sale.exponent)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-muted">
            Paid orders placed in the last 30 days.
            {admin.isMaster ? (
              <>
                {" "}
                <Link href="/reports" className="font-semibold text-accent-ink underline-offset-4 hover:underline">
                  Open Global reports
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <div data-figure="alerts" className="contents">
          <StatCard label="Inventory alerts" value={whole(alerts)} hint={`${whole(figures.outOfStock)} out of stock · ${whole(figures.lowStock)} low`} />
        </div>
      </div>
      <p className="mt-4 text-xs text-muted">
        Counted from {figures.counted} of {plural(figures.countries, "country", "countries")}, read when this page was opened.
        {leftOut.length > 0 ? ` Not counted: ${leftOut.join(", ")}.` : ""} Amounts are shown in each country&apos;s own currency; different currencies are never added together.
      </p>
    </>
  );
}
