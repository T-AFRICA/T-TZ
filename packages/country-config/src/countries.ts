import type { CountryCode, CountryConfig } from "@tronic/types";

/**
 * Country roster (SSD §3). Tanzania is the only active deployment; Kenya and
 * Uganda launch in W13-W17 and W18-W22 respectively. Origins stay null until
 * each country's domain is approved — the selector renders them as
 * "coming soon" and must not invent URLs.
 */
export const COUNTRIES: readonly CountryConfig[] = [
  {
    code: "TZ",
    name: "Tanzania",
    currency: "TZS",
    locale: "en-TZ",
    origin: null,
    status: "active",
  },
  {
    code: "KE",
    name: "Kenya",
    currency: "KES",
    locale: "en-KE",
    origin: null,
    status: "coming_soon",
  },
  {
    code: "UG",
    name: "Uganda",
    currency: "UGX",
    locale: "en-UG",
    origin: null,
    status: "coming_soon",
  },
] as const;

/**
 * The country this deployment serves. Fixed to Tanzania for the first release;
 * per-country deployments will set this from validated deployment
 * configuration (SSD AD-02), never from request input.
 */
export const ACTIVE_COUNTRY: CountryConfig = COUNTRIES[0] as CountryConfig;

export function getCountry(code: CountryCode): CountryConfig | undefined {
  return COUNTRIES.find((country) => country.code === code);
}
