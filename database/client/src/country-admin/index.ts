import {
  COUNTRY_ADMIN_API_PREFIX,
  COUNTRY_ADMIN_ENDPOINTS,
  DELIVERY_ACTIONS,
  DELIVERY_PROOF_KINDS,
  deliveryAssignBodySchema,
  deliveryUpdateBodySchema,
  ORDER_NUMBER_PATTERN,
  ORDER_PAGE_SIZE,
  orderListQuerySchema,
  orderNoteBodySchema,
  orderStatusChangeBodySchema,
  type CountryAdminEndpoint,
  type CountryHealth,
  type OrderDetailResponse,
  type OrderList,
  type OrderNoteResult,
  type OrderStatusChange,
  type ServiceTokenVerifier,
} from "@tronic/api-contracts";
import type { Db, Row } from "../db";
import { deliveryFunctions } from "./deliveries";

/**
 * The country side of the country admin API (apis/src/country-admin-api.ts):
 * what a country's backend does with a request from the Central Admin.
 *
 * It is one function from a request to a response, with no web framework
 * in it, so the storefront's route handler and the tests run exactly the
 * same code. For every request it:
 *   1. finds the endpoint and the one permission that endpoint requires;
 *   2. verifies the signed token against that permission, this country and
 *      the exact method, path and body received (a country id in the
 *      request is never read, let alone trusted);
 *   3. validates the input;
 *   4. runs the database function of migration 0006 as service_role, with
 *      the deployment's own country code and the administrator from the
 *      token.
 */

/** Runs `fn` in one transaction as Supabase's service_role, the only role that may execute the admin functions. */
export async function withServiceAccess<T>(db: Db, fn: (tx: Db) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query("set local role service_role");
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "service_role" })]);
    return fn(tx);
  });
}

const deliveries = deliveryFunctions(withServiceAccess);

type Json = Record<string, unknown>;

function parseJson(value: unknown): Json | null {
  const parsed: unknown = typeof value === "string" ? JSON.parse(value) : value;
  if (parsed === null || parsed === undefined) return null;
  if (typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Json;
  throw new Error("Unexpected database function result");
}

const iso = (value: unknown): string => new Date(String(value)).toISOString();
const text = (value: unknown): string | null => (typeof value === "string" ? value : null);
const int = (value: unknown): number => {
  const n = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : typeof value === "bigint" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isSafeInteger(n) || n < 0) throw new Error("Unexpected database value: expected a non-negative integer");
  return n;
};
const list = (value: unknown): Json[] => (Array.isArray(value) ? (value as Json[]) : []);

async function callFunction(db: Db, sql: string, params: readonly unknown[]): Promise<Json | null> {
  const [row] = await withServiceAccess(db, (tx) => tx.query<Row>(sql, params));
  return parseJson(row?.result);
}

// --------------------------------------------------------------- database --

export async function listOrdersForAdmin(
  db: Db,
  country: string,
  query: { status?: string | undefined; q?: string | undefined; page: number },
): Promise<OrderList> {
  const result = await callFunction(db, `select admin_list_orders($1::char(2), $2, $3, $4::integer, $5::integer) as result`, [
    country,
    query.status ?? null,
    query.q ?? null,
    ORDER_PAGE_SIZE,
    (query.page - 1) * ORDER_PAGE_SIZE,
  ]);
  if (!result) throw new Error("admin_list_orders returned nothing");
  const counts = (result.counts ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    total: int(result.total),
    page: query.page,
    pageSize: ORDER_PAGE_SIZE,
    counts: Object.fromEntries(Object.entries(counts).map(([status, count]) => [status, int(count)])) as OrderList["counts"],
    orders: list(result.orders).map((order) => ({
      orderNumber: String(order.order_number),
      createdAt: iso(order.created_at),
      status: order.status as OrderList["orders"][number]["status"],
      paymentStatus: String(order.payment_status),
      contactName: String(order.contact_name),
      deliveryRegion: text(order.delivery_region),
      itemCount: int(order.item_count),
      totalMinor: int(order.total_minor),
      currency: String(order.currency).trim(),
      currencyExponent: int(order.currency_exponent),
    })),
  };
}

