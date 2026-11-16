import { z } from "zod";
import type { ServiceTokenSigner } from "./service-token";

/**
 * Country admin API, version 1: what the Central Admin may ask a country's
 * backend. The Central Admin never connects to a country's database; it
 * calls these endpoints, each request signed (service-token.ts) and each
 * endpoint tied to one permission.
 *
 * Both ends are compiled against this file: the country side
 * (@tronic/database/country-admin, served by the storefront) answers with
 * these shapes and the admin's adapter below accepts nothing else.
 *
 * A refusal that is about the business (an order that does not exist, a
 * status the order cannot move to) is a normal 200 answer with
 * `ok: false` and a code. Anything else that is not a 200 means the
 * country could not be asked, and is reported as "unavailable".
 */
export const COUNTRY_ADMIN_API_PREFIX = "/api/admin/v1";

export const COUNTRY_ADMIN_ENDPOINTS = {
  health: { method: "GET", path: "/health", permission: "settings.read" },
  listOrders: { method: "GET", path: "/orders", permission: "orders.read" },
  getOrder: { method: "GET", path: "/orders/:orderNumber", permission: "orders.read" },
  updateOrderStatus: { method: "POST", path: "/orders/:orderNumber/status", permission: "orders.update" },
  addOrderNote: { method: "POST", path: "/orders/:orderNumber/notes", permission: "orders.update" },
} as const;

export type CountryAdminEndpoint = keyof typeof COUNTRY_ADMIN_ENDPOINTS;

// ------------------------------------------------------------------ health --

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

// ------------------------------------------------------------------ orders --

/** The order statuses of a country database (migration 0004), in lifecycle order. */
export const ORDER_STATUSES = ["pending_payment", "confirmed", "processing", "packed", "dispatched", "in_transit", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_NUMBER_PATTERN = /^[A-Z]{2}-[0-9]{6}-[A-Z0-9]{8}$/;
export const ORDER_PAGE_SIZE = 25;
export const ORDER_NOTE_MAX = 1000;
export const ORDER_STATUS_NOTE_MAX = 300;

const orderStatus = z.enum(ORDER_STATUSES);
const minor = z.number().int().nonnegative();
const money = { currency: z.string().regex(/^[A-Z]{3}$/), currencyExponent: z.number().int().min(0).max(3) };

export const orderSummarySchema = z.object({
  orderNumber: z.string().regex(ORDER_NUMBER_PATTERN),
  createdAt: z.string().datetime(),
  status: orderStatus,
  paymentStatus: z.string(),
  contactName: z.string(),
  deliveryRegion: z.string().nullable(),
  itemCount: z.number().int().nonnegative(),
  totalMinor: minor,
  ...money,
});

export const orderListResponseSchema = z.object({
  ok: z.literal(true),
  /** Orders matching the status and search, over all pages. */
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  /** Number of the country's orders in each status, whatever the filter. */
  counts: z.partialRecord(orderStatus, z.number().int().nonnegative()),
  orders: z.array(orderSummarySchema),
});

export const orderDetailSchema = z.object({
  orderNumber: z.string().regex(ORDER_NUMBER_PATTERN),
  createdAt: z.string().datetime(),
  status: orderStatus,
  paymentStatus: z.string(),
  paymentMethod: z.string(),
  /** True when the order was placed from a customer account, false for guest checkout. */
  registeredCustomer: z.boolean(),
  contact: z.object({ name: z.string(), email: z.string(), phone: z.string() }),
  delivery: z.object({
    method: z.string(),
    region: z.string().nullable(),
    district: z.string().nullable(),
    ward: z.string().nullable(),
    street: z.string().nullable(),
    extra: z.string().nullable(),
    notes: z.string().nullable(),
  }),
  ...money,
  subtotalMinor: minor,
  /** Null while no delivery fee has been set for the order. */
  deliveryFeeMinor: minor.nullable(),
  totalMinor: minor,
  /** The statuses this order may move to now; empty when it is finished. */
  nextStatuses: z.array(orderStatus),
  lines: z.array(
    z.object({
      lineNo: z.number().int(),
      sku: z.string(),
      name: z.string(),
      color: z.string().nullable(),
      variant: z.string().nullable(),
      quantity: z.number().int().positive(),
      unitPriceMinor: minor,
      lineTotalMinor: minor,
    }),
  ),
  events: z.array(
    z.object({ fromStatus: orderStatus, toStatus: orderStatus, note: z.string().nullable(), actorId: z.string().uuid(), createdAt: z.string().datetime() }),
  ),
  notes: z.array(z.object({ body: z.string(), actorId: z.string().uuid(), createdAt: z.string().datetime() })),
});

export const orderDetailResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), order: orderDetailSchema }),
  z.object({ ok: z.literal(false), code: z.literal("not_found") }),
]);

export const orderStatusChangeResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), replayed: z.boolean(), from: orderStatus, status: orderStatus, paymentStatus: z.string() }),
  z.object({
    ok: z.literal(false),
    code: z.enum(["not_found", "invalid_request", "invalid_transition"]),
    /** With invalid_transition: where the order is now and where it may go. */
    status: orderStatus.optional(),
    nextStatuses: z.array(orderStatus).optional(),
  }),
]);

