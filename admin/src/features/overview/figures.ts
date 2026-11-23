import type { CountryApiResult, CountrySummary, CountryUnavailableReason } from "@tronic/api-contracts";
import { can, type Actor } from "@tronic/permissions";

/**
 * The Overview's business figures: each country's own summary (the same one
 * its dashboard shows), counted by the country and added up here.
 *
 * Counts add up as they are. Money does not: each country's sales stay in
 * that country's currency and are listed one under the other, never added
 * together and never converted (the Global reports page does that, at the
 * rates a Master Super Admin sets). A country the administrator may not
 * read reports in is not asked at all; one that cannot be read is named as
 * left out, so a total never looks more complete than it is.
 *
 * No request is made here: `ask` is given by the caller, so the rules can
 * be tested without a country.
 */

export interface FigureCountry {
  id: string;
  name: string;
  isoCode: string | null;
}

export type CountryFigures<C extends FigureCountry = FigureCountry> =
  | { country: C; state: "counted"; summary: CountrySummary }
  /** The administrator's role in the country does not include its reports: the country was not asked. */
  | { country: C; state: "not_permitted" }
  | { country: C; state: "unavailable"; reason: CountryUnavailableReason };

/**
 * Asks each country the administrator holds reports.read in, in parallel.
 * The permission is checked here before anything is sent, and again by the
 * country on the signed request. A country that fails does not stop the
 * others.
 */
export async function collectFigures<C extends FigureCountry>(actor: Actor, countries: readonly C[], ask: (country: C) => Promise<CountryApiResult<CountrySummary>>): Promise<CountryFigures<C>[]> {
  return Promise.all(
    countries.map(async (country): Promise<CountryFigures<C>> => {
      if (!can(actor, "reports.read", country.id)) return { country, state: "not_permitted" };
      try {
        const result = await ask(country);
        return result.available ? { country, state: "counted", summary: result.data } : { country, state: "unavailable", reason: result.reason };
      } catch {
        // The adapter answers with a reason instead of throwing; if something still throws, the country has no figures.
        return { country, state: "unavailable", reason: "unreachable" };
      }
    }),
  );
}

export interface CountrySales {
  id: string;
  name: string;
  isoCode: string | null;
  currency: string;
  exponent: number;
  /** Paid orders placed in the last 30 days, in the country's minor units. */
  minor: number;
}

export interface OverviewFigures<C extends FigureCountry = FigureCountry> {
  /** Countries of the administrator. */
  countries: number;
  /** Countries whose figures are in the counts below. */
  counted: number;
  productsOnSale: number;
  customers: number;
  orders: number;
  ordersToday: number;
  /** Not delivered and not cancelled. */
  ordersOpen: number;
  ordersAwaiting: number;
  outOfStock: number;
  lowStock: number;
  /** One line per counted country, in the administrator's own country order. */
  sales: CountrySales[];
  /** Countries that are not in the counts, with why. */
  leftOut: Exclude<CountryFigures<C>, { state: "counted" }>[];
}

export function addFigures<C extends FigureCountry>(results: readonly CountryFigures<C>[]): OverviewFigures<C> {
  const figures: OverviewFigures<C> = {
    countries: results.length,
    counted: 0,
    productsOnSale: 0,
    customers: 0,
    orders: 0,
    ordersToday: 0,
    ordersOpen: 0,
    ordersAwaiting: 0,
    outOfStock: 0,
    lowStock: 0,
    sales: [],
    leftOut: [],
  };
  for (const result of results) {
    if (result.state !== "counted") {
      figures.leftOut.push(result);
      continue;
    }
    const { summary, country } = result;
    figures.counted += 1;
    figures.productsOnSale += summary.productsActive;
    figures.customers += summary.customerAccounts;
    figures.orders += summary.ordersTotal;
    figures.ordersToday += summary.ordersToday;
    figures.ordersOpen += summary.ordersOpen;
    figures.ordersAwaiting += summary.ordersByStatus.pending_payment ?? 0;
    figures.outOfStock += summary.productsOutOfStock;
    figures.lowStock += summary.productsLowStock;
    figures.sales.push({ id: country.id, name: country.name, isoCode: country.isoCode, currency: summary.currency, exponent: summary.currencyExponent, minor: summary.sales30DaysMinor });
  }
  return figures;
}

/** Why there is no figure at all, when no country was counted. */
export type NoFiguresReason = "no_countries" | "not_permitted" | "not_connected" | "failed";

export function noFiguresReason(figures: OverviewFigures): NoFiguresReason {
  if (figures.countries === 0) return "no_countries";
  if (figures.leftOut.every((left) => left.state === "not_permitted")) return "not_permitted";
  const unavailable = figures.leftOut.filter((left) => left.state === "unavailable");
  // Never set up (no address, or not confirmed) is the normal state of a planned country, not a fault.
  if (unavailable.every((left) => left.reason === "not_configured" || left.reason === "no_iso_code")) return "not_connected";
  return "failed";
}
