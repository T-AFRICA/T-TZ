import "server-only";
import {
  createCountryAdminApi,
  createServiceTokenSigner,
  unavailableCountryApi,
  type CountryAdminApi,
  type ServiceTokenSigner,
} from "@tronic/api-contracts";
import type { AdminCountry, CountryService } from "@tronic/database/admin";
import { countryApiSigningKey } from "./config";

let signer: Promise<ServiceTokenSigner> | null = null;

function getSigner(): Promise<ServiceTokenSigner> | null {
  const key = countryApiSigningKey();
  if (!key) return null;
  signer ??= createServiceTokenSigner(key);
  return signer;
}

/**
 * The adapter for one country's admin API, chosen from the Central Admin's
 * own records: the country (never a value from the request) and its
 * registered service. A country that cannot be called gets an adapter that
 * answers every request with the reason and sends nothing.
 */
export async function countryApiFor(country: AdminCountry, service: CountryService | null): Promise<CountryAdminApi> {
  if (!country.isoCode) return unavailableCountryApi("no_iso_code");
  if (!service?.apiBaseUrl) return unavailableCountryApi("not_configured");
  if (!service.enabled) return unavailableCountryApi("disabled");
  const pending = getSigner();
  if (!pending) return unavailableCountryApi("signing_not_configured");
  try {
    return createCountryAdminApi({ baseUrl: service.apiBaseUrl, countryCode: country.isoCode, signer: await pending });
  } catch {
    // A key that cannot be read, or an address that is not HTTPS.
    return unavailableCountryApi("signing_not_configured");
  }
}
