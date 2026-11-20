import {
  COUNTRY_ADMIN_API_PREFIX,
  COUNTRY_ADMIN_ENDPOINTS,
  DELIVERY_ACTIONS,
  DELIVERY_PROOF_KINDS,
  LOW_STOCK_THRESHOLD,
  customerListQuerySchema,
  riderLocationBodySchema,
  type CountrySummary,
  deliveryAssignBodySchema,
  deliveryUpdateBodySchema,
  ORDER_NUMBER_PATTERN,
  ORDER_PAGE_SIZE,
  orderListQuerySchema,
  orderNoteBodySchema,
  orderStatusChangeBodySchema,
  PRODUCT_SLUG_PATTERN,
  brandSaveBodySchema,
  reportPeriodQuerySchema,
  categoryBannerBodySchema,
  taxonomySaveBodySchema,
  inventoryListQuerySchema,
  lowStockBodySchema,
  stockAdjustBodySchema,
  productCreateBodySchema,
  productImageArrangeBodySchema,
  productImageBodySchema,
  productListQuerySchema,
  productStatusBodySchema,
  productStockBodySchema,
  productUpdateBodySchema,
  type CountryAdminEndpoint,
  type CountryHealth,
  type OrderDetailResponse,
  type OrderList,
  type OrderNoteResult,
  type OrderStatusChange,
  type ServiceTokenVerifier,
} from "@tronic/api-contracts";
import type { Db, Row } from "../db";
import { customerFunctions } from "./customers";
import { deliveryFunctions } from "./deliveries";
import { categoryFunctions } from "./categories";
import { inventoryFunctions } from "./inventory";
import { productFunctions } from "./products";
import { reportFunctions } from "./reports";

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
const customers = customerFunctions(withServiceAccess);
const products = productFunctions(withServiceAccess);
const inventory = inventoryFunctions(withServiceAccess);

const INVENTORY_ENDPOINTS: ReadonlySet<CountryAdminEndpoint> = new Set(["listInventory", "getInventory", "adjustStock", "setLowStock"]);
const categories = categoryFunctions(withServiceAccess);
const CATEGORY_ENDPOINTS: ReadonlySet<CountryAdminEndpoint> = new Set(["categoryTree", "saveTaxonomy", "setCategoryBanner", "getCategoryBanner", "saveBrand"]);
const reports = reportFunctions(withServiceAccess);
const REPORT_ENDPOINTS: ReadonlySet<CountryAdminEndpoint> = new Set(["salesReport", "productsReport", "ordersReport", "stockReport"]);

