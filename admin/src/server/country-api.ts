import "server-only";
import {
  KeyFormatError,
  createCountryAdminApi,
  createServiceTokenSigner,
  unavailableCountryApi,
  type CountryAdminApi,
  type ServiceTokenSigner,
} from "@tronic/api-contracts";
import { getCountryEndpoint, type AdminCountry } from "@tronic/database/admin";
import { countryApiSigningKey } from "./config";
import { getAdminDb } from "./db";
import type { AdminContext } from "./session";

let signer: Promise<ServiceTokenSigner> | null = null;

function getSigner(): Promise<ServiceTokenSigner> | null {
  const key = countryApiSigningKey();
  if (!key) return null;
  if (!signer) {
    const created = createServiceTokenSigner(key);
    // A key that cannot be read must not be remembered as the answer for good.
    created.catch(() => {
      if (signer === created) signer = null;
    });
    signer = created;
  }
  return signer;
}

/**
 * The adapter for one country's admin API, chosen from the Central Admin's
 * own records: the country (one the database returned for this
 * administrator, never a value from the request) and its registered
 * service, which the database gives only to someone with a role in that
 * country. A country that cannot be called gets an adapter that answers
 * every request with the reason and sends nothing.
 */
export async function countryApiFor(admin: AdminContext, country: AdminCountry): Promise<CountryAdminApi> {
  if (!country.isoCode) return unavailableCountryApi("no_iso_code");
  const service = await getCountryEndpoint(getAdminDb(), admin.access, country.id);
  if (!service?.apiBaseUrl) return unavailableCountryApi("not_configured");
  if (!service.enabled) return unavailableCountryApi("disabled");
  const pending = getSigner();
  if (!pending) return unavailableCountryApi("signing_not_configured");
  try {
    return createCountryAdminApi({ baseUrl: service.apiBaseUrl, countryCode: country.isoCode, signer: await pending });
  } catch (error) {
    // The signing key as configured cannot be read (the reason goes to the log, never the key).
    if (error instanceof KeyFormatError) {
      console.error("admin: COUNTRY_API_SIGNING_KEY cannot be used", { reason: error.reason });
      return unavailableCountryApi("signing_key_invalid");
    }
    // An address that is not HTTPS.
    return unavailableCountryApi("not_configured");
  }
}
