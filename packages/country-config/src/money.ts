import type { CountryConfig } from "@tronic/types";

/**
 * Money rules (rulesd §4; review 2026-11-11, issue "currency scaling").
 *
 * STORAGE UNIT. Every amount that is stored or passed between layers
 * (database `*_minor` columns, catalogue `priceMinor`, checkout quotes,
 * order totals, integrations) is an integer in the currency's ISO 4217
 * minor unit. TZS and KES have exponent 2 (100 cents to the shilling), UGX
 * has exponent 0. TZS 28,000 is therefore stored as 2_800_000. This is the
 * unit payment providers and Postgres-backed services use, so no adapter
 * has to rescale and a 100× slip shows up as a test failure, not a price.
 *
 * DISPLAY. Shillings are quoted whole in East Africa, so the display
 * precision is separate from the storage exponent: TZS 28,000, not
 * TZS 28,000.00. Display never changes what is stored.
 *
 * Only convert at the edges: `toMinorUnits` when a major-unit figure comes
 * in (a typed price filter, an ERP export), `formatMoney` when a figure is
 * shown. Arithmetic (line totals, subtotals) stays in minor units.
 */

interface CurrencyRule {
  /** ISO 4217 minor-unit exponent: the storage scale. */
  exponent: number;
  /** Fraction digits shown to customers. */
  displayDigits: number;
}

const CURRENCIES: Record<string, CurrencyRule> = {
  TZS: { exponent: 2, displayDigits: 0 },
  KES: { exponent: 2, displayDigits: 0 },
  UGX: { exponent: 0, displayDigits: 0 },
  USD: { exponent: 2, displayDigits: 2 },
};

function rule(currency: string): CurrencyRule {
  const found = CURRENCIES[currency];
  if (!found) {
    // An unknown currency is a configuration error; guessing a scale is how
    // 100× mistakes happen.
    throw new Error(`Unsupported currency: ${currency}`);
  }
  return found;
}

/** ISO 4217 minor-unit exponent (storage scale): TZS 2, KES 2, UGX 0. */
export function currencyExponent(currency: string): number {
  return rule(currency).exponent;
}

/** Fraction digits shown to customers: 0 for the shilling currencies. */
export function currencyFractionDigits(currency: string): number {
  return rule(currency).displayDigits;
}

/** True for a non-negative safe integer: the only valid stored amount. */
export function isMinorAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** Throws unless `value` is a valid stored amount (non-negative safe integer). */
export function assertMinorAmount(value: unknown, label = "amount"): number {
  if (!isMinorAmount(value)) throw new Error(`${label} must be a non-negative integer in minor units`);
  return value;
}

/**
 * Converts a major-unit amount (shillings) to stored minor units:
 * toMinorUnits(28_000, "TZS") → 2_800_000. Accepts numbers or decimal
 * strings ("28000", "28000.50", "28,000"); rejects more decimals than the
 * currency has, so a value can never be silently rounded.
 */
export function toMinorUnits(major: number | string, currency: string): number {
  const { exponent } = rule(currency);
  const text = typeof major === "number" ? String(major) : major.trim().replace(/,/g, "");
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) throw new Error(`Not a non-negative ${currency} amount: ${String(major)}`);
  const whole = match[1]!;
  const fraction = (match[2] ?? "").replace(/0+$/, "");
  if (fraction.length > exponent) throw new Error(`${currency} has ${exponent} decimal places: ${String(major)}`);
  const minor = Number(whole + fraction.padEnd(exponent, "0"));
  return assertMinorAmount(minor, `${currency} amount`);
}

/** Converts stored minor units to a major-unit number (for display maths only). */
export function fromMinorUnits(minor: number, currency: string): number {
  return assertMinorAmount(minor) / 10 ** rule(currency).exponent;
}

/**
 * Formats a stored amount (minor units) for display in the country's locale
 * and currency, as "TZS 28,000" (code, not symbol, which is how prices are
 * quoted locally): formatMoney(2_800_000, TZ) → "TZS 28,000".
 */
export function formatMoney(minor: number, country: CountryConfig, currency = country.currency): string {
  const { exponent, displayDigits } = rule(currency);
  const number = new Intl.NumberFormat(country.locale, {
    minimumFractionDigits: displayDigits,
    maximumFractionDigits: displayDigits,
  }).format(assertMinorAmount(minor) / 10 ** exponent);
  return `${currency} ${number}`;
}
