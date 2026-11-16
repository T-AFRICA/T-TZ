import { z } from "zod";
import type { ServiceTokenSigner } from "./service-token";

/**
 * Country admin API, version 1: what the Central Admin may ask a country's
 * backend. The Central Admin never connects to a country's database; it
 * calls these endpoints, each request signed (service-token.ts) and each
 * endpoint tied to one permission.
 *
 * Endpoints are added here together with the country-side handler that
 * serves them and the admin screen that uses them. So far there is one:
 * the health check. Nothing in the admin shows a country as connected
 * unless this request was really made and really answered.
 */
export const COUNTRY_ADMIN_API_PREFIX = "/api/admin/v1";

export const COUNTRY_ADMIN_ENDPOINTS = {
  health: { method: "GET", path: `${COUNTRY_ADMIN_API_PREFIX}/health`, permission: "settings.read" },
} as const;

export type CountryAdminEndpoint = keyof typeof COUNTRY_ADMIN_ENDPOINTS;

/** What a country answers to the health check. */
export const healthResponseSchema = z.object({
  ok: z.literal(true),
  /** The country this deployment serves, from its own configuration. */
  country: z.string().regex(/^[A-Z]{2}$/),
  /** Where the country's data comes from: live records or the sample catalogue. */
  dataSource: z.enum(["database", "mock"]),
  /** True when the country's database answered a trivial query; null when there is no database (mock). */
  database: z.boolean().nullable(),
  time: z.string().datetime(),
});

export type CountryHealth = z.infer<typeof healthResponseSchema>;

/** Why a country could not be asked, or did not give a usable answer. */
export type CountryUnavailableReason =
  | "not_configured" // no API address registered for the country
  | "disabled" // registered but switched off
  | "no_iso_code" // the country itself is not confirmed yet
  | "signing_not_configured" // the Central Admin has no signing key
  | "unreachable" // no connection
  | "timeout"
  | "rejected" // the country refused the request (401/403)
  | "not_found" // the country has no such endpoint (404)
  | "server_error" // the country answered 5xx
  | "invalid_response"; // answered, but not with what the contract says

export type CountryApiResult<T> =
  | { available: true; data: T; statusCode: number; latencyMs: number }
  | { available: false; reason: CountryUnavailableReason; statusCode: number | null; latencyMs: number | null };

export interface CountryAdminApi {
  health(actorId: string): Promise<CountryApiResult<CountryHealth>>;
}

/** A country whose service cannot be called. Every request answers with the reason; nothing is sent anywhere. */
export function unavailableCountryApi(reason: CountryUnavailableReason): CountryAdminApi {
  const result = { available: false as const, reason, statusCode: null, latencyMs: null };
  return { health: async () => result };
}

export interface CountryAdminApiOptions {
  /** HTTPS address of the country's service, e.g. "https://tronic.co.tz". */
  baseUrl: string;
  /** ISO code of the country, from the Central Admin's own country record. */
  countryCode: string;
  signer: ServiceTokenSigner;
  fetch?: typeof fetch;
  timeoutMs?: number;
  /** Test only: lets a plain-HTTP loopback address stand in for a country. Never set in a deployment. */
  allowInsecureLoopback?: boolean;
}

function statusReason(status: number): CountryUnavailableReason {
  if (status === 401 || status === 403) return "rejected";
  if (status === 404) return "not_found";
  if (status >= 500) return "server_error";
  return "invalid_response";
}

/**
 * The typed adapter the admin uses to reach one country. Requests go over
 * HTTPS only, with a time limit, never follow redirects (a redirect could
 * carry the signed request to another host) and are never retried here.
 */
export function createCountryAdminApi(options: CountryAdminApiOptions): CountryAdminApi {
  const base = new URL(options.baseUrl);
  const loopback = base.hostname === "127.0.0.1" || base.hostname === "localhost";
  if (base.protocol !== "https:" && !(options.allowInsecureLoopback && loopback && base.protocol === "http:")) {
    throw new Error("country admin API: the service address must use HTTPS");
  }
  const doFetch = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8000;
  const prefix = base.pathname.replace(/\/+$/, "");

  async function call<T>(endpoint: CountryAdminEndpoint, schema: z.ZodType<T>, actorId: string): Promise<CountryApiResult<T>> {
    const { method, path, permission } = COUNTRY_ADMIN_ENDPOINTS[endpoint];
    const fullPath = `${prefix}${path}`;
    const started = Date.now();
    const elapsed = () => Date.now() - started;
    let response: Response;
    try {
      const token = await options.signer.sign({ countryCode: options.countryCode, actorId, permission, method, path: fullPath, body: "" });
      response = await doFetch(new URL(fullPath, base.origin), {
        method,
        headers: { authorization: `Bearer ${token}`, accept: "application/json" },
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      return { available: false, reason: timedOut ? "timeout" : "unreachable", statusCode: null, latencyMs: elapsed() };
    }
    if (response.status !== 200) {
      return { available: false, reason: statusReason(response.status), statusCode: response.status, latencyMs: elapsed() };
    }
    let json: unknown;
    try {
      json = await response.json();
    } catch {
      return { available: false, reason: "invalid_response", statusCode: 200, latencyMs: elapsed() };
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) return { available: false, reason: "invalid_response", statusCode: 200, latencyMs: elapsed() };
    return { available: true, data: parsed.data, statusCode: 200, latencyMs: elapsed() };
  }

  return {
    async health(actorId) {
      const result = await call("health", healthResponseSchema, actorId);
      // A country that answers for another country is not the country that was asked.
      if (result.available && result.data.country !== options.countryCode) {
        return { available: false, reason: "invalid_response", statusCode: result.statusCode, latencyMs: result.latencyMs };
      }
      return result;
    },
  };
}