export async function getOrderForAdmin(db: Db, country: string, orderNumber: string): Promise<OrderDetailResponse> {
  const order = await callFunction(db, `select admin_get_order($1::char(2), $2) as result`, [country, orderNumber]);
  if (!order) return { ok: false, code: "not_found" };
  const contact = (order.contact ?? {}) as Json;
  const delivery = (order.delivery ?? {}) as Json;
  type Detail = Extract<OrderDetailResponse, { ok: true }>["order"];
  return {
    ok: true,
    order: {
      orderNumber: String(order.order_number),
      createdAt: iso(order.created_at),
      status: order.status as Detail["status"],
      paymentStatus: String(order.payment_status),
      paymentMethod: String(order.payment_method),
      registeredCustomer: order.registered_customer === true,
      contact: { name: String(contact.name), email: String(contact.email), phone: String(contact.phone) },
      delivery: {
        method: String(delivery.method),
        region: text(delivery.region),
        district: text(delivery.district),
        ward: text(delivery.ward),
        street: text(delivery.street),
        extra: text(delivery.extra),
        notes: text(delivery.notes),
      },
      currency: String(order.currency).trim(),
      currencyExponent: int(order.currency_exponent),
      subtotalMinor: int(order.subtotal_minor),
      deliveryFeeMinor: order.delivery_fee_minor === null || order.delivery_fee_minor === undefined ? null : int(order.delivery_fee_minor),
      totalMinor: int(order.total_minor),
      nextStatuses: (Array.isArray(order.next_statuses) ? order.next_statuses : []) as Detail["nextStatuses"],
      lines: list(order.lines).map((line) => ({
        lineNo: int(line.line_no),
        sku: String(line.sku),
        name: String(line.name),
        color: text(line.color),
        variant: text(line.variant),
        quantity: int(line.quantity),
        unitPriceMinor: int(line.unit_price_minor),
        lineTotalMinor: int(line.line_total_minor),
      })),
      events: list(order.events).map((event) => ({
        fromStatus: event.from_status as Detail["status"],
        toStatus: event.to_status as Detail["status"],
        note: text(event.note),
        actorId: String(event.actor_id),
        createdAt: iso(event.created_at),
      })),
      notes: list(order.notes).map((note) => ({ body: String(note.body), actorId: String(note.actor_id), createdAt: iso(note.created_at) })),
    },
  };
}

export async function updateOrderStatusForAdmin(
  db: Db,
  country: string,
  orderNumber: string,
  change: { status: string; note?: string | undefined; actorId: string; requestId: string },
): Promise<OrderStatusChange> {
  const result = await callFunction(db, `select admin_update_order_status($1::char(2), $2, $3, $4, $5::uuid, $6::uuid) as result`, [
    country,
    orderNumber,
    change.status,
    change.note ?? null,
    change.actorId,
    change.requestId,
  ]);
  if (!result) throw new Error("admin_update_order_status returned nothing");
  type Ok = Extract<OrderStatusChange, { ok: true }>;
  type Refused = Extract<OrderStatusChange, { ok: false }>;
  if (result.ok === true) {
    return {
      ok: true,
      replayed: result.replayed === true,
      from: result.from as Ok["from"],
      status: result.status as Ok["status"],
      paymentStatus: String(result.payment_status),
    };
  }
  const code = result.code === "not_found" || result.code === "invalid_transition" ? result.code : "invalid_request";
  return {
    ok: false,
    code,
    ...(typeof result.status === "string" ? { status: result.status as NonNullable<Refused["status"]> } : {}),
    ...(Array.isArray(result.next_statuses) ? { nextStatuses: result.next_statuses as NonNullable<Refused["nextStatuses"]> } : {}),
  };
}

export async function addOrderNoteForAdmin(
  db: Db,
  country: string,
  orderNumber: string,
  note: { body: string; actorId: string; requestId: string },
): Promise<OrderNoteResult> {
  const result = await callFunction(db, `select admin_add_order_note($1::char(2), $2, $3, $4::uuid, $5::uuid) as result`, [
    country,
    orderNumber,
    note.body,
    note.actorId,
    note.requestId,
  ]);
  if (!result) throw new Error("admin_add_order_note returned nothing");
  if (result.ok === true) return { ok: true, replayed: result.replayed === true };
  return { ok: false, code: result.code === "not_found" ? "not_found" : "invalid_request" };
}

