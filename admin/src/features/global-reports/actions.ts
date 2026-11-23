"use server";

import { setCountryExchangeRate } from "@tronic/database/admin";
import type { FormState } from "@/features/form-state";
import { formText } from "@/features/rules";
import { denied, done, refused } from "@/server/action-results";
import { getAdminDb } from "@/server/db";
import { requireAdmin } from "@/server/session";

/**
 * Sets a country's US dollar rate for the combined reports (owner decision
 * 2026-11-23: the Master Super Admin types it; no rate service is called).
 *
 * Here: the administrator from the verified session, who must be a Master
 * Super Admin; the country, which must be one the database returned for
 * them; the rate, a plain positive number. The database checks the role
 * again, keeps the rate exactly and writes the change to the audit log.
 */

/** "2,650" or "2 650.5" as "2650" and "2650.5"; anything else is returned as typed, for the check to refuse. */
function plainNumber(value: string): string {
  const compact = value.trim().replace(/\s+/g, "");
  return /^[0-9]{1,3}(,[0-9]{3})+(\.[0-9]+)?$/.test(compact) ? compact.replaceAll(",", "") : compact;
}

export async function setExchangeRateAction(_previous: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const countryId = formText(form, "countryId");
  if (!admin.isMaster) return denied(admin, /^[a-z][a-z0-9_]{1,23}$/.test(countryId) ? countryId : null, "country.exchange_rate");

  const country = admin.countries.find((candidate) => candidate.id === countryId);
  if (!country) return refused("not_found");
  if (!country.currency) return { status: "error", message: `${country.name} has no currency yet. Set it under Countries first.` };

  const rate = plainNumber(formText(form, "rate"));
  if (!/^[0-9]{1,10}(\.[0-9]{1,6})?$/.test(rate) || !(Number(rate) > 0)) {
    return {
      status: "error",
      message: "That rate is not valid.",
      fieldErrors: { rate: `Enter how many ${country.currency} one US dollar is, for example 2650 or 129.25 (up to six decimals).` },
    };
  }

  const result = await setCountryExchangeRate(getAdminDb(), admin.access, country.id, rate);
  if (!result.ok) return refused(result.code);
  return done(`Saved for ${country.name}: 1 USD = ${Number(rate).toLocaleString("en-GB", { maximumFractionDigits: 6 })} ${country.currency}.`);
}
