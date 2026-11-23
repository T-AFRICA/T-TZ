import type { CountryUnavailableReason } from "@tronic/api-contracts";

/**
 * How the Global Combined Reports words a country's connection and a figure
 * that has no number. Display only: nothing here decides what is read or
 * who may read it.
 */

export type ConnectionState = "connected" | "not_connected" | "switched_off" | "failed";

/**
 * A country that answered is connected. One that was never set up (no
 * service address, or not confirmed yet) is not connected: that is its
 * normal state, not a fault. One that is set up and still gave no figures
 * has a failed connection, so it is not mistaken for a planned country.
 */
export function connectionOf(connected: boolean, reason: CountryUnavailableReason | null): ConnectionState {
  if (connected) return "connected";
  if (reason === "not_configured" || reason === "no_iso_code") return "not_connected";
  if (reason === "disabled") return "switched_off";
  return "failed";
}

export const CONNECTION_LABEL: Record<ConnectionState, string> = {
  connected: "Connected",
  not_connected: "Not connected",
  switched_off: "Switched off",
  failed: "Connection failed",
};

export const CONNECTION_TONE: Record<ConnectionState, "ok" | "neutral" | "warn" | "danger"> = {
  connected: "ok",
  not_connected: "neutral",
  switched_off: "warn",
  failed: "danger",
};

/**
 * Why a figure has no number. A zero is a number and is shown as one; these
 * are the cases where there is nothing to show, each said in its own words
 * so an empty card is never read as "nothing sold".
 */
export type FigureState = "unavailable" | "not_configured" | "no_data";

export const FIGURE_STATE_LABEL: Record<FigureState, string> = {
  /** No country answered, or the part of the report could not be read. */
  unavailable: "Unavailable",
  /** The countries answered, but no US dollar rate is set, so there is no unified amount. */
  not_configured: "Not configured",
  /** Everything was read and there is nothing in the period to work the figure out from. */
  no_data: "No data",
};