// ---------------------------------------------------------------- requests --

export interface CountryAdminService {
  /** ISO code of the country this deployment serves, from its own configuration. */
  countryCode: string;
  verifier: ServiceTokenVerifier;
  /** Null while the deployment runs on the sample catalogue: there are no orders to administer. */
  db: Db | null;
}

export interface CountryAdminRequest {
  method: string;
  /** Path and query as received, e.g. "/api/admin/v1/orders?status=packed". */
  path: string;
  authorization: string | null | undefined;
  /** The exact body text received; "" when there is none. */
  body: string;
}

export interface CountryAdminResponse {
  status: number;
  body: unknown;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function route(method: string, pathname: string): { endpoint: CountryAdminEndpoint; params: Record<string, string> } | null {
  if (!pathname.startsWith(`${COUNTRY_ADMIN_API_PREFIX}/`)) return null;
  const segments = pathname.slice(COUNTRY_ADMIN_API_PREFIX.length).split("/").filter(Boolean);
  for (const [endpoint, definition] of Object.entries(COUNTRY_ADMIN_ENDPOINTS) as [CountryAdminEndpoint, (typeof COUNTRY_ADMIN_ENDPOINTS)[CountryAdminEndpoint]][]) {
    const pattern = definition.path.split("/").filter(Boolean);
    if (definition.method !== method || pattern.length !== segments.length) continue;
    const params: Record<string, string> = {};
    const matches = pattern.every((part, index) => {
      const segment = segments[index] as string;
      if (!part.startsWith(":")) return part === segment;
      try {
        params[part.slice(1)] = decodeURIComponent(segment);
        return true;
      } catch {
        return false;
      }
    });
    if (matches) return { endpoint, params };
  }
  return null;
}

const refuse = (status: number, code: string): CountryAdminResponse => ({ status, body: { ok: false, code } });

/** Answers one request of the country admin API. Never throws for bad input; a database failure is a 500 without detail. */
export async function handleCountryAdminRequest(service: CountryAdminService, request: CountryAdminRequest): Promise<CountryAdminResponse> {
  const method = request.method.toUpperCase();
  let url: URL;
  try {
    url = new URL(request.path, "https://country.invalid");
  } catch {
    return refuse(404, "not_found");
  }
  const matched = route(method, url.pathname);
  if (!matched) return refuse(404, "not_found");

  const verified = await service.verifier.verify({
    authorization: request.authorization,
    requiredPermission: COUNTRY_ADMIN_ENDPOINTS[matched.endpoint].permission,
    method,
    path: request.path,
    body: request.body,
  });
  if (!verified.ok) return refuse(401, verified.reason);
  if (!UUID.test(verified.actorId) || !UUID.test(verified.tokenId)) return refuse(401, "malformed");

  const { db, countryCode } = service;
  try {
    if (matched.endpoint === "health") {
      // Asks, as the role the order functions run as, whether they exist:
      // the check proves the role switch and the migration together.
      let database: boolean | null = null;
      let orderAdmin: boolean | null = null;
      if (db) {
        try {
          const [row] = await withServiceAccess(db, (tx) =>
            tx.query<{ installed: boolean }>(
              `select to_regprocedure('public.admin_list_orders(character,text,text,integer,integer)') is not null as installed`,
            ),
          );
          database = true;
          orderAdmin = row?.installed === true;
        } catch {
          database = false;
        }
      }
      const body: CountryHealth = {
        ok: true,
        country: countryCode,
        dataSource: db ? "database" : "mock",
        database,
        orderAdmin,
        time: new Date().toISOString(),
      };
      return { status: 200, body };
    }

    // Everything below works on orders, which exist only in the database.
    if (!db) return refuse(503, "orders_not_connected");
    const orderNumber = (matched.params.orderNumber ?? "").toUpperCase();
    if (matched.endpoint !== "listOrders" && matched.endpoint !== "listMyDeliveries" && !ORDER_NUMBER_PATTERN.test(orderNumber)) {
      return { status: 200, body: { ok: false, code: "not_found" } };
    }

    // Deliveries (migration 0008). A rider endpoint works on the deliveries
    // of the administrator who signed the request, and only those.
    if (matched.endpoint === "listMyDeliveries") {
      return { status: 200, body: await deliveries.listForRider(db, countryCode, verified.actorId) };
    }
    if (matched.endpoint === "getMyDelivery") {
      return { status: 200, body: await deliveries.getForRider(db, countryCode, orderNumber, verified.actorId) };
    }
    if (matched.endpoint === "getDelivery") {
      return { status: 200, body: await deliveries.info(db, countryCode, orderNumber) };
    }
    if (matched.endpoint === "getDeliveryProof") {
      const kind = DELIVERY_PROOF_KINDS.find((candidate) => candidate === matched.params.kind);
      if (!kind) return { status: 200, body: { ok: false, code: "not_found" } };
      return { status: 200, body: await deliveries.proof(db, countryCode, orderNumber, kind) };
    }

    if (matched.endpoint === "listOrders") {
      const query = orderListQuerySchema.safeParse(Object.fromEntries(url.searchParams));
      if (!query.success) return refuse(400, "invalid_request");
      return { status: 200, body: await listOrdersForAdmin(db, countryCode, query.data) };
    }
    if (matched.endpoint === "getOrder") {
      return { status: 200, body: await getOrderForAdmin(db, countryCode, orderNumber) };
    }

    let json: unknown;
    try {
      json = JSON.parse(request.body);
    } catch {
      return refuse(400, "invalid_request");
    }
    if (matched.endpoint === "updateOrderStatus") {
      const change = orderStatusChangeBodySchema.safeParse(json);
      if (!change.success) return { status: 200, body: { ok: false, code: "invalid_request" } };
      const body = await updateOrderStatusForAdmin(db, countryCode, orderNumber, {
        status: change.data.status,
        note: change.data.note,
        actorId: verified.actorId,
        // The token id is the request id: the same signed request can change an order once.
        requestId: verified.tokenId,
      });
      return { status: 200, body };
    }
    if (matched.endpoint === "assignDelivery") {
      const rider = deliveryAssignBodySchema.safeParse(json);
      if (!rider.success) return { status: 200, body: { ok: false, code: "invalid_request" } };
      return { status: 200, body: await deliveries.assign(db, countryCode, orderNumber, rider.data, verified.actorId) };
    }
    if (matched.endpoint === "updateMyDelivery") {
      const action = DELIVERY_ACTIONS.find((candidate) => candidate === matched.params.action);
      const update = deliveryUpdateBodySchema.safeParse(json);
      if (!action || !update.success) return { status: 200, body: { ok: false, code: "invalid_request" } };
      return {
        status: 200,
        // The token id is the request id: the same signed request changes a delivery once.
        body: await deliveries.updateForRider(db, countryCode, orderNumber, verified.actorId, action, update.data, verified.tokenId),
      };
    }
    const note = orderNoteBodySchema.safeParse(json);
    if (!note.success) return { status: 200, body: { ok: false, code: "invalid_request" } };
    const body = await addOrderNoteForAdmin(db, countryCode, orderNumber, { body: note.data.body, actorId: verified.actorId, requestId: verified.tokenId });
    return { status: 200, body };
  } catch (error) {
    // Two set-up faults are named, so an owner knows what to do: the order
    // functions are not installed (migration 0006), or the database refused
    // the role they run as. The answer carries the code, never the message.
    const code = typeof (error as { code?: unknown } | null)?.code === "string" ? (error as { code: string }).code : "";
    if (code === "42883" || code === "42P01") {
      const deliveryEndpoint = COUNTRY_ADMIN_ENDPOINTS[matched.endpoint].permission.startsWith("deliveries.");
      return refuse(503, deliveryEndpoint ? "delivery_admin_missing" : "order_admin_missing");
    }
    if (code === "42501") return refuse(503, "database_permission");
    console.error("country admin API: request failed", { endpoint: matched.endpoint, error: error instanceof Error ? error.name : "unknown", code });
    return refuse(500, "server_error");
  }
}
