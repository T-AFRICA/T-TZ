import "server-only";
import type { ReportPeriod } from "@tronic/api-contracts";
import { listCountryExchangeRates, type AdminCountry } from "@tronic/database/admin";
import { periodDays, shiftDay } from "@/features/reports/period";
import { countryApiFor } from "@/server/country-api";
import { getAdminDb } from "@/server/db";
import type { AdminContext } from "@/server/session";
import { combine, type Combined, type CountryInput, type CountryRate } from "./combine";

/** The same number of days, ending the day before `period` starts. */
export function previousPeriod(period: ReportPeriod): ReportPeriod {
  return { from: shiftDay(period.from, -periodDays(period)), to: shiftDay(period.from, -1) };
}

/**
 * One country's figures for the period, asked from the country's own
 * backend with signed requests (reports.read in that country, which the
 * country checks). A country that cannot be asked, or that does not answer
 * the sales report, comes back with the reason and no figures; a part that
 * fails on its own (stock, say) is left empty and the rest is still shown.
 */
async function loadCountry(admin: AdminContext, country: AdminCountry, period: ReportPeriod, rate: CountryRate | null): Promise<CountryInput> {
  const base = { id: country.id, name: country.name, isoCode: country.isoCode, status: country.status, currency: country.currency, rate };
  const api = await countryApiFor(admin, country);
  const actor = admin.actor.userId;
  const [sales, previous, orders, products, stock, summary] = await Promise.all([
    api.salesReport(actor, period),
    api.salesReport(actor, previousPeriod(period)),
    api.ordersReport(actor, period),
    api.productsReport(actor, period),
    api.stockReport(actor, period),
    api.summary(actor),
  ]);
  if (!sales.available) return { ...base, data: null, unavailable: sales.reason };
  return {
    ...base,
    unavailable: null,
    data: {
      sales: sales.data,
      previous: previous.available ? previous.data : null,
      orders: orders.available ? orders.data : null,
      products: products.available ? products.data : null,
      stock: stock.available ? stock.data : null,
      customers: summary.available ? summary.data.customerAccounts : null,
    },
  };
}

export interface GlobalReport extends Combined {
  /** Every country of the Central Admin, with its rate when it has one: for the rate form and the country filter. */
  countries: { id: string; name: string; currency: string | null; rate: (CountryRate & { text: string }) | null }[];
  /** When the countries were asked. */
  readAt: string;
}

/**
 * The combined report for a Master Super Admin: the countries are the ones
 * the database returned for this administrator, each asked on its own, in
 * parallel. `only` narrows the page to one of them.
 */
export async function loadGlobalReport(admin: AdminContext, period: ReportPeriod, only: string | null): Promise<GlobalReport> {
  const stored = await listCountryExchangeRates(getAdminDb(), admin.access);
  const rates = new Map(
    stored.flatMap((rate) => {
      const unitsPerUsd = Number(rate.unitsPerUsd);
      return unitsPerUsd > 0 && Number.isFinite(unitsPerUsd) ? [[rate.countryId, { unitsPerUsd, setAt: rate.setAt, text: rate.unitsPerUsd, currency: rate.currency }] as const] : [];
    }),
  );
  const rateOf = (country: AdminCountry) => {
    const rate = rates.get(country.id);
    return rate && rate.currency === country.currency ? rate : null;
  };
  const chosen = admin.countries.filter((country) => only === null || country.id === only);
  const inputs = await Promise.all(
    chosen.map((country) => {
      const rate = rateOf(country);
      return loadCountry(admin, country, period, rate ? { unitsPerUsd: rate.unitsPerUsd, setAt: rate.setAt } : null);
    }),
  );
  return {
    ...combine(inputs),
    countries: admin.countries.map((country) => {
      const rate = rateOf(country);
      return { id: country.id, name: country.name, currency: country.currency, rate: rate ? { unitsPerUsd: rate.unitsPerUsd, setAt: rate.setAt, text: rate.text } : null };
    }),
    readAt: new Date().toISOString(),
  };
}
