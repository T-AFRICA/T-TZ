/**
 * Country configuration contract (SSD AD-02, §3).
 *
 * Countries are isolated deployments on their own domains. The storefront
 * derives its active country from deployment configuration — never from a
 * client-editable parameter (SRS FR-059). The selector in the header only
 * displays the active country and links to the other country sites.
 */
export type CountryCode = "TZ" | "KE" | "UG";

export type CountryStatus = "active" | "coming_soon";

export interface CountryConfig {
  code: CountryCode;
  /** Display name, e.g. "Tanzania". */
  name: string;
  /** ISO 4217 currency code, e.g. "TZS". Display only; pricing is server-authoritative. */
  currency: string;
  /** BCP 47 primary locale, e.g. "en-TZ". */
  locale: string;
  /**
   * Public origin of this country's storefront once launched, e.g.
   * "https://tronic.co.tz". Unknown until the domain is approved.
   */
  origin: string | null;
  status: CountryStatus;
}
