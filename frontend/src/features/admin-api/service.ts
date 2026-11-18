import { createMemoryReplayGuard, createServiceTokenVerifier } from "@tronic/api-contracts";
import { ACTIVE_COUNTRY } from "@tronic/country-config";
import type { CountryAdminService } from "@tronic/database/country-admin";
import { dataSource, getDb } from "@/features/data/source";

/**
 * This country's side of the country admin API (/api/admin/v1). Server-only.
 *
 * The Central Admin signs every request with its private key; this
 * deployment holds only the matching public key:
 *   CENTRAL_ADMIN_VERIFY_KEY     the Central Admin's public key (SPKI PEM;
 *                                "\n" may stand for line breaks)
 *   CENTRAL_ADMIN_VERIFY_KEY_ID  the name the Central Admin gives that key
 * Without both, the API does not exist here: every address under
 * /api/admin answers 404 and nothing is verified or read.
 *
 * The country is this deployment's own (ACTIVE_COUNTRY), never a value from
 * a request. A token signed for another country is refused.
 */
export function countryAdminApiConfigured(): boolean {
  return Boolean(process.env.CENTRAL_ADMIN_VERIFY_KEY?.trim() && process.env.CENTRAL_ADMIN_VERIFY_KEY_ID?.trim());
}

let service: Promise<CountryAdminService> | null = null;

/** The service for this deployment, or null while the API is not configured. */
export function countryAdminService(): Promise<CountryAdminService> | null {
  if (!countryAdminApiConfigured()) return null;
  service ??= (async () => {
    const keyId = (process.env.CENTRAL_ADMIN_VERIFY_KEY_ID as string).trim();
    // Read as pasted: line breaks as "\n", quotes or a missing BEGIN line are all accepted (normalizePem).
    const publicKeyPem = process.env.CENTRAL_ADMIN_VERIFY_KEY as string;
    const verifier = await createServiceTokenVerifier({
      countryCode: ACTIVE_COUNTRY.code,
      publicKeysPem: { [keyId]: publicKeyPem },
      // A token is accepted once per server instance. Changes are also
      // idempotent in the database (migration 0006), which is what holds
      // across instances.
      seenBefore: createMemoryReplayGuard(),
    });
    // The sample catalogue has no orders: the service then answers the
    // health check and refuses everything else.
    return { countryCode: ACTIVE_COUNTRY.code, verifier, db: dataSource() === "database" ? getDb() : null };
  })();
  // A key that cannot be read must not be remembered as the answer for good.
  service.catch(() => {
    service = null;
  });
  return service;
}