const PRODUCT_ENDPOINTS: ReadonlySet<CountryAdminEndpoint> = new Set([
  "catalogueOptions",
  "listProducts",
  "createProduct",
  "getProduct",
  "updateProduct",
  "setProductStatus",
  "setProductStock",
  "addProductImage",
  "arrangeProductImages",
  "getProductImage",
]);

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

    if (matched.endpoint === "summary") {
      const [row] = await withServiceAccess(db, (tx) =>
        tx.query<Row>(`select admin_country_summary($1::char(2), $2) as result`, [countryCode, LOW_STOCK_THRESHOLD]),
      );
      const s = parseJson(row?.result);
      if (!s) throw new Error("admin_country_summary returned nothing");
      const statuses = parseJson(s.orders_by_status) ?? {};
      const body: CountrySummary = {
        ok: true,
        currency: String(s.currency),
        currencyExponent: int(s.currency_exponent),
        ordersTotal: int(s.orders_total),
        ordersToday: int(s.orders_today),
        ordersOpen: int(s.orders_open),
        ordersByStatus: Object.fromEntries(Object.entries(statuses).map(([status, n]) => [status, int(n)])),
        sales30DaysMinor: int(s.sales_30_days_minor),
        customerAccounts: int(s.customer_accounts),
        productsActive: int(s.products_active),
        productsOutOfStock: int(s.products_out_of_stock),
        productsLowStock: int(s.products_low_stock),
        lowStockThreshold: int(s.low_stock_threshold),
      };
      return { status: 200, body };
    }

    if (matched.endpoint === "listCustomers") {
      const query = customerListQuerySchema.safeParse(Object.fromEntries(url.searchParams));
      if (!query.success) return refuse(400, "invalid_request");
      return { status: 200, body: await customers.list(db, countryCode, query.data) };
    }
    if (matched.endpoint === "getCustomer") {
      const customerId = matched.params.customerId ?? "";
      if (!UUID.test(customerId)) return { status: 200, body: { ok: false, code: "not_found" } };
      return { status: 200, body: await customers.get(db, countryCode, customerId.toLowerCase()) };
    }
    if (matched.endpoint === "riderFigures") {
      return { status: 200, body: await deliveries.riderFigures(db, countryCode) };
    }
    if (matched.endpoint === "riderDeliveries") {
      const riderId = matched.params.riderId ?? "";
      if (!UUID.test(riderId)) return refuse(400, "invalid_request");
      return { status: 200, body: await deliveries.riderDeliveries(db, countryCode, riderId.toLowerCase()) };
    }

    // Products (migration 0016).
    if (PRODUCT_ENDPOINTS.has(matched.endpoint)) {
      if (matched.endpoint === "catalogueOptions") return { status: 200, body: await products.options(db, countryCode) };
      if (matched.endpoint === "listProducts") {
        const query = productListQuerySchema.safeParse(Object.fromEntries(url.searchParams));
        if (!query.success) return refuse(400, "invalid_request");
        return { status: 200, body: await products.list(db, countryCode, query.data) };
      }
      let input: unknown = null;
      if (method === "POST") {
        try {
          input = JSON.parse(request.body);
        } catch {
          return refuse(400, "invalid_request");
        }
      }
      // The token id is the request id: the same signed request changes a product once.
      const change = { actorId: verified.actorId, requestId: verified.tokenId };
      if (matched.endpoint === "createProduct") {
        const body = productCreateBodySchema.safeParse(input);
        if (!body.success) return { status: 200, body: { ok: false, code: "invalid_request" } };
        return { status: 200, body: await products.create(db, countryCode, body.data.slug, body.data.product, change.actorId, change.requestId) };
      }
      const slug = (matched.params.slug ?? "").toLowerCase();
      if (!PRODUCT_SLUG_PATTERN.test(slug) || slug.length > 80) return { status: 200, body: { ok: false, code: "not_found" } };
      switch (matched.endpoint) {
        case "getProduct":
          return { status: 200, body: await products.get(db, countryCode, slug) };
        case "getProductImage": {
          const imageId = matched.params.imageId ?? "";
          if (!UUID.test(imageId)) return { status: 200, body: { ok: false, code: "not_found" } };
          return { status: 200, body: await products.getImage(db, countryCode, slug, imageId.toLowerCase()) };
        }
        case "updateProduct": {
          const body = productUpdateBodySchema.safeParse(input);
          if (!body.success) return { status: 200, body: { ok: false, code: "invalid_request" } };
          return { status: 200, body: await products.update(db, countryCode, slug, body.data.product, change.actorId, change.requestId) };
        }
        case "setProductStatus": {
          const body = productStatusBodySchema.safeParse(input);
          if (!body.success) return { status: 200, body: { ok: false, code: "invalid_request" } };
          return { status: 200, body: await products.setStatus(db, countryCode, slug, body.data.publish, change.actorId, change.requestId) };
        }
        case "setProductStock": {
          const body = productStockBodySchema.safeParse(input);
          if (!body.success) return { status: 200, body: { ok: false, code: "invalid_request" } };
          return { status: 200, body: await products.setStock(db, countryCode, slug, body.data.available, change.actorId, change.requestId) };
        }
        case "addProductImage": {
          const body = productImageBodySchema.safeParse(input);
          if (!body.success) return { status: 200, body: { ok: false, code: "invalid_request" } };
          return { status: 200, body: await products.addImage(db, countryCode, slug, body.data, change.actorId, change.requestId) };
        }
        case "arrangeProductImages": {
          const body = productImageArrangeBodySchema.safeParse(input);
          if (!body.success) return { status: 200, body: { ok: false, code: "invalid_request" } };
          const keep = body.data.keep.map((id) => id.toLowerCase());
          return { status: 200, body: await products.arrangeImages(db, countryCode, slug, keep, change.actorId, change.requestId) };
        }
      }
    }

    // Reports (migration 0019), read only.
    if (REPORT_ENDPOINTS.has(matched.endpoint)) {
      const period = reportPeriodQuerySchema.safeParse(Object.fromEntries(url.searchParams));
      if (!period.success) return refuse(400, "invalid_request");
      const body =
        matched.endpoint === "salesReport"
          ? await reports.sales(db, countryCode, period.data)
          : matched.endpoint === "productsReport"
            ? await reports.products(db, countryCode, period.data)
            : matched.endpoint === "ordersReport"
              ? await reports.orders(db, countryCode, period.data)
              : await reports.stock(db, countryCode, period.data);
      return { status: 200, body };
    }

    // Categories and brands (migration 0018).
    if (CATEGORY_ENDPOINTS.has(matched.endpoint)) {
      if (matched.endpoint === "categoryTree") return { status: 200, body: await categories.tree(db, countryCode) };
      if (matched.endpoint === "getCategoryBanner") {
        const categoryId = matched.params.categoryId ?? "";
        if (!UUID.test(categoryId)) return { status: 200, body: { ok: false, code: "not_found" } };
        return { status: 200, body: await categories.getBanner(db, countryCode, categoryId.toLowerCase()) };
      }
      let input: unknown;
      try {
        input = JSON.parse(request.body);
      } catch {
        return refuse(400, "invalid_request");
      }
      // The token id is the request id: the same signed request changes the catalogue once.
      if (matched.endpoint === "saveTaxonomy") {
        const body = taxonomySaveBodySchema.safeParse(input);
        if (!body.success) return { status: 200, body: { ok: false, code: "invalid_request" } };
        return { status: 200, body: await categories.save(db, countryCode, body.data, verified.actorId, verified.tokenId) };
      }
      if (matched.endpoint === "saveBrand") {
        const body = brandSaveBodySchema.safeParse(input);
        if (!body.success) return { status: 200, body: { ok: false, code: "invalid_request" } };
        return { status: 200, body: await categories.saveBrand(db, countryCode, body.data, verified.actorId, verified.tokenId) };
      }
      const categoryId = matched.params.categoryId ?? "";
      const body = categoryBannerBodySchema.safeParse(input);
      if (!UUID.test(categoryId) || !body.success) return { status: 200, body: { ok: false, code: "invalid_request" } };
      return { status: 200, body: await categories.setBanner(db, countryCode, categoryId.toLowerCase(), body.data, verified.actorId, verified.tokenId) };
    }

    // Inventory (migration 0017).
    if (INVENTORY_ENDPOINTS.has(matched.endpoint)) {
      if (matched.endpoint === "listInventory") {
        const query = inventoryListQuerySchema.safeParse(Object.fromEntries(url.searchParams));
        if (!query.success) return refuse(400, "invalid_request");
        return { status: 200, body: await inventory.list(db, countryCode, query.data) };
      }
      const slug = (matched.params.slug ?? "").toLowerCase();
      if (!PRODUCT_SLUG_PATTERN.test(slug) || slug.length > 80) return { status: 200, body: { ok: false, code: "not_found" } };
      if (matched.endpoint === "getInventory") return { status: 200, body: await inventory.get(db, countryCode, slug) };
      let input: unknown;
      try {
        input = JSON.parse(request.body);
      } catch {
        return refuse(400, "invalid_request");
      }
      if (matched.endpoint === "adjustStock") {
        const body = stockAdjustBodySchema.safeParse(input);
        if (!body.success) return { status: 200, body: { ok: false, code: "invalid_request" } };
        // The token id is the request id: the same signed request changes the stock once.
        return { status: 200, body: await inventory.adjust(db, countryCode, slug, body.data, verified.actorId, verified.tokenId) };
      }
      const body = lowStockBodySchema.safeParse(input);
      if (!body.success) return { status: 200, body: { ok: false, code: "invalid_request" } };
      return { status: 200, body: await inventory.setLowStock(db, countryCode, slug, body.data.level) };
    }

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
    if (matched.endpoint === "reportLocation") {
      const location = riderLocationBodySchema.safeParse(json);
      if (!location.success) return { status: 200, body: { ok: false, code: "invalid_request" } };
      return { status: 200, body: await deliveries.reportLocation(db, countryCode, orderNumber, verified.actorId, location.data) };
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
      if (matched.endpoint === "summary") return refuse(503, "summary_missing");
      if (matched.endpoint === "reportLocation") return refuse(503, "tracking_missing");
      if (matched.endpoint === "riderFigures" || matched.endpoint === "riderDeliveries") return refuse(503, "rider_figures_missing");
      if (matched.endpoint === "listCustomers" || matched.endpoint === "getCustomer") return refuse(503, "customers_missing");
      if (PRODUCT_ENDPOINTS.has(matched.endpoint)) return refuse(503, "products_missing");
      if (INVENTORY_ENDPOINTS.has(matched.endpoint)) return refuse(503, "inventory_missing");
      if (CATEGORY_ENDPOINTS.has(matched.endpoint)) return refuse(503, "categories_missing");
      if (REPORT_ENDPOINTS.has(matched.endpoint)) return refuse(503, "reports_missing");
      const deliveryEndpoint = COUNTRY_ADMIN_ENDPOINTS[matched.endpoint].permission.startsWith("deliveries.");
      return refuse(503, deliveryEndpoint ? "delivery_admin_missing" : "order_admin_missing");
    }
    if (code === "42501") return refuse(503, "database_permission");
    console.error("country admin API: request failed", { endpoint: matched.endpoint, error: error instanceof Error ? error.name : "unknown", code });
    return refuse(500, "server_error");
  }
}
