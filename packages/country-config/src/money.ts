import type { CountryConfig } from "@tronic/types";

/**
 * Currency precision per ISO 4217 minor unit. The three launch currencies have
 * no minor unit in practice, so amounts are whole units and show no decimals
 * (rulesd §4: use the currency's precision, never assume two decimals).
 */
const MINOR_UNITS: Record<string, number> = { TZS: 0, KES: 0, UGX: 0 };

export function currencyFractionDigits(currency: string): number {
  return MINOR_UNITS[currency] ?? 2;
}

/**
 * Formats an amount for display in the country's locale and currency, as
 * "TZS 28,000" (code, not symbol, which is how prices are quoted locally).
 * Amounts are in the currency's minor units; with zero fraction digits that
 * is the whole-unit figure itself.
 */
export function formatMoney(amount: number, country: CountryConfig, currency = country.currency): string {
  const digits = currencyFractionDigits(currency);
  const value = digits === 0 ? amount : amount / 10 ** digits;
  const number = new Intl.NumberFormat(country.locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
  return `${currency} ${number}`;
}