export const orderNoteResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), replayed: z.boolean() }),
  z.object({ ok: z.literal(false), code: z.enum(["not_found", "invalid_request"]) }),
]);

/** What the admin sends. The country validates these again. */
export const orderListQuerySchema = z.object({
  status: orderStatus.optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});
export const orderStatusChangeBodySchema = z.object({ status: orderStatus, note: z.string().trim().max(ORDER_STATUS_NOTE_MAX).optional() });
export const orderNoteBodySchema = z.object({ body: z.string().trim().min(1).max(ORDER_NOTE_MAX) });

export type OrderSummary = z.infer<typeof orderSummarySchema>;
export type OrderList = z.infer<typeof orderListResponseSchema>;
export type OrderDetail = z.infer<typeof orderDetailSchema>;
export type OrderDetailResponse = z.infer<typeof orderDetailResponseSchema>;
export type OrderStatusChange = z.infer<typeof orderStatusChangeResponseSchema>;
export type OrderNoteResult = z.infer<typeof orderNoteResponseSchema>;
export type OrderListQuery = { status?: OrderStatus; q?: string; page?: number };

// ----------------------------------------------------------------- adapter --

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

/** Every call names the administrator it is made for (their Central Admin user id). */
export interface CountryAdminApi {
  health(actorId: string): Promise<CountryApiResult<CountryHealth>>;
  listOrders(actorId: string, query?: OrderListQuery): Promise<CountryApiResult<OrderList>>;
  getOrder(actorId: string, orderNumber: string): Promise<CountryApiResult<OrderDetailResponse>>;
  updateOrderStatus(actorId: string, orderNumber: string, change: { status: OrderStatus; note?: string }): Promise<CountryApiResult<OrderStatusChange>>;
  addOrderNote(actorId: string, orderNumber: string, body: string): Promise<CountryApiResult<OrderNoteResult>>;
}

/** A country whose service cannot be called. Every request answers with the reason; nothing is sent anywhere. */
export function unavailableCountryApi(reason: CountryUnavailableReason): CountryAdminApi {
  const answer = async () => ({ available: false as const, reason, statusCode: null, latencyMs: null });
  return { health: answer, listOrders: answer, getOrder: answer, updateOrderStatus: answer, addOrderNote: answer };
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
 * carry the signed request to another host) and are never retried here: a
 * change that timed out may have been applied, so the caller reads the
 * order again instead of repeating it blindly.
 */
export function createCountryAdminApi(options: CountryAdminApiOptions): CountryAdminApi {
  const base = new URL(options.baseUrl);
  const loopback = base.hostname === "127.0.0.1" || base.hostname === "localhost";
  if (base.protocol !== "https:" && !(options.allowInsecureLoopback && loopback && base.protocol === "http:")) {
    throw new Error("country admin API: the service address must use HTTPS");
  }
  const doFetch = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8000;
  const prefix = `${base.pathname.replace(/\/+$/, "")}${COUNTRY_ADMIN_API_PREFIX}`;

  async function call<T>(
    endpoint: CountryAdminEndpoint,
    schema: z.ZodType<T>,
    actorId: string,
    request: { params?: Record<string, string>; query?: Record<string, string | undefined>; body?: unknown } = {},
  ): Promise<CountryApiResult<T>> {
    const { method, path, permission } = COUNTRY_ADMIN_ENDPOINTS[endpoint];
    let fullPath = prefix + path.replace(/:([a-zA-Z]+)/g, (_match, name: string) => encodeURIComponent(request.params?.[name] ?? ""));
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(request.query ?? {})) if (value !== undefined && value !== "") search.set(key, value);
    if (search.size > 0) fullPath += `?${search.toString()}`;
    const body = request.body === undefined ? "" : JSON.stringify(request.body);

    const started = Date.now();
    const elapsed = () => Date.now() - started;
    let response: Response;
    try {
      const token = await options.signer.sign({ countryCode: options.countryCode, actorId, permission, method, path: fullPath, body });
      response = await doFetch(new URL(fullPath, base.origin), {
        method,
        headers: { authorization: `Bearer ${token}`, accept: "application/json", ...(body ? { "content-type": "application/json" } : {}) },
        ...(body ? { body } : {}),
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
    listOrders(actorId, query = {}) {
      return call("listOrders", orderListResponseSchema, actorId, {
        query: { status: query.status, q: query.q, page: query.page && query.page > 1 ? String(query.page) : undefined },
      });
    },
    getOrder(actorId, orderNumber) {
      return call("getOrder", orderDetailResponseSchema, actorId, { params: { orderNumber } });
    },
    updateOrderStatus(actorId, orderNumber, change) {
      return call("updateOrderStatus", orderStatusChangeResponseSchema, actorId, {
        params: { orderNumber },
        body: { status: change.status, ...(change.note ? { note: change.note } : {}) },
      });
    },
    addOrderNote(actorId, orderNumber, body) {
      return call("addOrderNote", orderNoteResponseSchema, actorId, { params: { orderNumber }, body: { body } });
    },
  };
}
