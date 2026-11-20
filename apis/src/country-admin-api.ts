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
  // Figures for the country dashboard (migration 0009).
  summary: { method: "GET", path: "/summary", permission: "reports.read" },
  listOrders: { method: "GET", path: "/orders", permission: "orders.read" },
  getOrder: { method: "GET", path: "/orders/:orderNumber", permission: "orders.read" },
  updateOrderStatus: { method: "POST", path: "/orders/:orderNumber/status", permission: "orders.update" },
  addOrderNote: { method: "POST", path: "/orders/:orderNumber/notes", permission: "orders.update" },
  // Deliveries by TRONIC's riders (migration 0008).
  assignDelivery: { method: "POST", path: "/orders/:orderNumber/delivery", permission: "deliveries.assign" },
  getDelivery: { method: "GET", path: "/orders/:orderNumber/delivery", permission: "deliveries.assign" },
  getDeliveryProof: { method: "GET", path: "/orders/:orderNumber/delivery/proofs/:kind", permission: "deliveries.assign" },
  listMyDeliveries: { method: "GET", path: "/deliveries", permission: "deliveries.perform" },
  getMyDelivery: { method: "GET", path: "/deliveries/:orderNumber", permission: "deliveries.perform" },
  // Before updateMyDelivery: "/location" would otherwise match its ":action".
  reportLocation: { method: "POST", path: "/deliveries/:orderNumber/location", permission: "deliveries.perform" },
  updateMyDelivery: { method: "POST", path: "/deliveries/:orderNumber/:action", permission: "deliveries.perform" },
  // Riders' figures for whoever assigns deliveries (migration 0010).
  riderFigures: { method: "GET", path: "/riders", permission: "deliveries.assign" },
  riderDeliveries: { method: "GET", path: "/riders/:riderId", permission: "deliveries.assign" },
  // The customer directory, read only (migration 0011).
  listCustomers: { method: "GET", path: "/customers", permission: "customers.read" },
  getCustomer: { method: "GET", path: "/customers/:customerId", permission: "customers.read" },
  // Products (migration 0016). Nothing is deleted: a product is hidden.
  catalogueOptions: { method: "GET", path: "/catalogue/options", permission: "products.read" },
  listProducts: { method: "GET", path: "/products", permission: "products.read" },
  createProduct: { method: "POST", path: "/products", permission: "products.create" },
  getProduct: { method: "GET", path: "/products/:slug", permission: "products.read" },
  updateProduct: { method: "POST", path: "/products/:slug", permission: "products.update" },
  setProductStatus: { method: "POST", path: "/products/:slug/status", permission: "products.publish" },
  setProductStock: { method: "POST", path: "/products/:slug/stock", permission: "inventory.adjust" },
  addProductImage: { method: "POST", path: "/products/:slug/images", permission: "products.update" },
  arrangeProductImages: { method: "POST", path: "/products/:slug/images/arrange", permission: "products.update" },
  getProductImage: { method: "GET", path: "/products/:slug/images/:imageId", permission: "products.read" },
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
  /**
   * True when the database has the order administration (migration 0006);
   * false when it is missing; null when there is no database or it could
   * not be asked. Optional so an older country still answers the contract.
   */
  orderAdmin: z.boolean().nullable().optional(),
  time: z.string().datetime(),
});

export type CountryHealth = z.infer<typeof healthResponseSchema>;

// ----------------------------------------------------------------- summary --

/** Units at or below which an in-stock product counts as low on stock (a display threshold, not a business rule). */
export const LOW_STOCK_THRESHOLD = 5;

/** What the country's own records say, counted when asked. Nothing is estimated. */
export const countrySummarySchema = z.object({
  ok: z.literal(true),
  currency: z.string().regex(/^[A-Z]{3}$/),
  currencyExponent: z.number().int().min(0).max(3),
  ordersTotal: z.number().int().nonnegative(),
  /** Placed today, in the country's time zone. */
  ordersToday: z.number().int().nonnegative(),
  /** Not delivered and not cancelled. */
  ordersOpen: z.number().int().nonnegative(),
  ordersByStatus: z.record(z.string(), z.number().int().nonnegative()),
  /** Total of paid orders placed in the last 30 days, minor units. */
  sales30DaysMinor: z.number().int().nonnegative(),
  customerAccounts: z.number().int().nonnegative(),
  productsActive: z.number().int().nonnegative(),
  productsOutOfStock: z.number().int().nonnegative(),
  productsLowStock: z.number().int().nonnegative(),
  lowStockThreshold: z.number().int().positive(),
});

export type CountrySummary = z.infer<typeof countrySummarySchema>;

// --------------------------------------------------------------- customers --

export const CUSTOMER_PAGE_SIZE = 25;

export const customerListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

export const customerListResponseSchema = z.object({
  ok: z.literal(true),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  currencyExponent: z.number().int().min(0).max(3),
  customers: z.array(
    z.object({
      id: z.string().uuid(),
      email: z.string().nullable(),
      name: z.string().nullable(),
      phone: z.string().nullable(),
      createdAt: z.string().datetime(),
      /** Orders of this country placed from the account. */
      orders: z.number().int().nonnegative(),
      /** Total of their paid orders, minor units. */
      paidMinor: z.number().int().nonnegative(),
      lastOrderAt: z.string().datetime().nullable(),
    }),
  ),
});

export const customerDetailResponseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    customer: z.object({
      id: z.string().uuid(),
      email: z.string().nullable(),
      emailConfirmed: z.boolean(),
      name: z.string().nullable(),
      phone: z.string().nullable(),
      createdAt: z.string().datetime(),
      currency: z.string().regex(/^[A-Z]{3}$/),
      currencyExponent: z.number().int().min(0).max(3),
      orders: z.array(
        z.object({
          orderNumber: z.string(),
          status: z.string(),
          paymentStatus: z.string(),
          paymentMethod: z.string(),
          totalMinor: z.number().int().nonnegative(),
          itemCount: z.number().int().nonnegative(),
          createdAt: z.string().datetime(),
        }),
      ),
    }),
  }),
  z.object({ ok: z.literal(false), code: z.literal("not_found") }),
]);

export type CustomerListQuery = { q?: string; page?: number };
export type CustomerList = z.infer<typeof customerListResponseSchema>;
export type CustomerDetailResponse = z.infer<typeof customerDetailResponseSchema>;

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

// -------------------------------------------------------------- deliveries --

export const DELIVERY_ACTIONS = ["pickup", "start", "deliver", "fail"] as const;
export type DeliveryAction = (typeof DELIVERY_ACTIONS)[number];
export const DELIVERY_FAILURE_REASONS = ["customer_unreachable", "customer_absent", "address_not_found", "customer_refused", "other"] as const;
export type DeliveryFailureReason = (typeof DELIVERY_FAILURE_REASONS)[number];
export const DELIVERY_PROOF_KINDS = ["photo", "signature"] as const;
export type DeliveryProofKind = (typeof DELIVERY_PROOF_KINDS)[number];
/** Largest proof image accepted, in bytes (the database allows 1 MB). */
export const DELIVERY_PROOF_MAX_BYTES = 1_048_576;
export const DELIVERY_NOTE_MAX = 300;

const proofImage = z.object({
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  /** Base64 of the image; at most DELIVERY_PROOF_MAX_BYTES once decoded. */
  data: z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/).max(Math.ceil(DELIVERY_PROOF_MAX_BYTES / 3) * 4),
});

export const deliveryAssignBodySchema = z.object({
  riderId: z.string().uuid(),
  riderName: z.string().trim().min(1).max(80),
  /** The rider's phone from the Central Admin's records (+<country><number>); shown to the customer while the order is on its way. */
  riderPhone: z.string().regex(/^\+[0-9]{9,15}$/).optional(),
});

/** Where the rider's phone is, as its browser reports it. */
export const riderLocationBodySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().int().min(0).max(100_000).optional(),
});

export const riderLocationResponseSchema = z.discriminatedUnion("ok", [
  /** saved is false when the last point is under 10 seconds old. */
  z.object({ ok: z.literal(true), saved: z.boolean() }),
  z.object({ ok: z.literal(false), code: z.enum(["not_found", "invalid_request", "not_on_the_way"]) }),
]);

export type RiderLocation = z.infer<typeof riderLocationBodySchema>;
export type RiderLocationResult = z.infer<typeof riderLocationResponseSchema>;
export const deliveryUpdateBodySchema = z.object({
  code: z.string().regex(/^[0-9]{6}$/).optional(),
  cashCollectedMinor: minor.optional(),
  photo: proofImage.optional(),
  signature: proofImage.optional(),
  reason: z.enum(DELIVERY_FAILURE_REASONS).optional(),
  note: z.string().trim().max(DELIVERY_NOTE_MAX).optional(),
});

const deliveryAttempt = z.object({ reason: z.enum(DELIVERY_FAILURE_REASONS), note: z.string().nullable(), createdAt: z.string().datetime() });

export const deliveryAssignResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), riderId: z.string().uuid(), riderName: z.string() }),
  z.object({ ok: z.literal(false), code: z.enum(["not_found", "invalid_request", "not_assignable"]), status: orderStatus.optional() }),
]);

/** An order's delivery as administrators see it: never the customer's code. */
export const deliveryInfoSchema = z.object({
  riderId: z.string().uuid(),
  riderName: z.string(),
  assignedAt: z.string().datetime(),
  deliveredAt: z.string().datetime().nullable(),
  cashCollectedMinor: minor.nullable(),
  codeLocked: z.boolean(),
  proofs: z.array(z.enum(DELIVERY_PROOF_KINDS)),
  attempts: z.array(deliveryAttempt.extend({ actorId: z.string().uuid() })),
});

export const deliveryInfoResponseSchema = z.discriminatedUnion("ok", [
  /** delivery is null while the order has no rider. */
  z.object({ ok: z.literal(true), delivery: deliveryInfoSchema.nullable() }),
  z.object({ ok: z.literal(false), code: z.literal("not_found") }),
]);

export const deliveryProofResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), proof: proofImage.extend({ createdAt: z.string().datetime() }) }),
  z.object({ ok: z.literal(false), code: z.literal("not_found") }),
]);

export const riderDeliverySummarySchema = z.object({
  orderNumber: z.string().regex(ORDER_NUMBER_PATTERN),
  status: orderStatus,
  contactName: z.string(),
  region: z.string().nullable(),
  district: z.string().nullable(),
  ward: z.string().nullable(),
  street: z.string().nullable(),
  paymentMethod: z.string(),
  paymentStatus: z.string(),
  totalMinor: minor,
  ...money,
  itemCount: z.number().int().nonnegative(),
  assignedAt: z.string().datetime(),
});

export const riderDeliveryListResponseSchema = z.object({ ok: z.literal(true), deliveries: z.array(riderDeliverySummarySchema) });

export const riderDeliverySchema = z.object({
  orderNumber: z.string().regex(ORDER_NUMBER_PATTERN),
  status: orderStatus,
  contact: z.object({ name: z.string(), phone: z.string() }),
  delivery: z.object({
    region: z.string().nullable(),
    district: z.string().nullable(),
    ward: z.string().nullable(),
    street: z.string().nullable(),
    extra: z.string().nullable(),
    notes: z.string().nullable(),
  }),
  paymentMethod: z.string(),
  paymentStatus: z.string(),
  totalMinor: minor,
  ...money,
  /** Cash the rider must collect: the total for an unpaid Cash on Delivery order, otherwise 0. */
  cashToCollectMinor: minor,
  lines: z.array(z.object({ name: z.string(), sku: z.string(), color: z.string().nullable(), variant: z.string().nullable(), quantity: z.number().int().positive() })),
  assignedAt: z.string().datetime(),
  deliveredAt: z.string().datetime().nullable(),
  /** Set while too many wrong codes lock the order. */
  codeLockedUntil: z.string().datetime().nullable(),
  attempts: z.array(deliveryAttempt),
  /** Where the customer said the order should go, for directions (country migration 0013); absent from older countries. */
  destination: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).nullable().default(null),
});

export const riderDeliveryResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), delivery: riderDeliverySchema }),
  z.object({ ok: z.literal(false), code: z.literal("not_found") }),
]);

export const riderDeliveryUpdateResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), replayed: z.boolean(), status: orderStatus, paymentStatus: z.string() }),
  z.object({
    ok: z.literal(false),
    code: z.enum(["not_found", "invalid_request", "wrong_step", "wrong_code", "code_locked", "proof_missing", "cash_mismatch"]),
    status: orderStatus.optional(),
    attemptsLeft: z.number().int().nonnegative().optional(),
    lockedUntil: z.string().datetime().optional(),
  }),
]);

/** One rider's figures in the country. "Today" is the country's own day. */
export const riderFigureSchema = z.object({
  open: z.number().int().nonnegative(),
  onTheWay: z.number().int().nonnegative(),
  deliveredToday: z.number().int().nonnegative(),
  delivered7Days: z.number().int().nonnegative(),
  delivered30Days: z.number().int().nonnegative(),
  failed7Days: z.number().int().nonnegative(),
  cashTodayMinor: minor,
  lastDeliveredAt: z.string().datetime().nullable(),
});

export const riderFiguresResponseSchema = z.object({
  ok: z.literal(true),
  ...money,
  /** By rider id; a rider who was never given an order is absent. */
  riders: z.record(z.string().uuid(), riderFigureSchema),
});

export const riderDeliveriesResponseSchema = z.object({
  ok: z.literal(true),
  ...money,
  deliveries: z.array(
    z.object({
      orderNumber: z.string().regex(ORDER_NUMBER_PATTERN),
      status: orderStatus,
      contactName: z.string(),
      district: z.string().nullable(),
      region: z.string().nullable(),
      paymentMethod: z.string(),
      totalMinor: minor,
      cashCollectedMinor: minor.nullable(),
      assignedAt: z.string().datetime(),
      deliveredAt: z.string().datetime().nullable(),
    }),
  ),
  /** Failed attempts of the last 30 days. */
  attempts: z.array(z.object({ orderNumber: z.string().regex(ORDER_NUMBER_PATTERN), reason: z.enum(DELIVERY_FAILURE_REASONS), note: z.string().nullable(), createdAt: z.string().datetime() })),
});

export type RiderFigure = z.infer<typeof riderFigureSchema>;
export type RiderFigures = z.infer<typeof riderFiguresResponseSchema>;
export type RiderDeliveries = z.infer<typeof riderDeliveriesResponseSchema>;
export type DeliveryAssignResult = z.infer<typeof deliveryAssignResponseSchema>;
export type DeliveryInfo = z.infer<typeof deliveryInfoSchema>;
export type DeliveryInfoResponse = z.infer<typeof deliveryInfoResponseSchema>;
export type DeliveryProofResponse = z.infer<typeof deliveryProofResponseSchema>;
export type RiderDeliverySummary = z.infer<typeof riderDeliverySummarySchema>;
export type RiderDeliveryList = z.infer<typeof riderDeliveryListResponseSchema>;
export type RiderDelivery = z.infer<typeof riderDeliverySchema>;
export type RiderDeliveryResponse = z.infer<typeof riderDeliveryResponseSchema>;
export type RiderDeliveryUpdate = z.infer<typeof deliveryUpdateBodySchema>;
export type RiderDeliveryUpdateResult = z.infer<typeof riderDeliveryUpdateResponseSchema>;

// ---------------------------------------------------------------- products --

/** draft: never live; live: on the storefront; hidden: was live, taken off. */
export const PRODUCT_STATUSES = ["draft", "live", "hidden"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
export const PRODUCT_PAGE_SIZE = 25;
/** Largest product photo accepted, in bytes (the database allows 1 MB). */
export const PRODUCT_IMAGE_MAX_BYTES = 1_048_576;
export const PRODUCT_IMAGES_MAX = 12;
export const PRODUCT_STOCK_MAX = 100_000;
/** Products whose SKU starts with this belong to the SAMPLE catalogue (placeholder data). */
export const SAMPLE_SKU_PREFIX = "SAMPLE-";
export const PRODUCT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const PRODUCT_SKU_PATTERN = /^[A-Z0-9][A-Z0-9-]{1,39}$/;
export const PRODUCT_LIMITS = {
  name: 120,
  description: 4000,
  variantLabel: 30,
  specifications: 30,
  specLabel: 60,
  specValue: 200,
  variants: 20,
  variantName: 40,
  colors: 12,
  colorName: 40,
  alt: 120,
} as const;
/** Largest price accepted, in minor units. */
const PRICE_MAX = 1_000_000_000_000_000;

const productStatus = z.enum(PRODUCT_STATUSES);
const price = z.number().int().min(1).max(PRICE_MAX);
const uniqueBy = <T>(items: readonly T[], key: (item: T) => string) => new Set(items.map((item) => key(item).trim().toLowerCase())).size === items.length;

/** What the admin sends to create or edit a product. The country checks all of it again. */
export const productInputSchema = z
  .object({
    name: z.string().trim().min(2).max(PRODUCT_LIMITS.name),
    sku: z.string().trim().toUpperCase().regex(PRODUCT_SKU_PATTERN),
    description: z.string().trim().max(PRODUCT_LIMITS.description).nullable(),
    brandId: z.string().uuid().nullable(),
    categoryId: z.string().uuid(),
    groupId: z.string().uuid().nullable(),
    subcategoryId: z.string().uuid().nullable(),
    variantLabel: z.string().trim().max(PRODUCT_LIMITS.variantLabel).nullable(),
    priceMinor: price,
    /** The price before an offer; shown struck through. Above the price, or null. */
    wasPriceMinor: price.nullable(),
    specifications: z
      .array(z.object({ label: z.string().trim().min(1).max(PRODUCT_LIMITS.specLabel), value: z.string().trim().min(1).max(PRODUCT_LIMITS.specValue) }))
      .max(PRODUCT_LIMITS.specifications)
      .refine((list) => uniqueBy(list, (item) => item.label), "Each specification label once"),
    variants: z
      .array(z.string().trim().min(1).max(PRODUCT_LIMITS.variantName))
      .max(PRODUCT_LIMITS.variants)
      .refine((list) => uniqueBy(list, (item) => item), "Each variant once"),
    colors: z
      .array(z.object({ name: z.string().trim().min(1).max(PRODUCT_LIMITS.colorName), swatch: z.string().regex(/^#[0-9a-fA-F]{6}$/) }))
      .max(PRODUCT_LIMITS.colors)
      .refine((list) => uniqueBy(list, (item) => item.name), "Each colour once"),
  })
  .refine((input) => input.wasPriceMinor === null || input.wasPriceMinor > input.priceMinor, { message: "The earlier price must be above the price", path: ["wasPriceMinor"] })
  .refine((input) => input.subcategoryId === null || input.groupId !== null, { message: "A subcategory needs its group", path: ["subcategoryId"] });

export const productCreateBodySchema = z.object({
  slug: z.string().trim().toLowerCase().max(80).regex(PRODUCT_SLUG_PATTERN),
  product: productInputSchema,
});
export const productUpdateBodySchema = z.object({ product: productInputSchema });
export const productStatusBodySchema = z.object({ publish: z.boolean() });
export const productStockBodySchema = z.object({ available: z.number().int().min(0).max(PRODUCT_STOCK_MAX) });
export const productImageBodySchema = z.object({
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  /** Base64 of the photo; at most PRODUCT_IMAGE_MAX_BYTES once decoded. */
  data: z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/).max(Math.ceil(PRODUCT_IMAGE_MAX_BYTES / 3) * 4),
  alt: z.string().trim().max(PRODUCT_LIMITS.alt).optional(),
});
export const productImageArrangeBodySchema = z.object({ keep: z.array(z.string().uuid()).max(PRODUCT_IMAGES_MAX) });
export const productListQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.string().trim().toLowerCase().max(80).regex(PRODUCT_SLUG_PATTERN).optional(),
  status: productStatus.optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

const productImageRef = z.object({ id: z.string().uuid(), url: z.string() });

export const catalogueOptionsResponseSchema = z.object({
  ok: z.literal(true),
  ...money,
  categories: z.array(
    z.object({
      id: z.string().uuid(),
      slug: z.string(),
      name: z.string(),
      active: z.boolean(),
      groups: z.array(
        z.object({
          id: z.string().uuid(),
          slug: z.string(),
          name: z.string(),
          active: z.boolean(),
          subcategories: z.array(z.object({ id: z.string().uuid(), slug: z.string(), name: z.string(), active: z.boolean() })),
        }),
      ),
    }),
  ),
  brands: z.array(z.object({ id: z.string().uuid(), name: z.string() })),
});

export const productSummarySchema = z.object({
  slug: z.string(),
  sku: z.string(),
  name: z.string(),
  status: productStatus,
  categoryName: z.string(),
  brandName: z.string().nullable(),
  /** Null when the product has no price in this country. */
  priceMinor: minor.nullable(),
  wasPriceMinor: minor.nullable(),
  /** Units in stock; null when stock was never recorded. */
  available: z.number().int().nonnegative().nullable(),
  image: productImageRef.nullable(),
  sample: z.boolean(),
  updatedAt: z.string().datetime(),
});

export const productListResponseSchema = z.object({
  ok: z.literal(true),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  counts: z.partialRecord(productStatus, z.number().int().nonnegative()),
  ...money,
  products: z.array(productSummarySchema),
});

export const productDetailSchema = z.object({
  slug: z.string(),
  sku: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  brandId: z.string().uuid().nullable(),
  categoryId: z.string().uuid(),
  groupId: z.string().uuid().nullable(),
  subcategoryId: z.string().uuid().nullable(),
  variantLabel: z.string().nullable(),
  status: productStatus,
  publishedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  ...money,
  priceMinor: minor.nullable(),
  wasPriceMinor: minor.nullable(),
  available: z.number().int().nonnegative().nullable(),
  sample: z.boolean(),
  /** In order; the first is the main photo. `uploaded` is false for a path-only photo (the SAMPLE catalogue). */
  images: z.array(productImageRef.extend({ alt: z.string().nullable(), uploaded: z.boolean() })),
  specifications: z.array(z.object({ label: z.string(), value: z.string() })),
  variants: z.array(z.string()),
  colors: z.array(z.object({ name: z.string(), swatch: z.string() })),
  /** The last changes, newest first. */
  history: z.array(z.object({ action: z.string(), actorId: z.string().uuid(), createdAt: z.string().datetime(), detail: z.record(z.string(), z.unknown()) })),
});

export const productDetailResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), product: productDetailSchema }),
  z.object({ ok: z.literal(false), code: z.literal("not_found") }),
]);

export const productSaveResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), replayed: z.boolean(), slug: z.string(), status: productStatus }),
  z.object({ ok: z.literal(false), code: z.enum(["invalid_request", "not_found", "slug_taken", "sku_taken", "invalid_category", "invalid_brand"]) }),
]);

export const PRODUCT_READINESS = ["price", "image", "category"] as const;
export const productStatusResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), replayed: z.boolean(), status: productStatus }),
  z.object({ ok: z.literal(false), code: z.enum(["invalid_request", "not_found", "not_ready"]), missing: z.array(z.enum(PRODUCT_READINESS)).optional() }),
]);

export const productStockResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), replayed: z.boolean(), available: z.number().int().nonnegative() }),
  z.object({ ok: z.literal(false), code: z.enum(["invalid_request", "not_found"]) }),
]);

export const productImageAddResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), replayed: z.boolean(), imageId: z.string().uuid() }),
  z.object({ ok: z.literal(false), code: z.enum(["invalid_request", "not_found", "too_many_images"]) }),
]);

export const productImageArrangeResponseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), replayed: z.boolean() }),
  z.object({ ok: z.literal(false), code: z.enum(["invalid_request", "not_found", "last_image"]) }),
]);

export const productImageResponseSchema = z.discriminatedUnion("ok", [
  /** `file` is null for a path-only photo: the storefront serves it at `url`. */
  z.object({ ok: z.literal(true), url: z.string(), file: productImageBodySchema.pick({ contentType: true, data: true }).nullable() }),
  z.object({ ok: z.literal(false), code: z.literal("not_found") }),
]);

export type ProductInput = z.infer<typeof productInputSchema>;
export type ProductListQuery = { q?: string; category?: string; status?: ProductStatus; page?: number };
export type CatalogueOptions = z.infer<typeof catalogueOptionsResponseSchema>;
export type ProductSummary = z.infer<typeof productSummarySchema>;
export type ProductList = z.infer<typeof productListResponseSchema>;
export type ProductDetail = z.infer<typeof productDetailSchema>;
export type ProductDetailResponse = z.infer<typeof productDetailResponseSchema>;
export type ProductSaveResult = z.infer<typeof productSaveResponseSchema>;
export type ProductStatusResult = z.infer<typeof productStatusResponseSchema>;
export type ProductStockResult = z.infer<typeof productStockResponseSchema>;
export type ProductImageUpload = z.infer<typeof productImageBodySchema>;
export type ProductImageAddResult = z.infer<typeof productImageAddResponseSchema>;
export type ProductImageArrangeResult = z.infer<typeof productImageArrangeResponseSchema>;
export type ProductImageResponse = z.infer<typeof productImageResponseSchema>;

// ----------------------------------------------------------------- adapter --

/** Why a country could not be asked, or did not give a usable answer. */
export type CountryUnavailableReason =
  | "not_configured" // no API address registered for the country
  | "disabled" // registered but switched off
  | "no_iso_code" // the country itself is not confirmed yet
  | "signing_not_configured" // the Central Admin has no signing key
  | "signing_key_invalid" // the Central Admin's signing key cannot be read
  | "country_key_invalid" // the country's copy of the public key cannot be read
  | "country_orders_missing" // the country's database lacks the order administration (migration 0006)
  | "country_database_denied" // the country's database refused the admin role (service_role)
  | "country_deliveries_missing" // the country's database lacks deliveries (migration 0008)
  | "country_summary_missing" // the country's database lacks the dashboard figures (migration 0009)
  | "country_rider_figures_missing" // the country's database lacks riders' figures (migration 0010)
  | "country_customers_missing" // the country's database lacks the customer directory (migration 0011)
  | "country_tracking_missing" // the country's database lacks live tracking (migration 0012)
  | "country_products_missing" // the country's database lacks the product administration (migration 0016)
  | "unreachable" // no connection
  | "timeout"
  | "rejected" // the country refused the request (401/403)
  | "too_large" // the country refused the request's size (413)
  | "not_found" // the country has no such endpoint (404)
  | "server_error" // the country answered 5xx
  | "invalid_response"; // answered, but not with what the contract says

export type CountryApiResult<T> =
  | { available: true; data: T; statusCode: number; latencyMs: number }
  | { available: false; reason: CountryUnavailableReason; statusCode: number | null; latencyMs: number | null };

/** Every call names the administrator it is made for (their Central Admin user id). */
export interface CountryAdminApi {
  health(actorId: string): Promise<CountryApiResult<CountryHealth>>;
  summary(actorId: string): Promise<CountryApiResult<CountrySummary>>;
  listOrders(actorId: string, query?: OrderListQuery): Promise<CountryApiResult<OrderList>>;
  getOrder(actorId: string, orderNumber: string): Promise<CountryApiResult<OrderDetailResponse>>;
  updateOrderStatus(actorId: string, orderNumber: string, change: { status: OrderStatus; note?: string }): Promise<CountryApiResult<OrderStatusChange>>;
  addOrderNote(actorId: string, orderNumber: string, body: string): Promise<CountryApiResult<OrderNoteResult>>;
  assignDelivery(actorId: string, orderNumber: string, rider: { riderId: string; riderName: string; riderPhone?: string }): Promise<CountryApiResult<DeliveryAssignResult>>;
  reportLocation(actorId: string, orderNumber: string, location: RiderLocation): Promise<CountryApiResult<RiderLocationResult>>;
  getDelivery(actorId: string, orderNumber: string): Promise<CountryApiResult<DeliveryInfoResponse>>;
  getDeliveryProof(actorId: string, orderNumber: string, kind: DeliveryProofKind): Promise<CountryApiResult<DeliveryProofResponse>>;
  /** The deliveries of the rider making the call (actorId). */
  listMyDeliveries(actorId: string): Promise<CountryApiResult<RiderDeliveryList>>;
  getMyDelivery(actorId: string, orderNumber: string): Promise<CountryApiResult<RiderDeliveryResponse>>;
  updateMyDelivery(actorId: string, orderNumber: string, action: DeliveryAction, update: RiderDeliveryUpdate): Promise<CountryApiResult<RiderDeliveryUpdateResult>>;
  riderFigures(actorId: string): Promise<CountryApiResult<RiderFigures>>;
  riderDeliveries(actorId: string, riderId: string): Promise<CountryApiResult<RiderDeliveries>>;
  listCustomers(actorId: string, query?: CustomerListQuery): Promise<CountryApiResult<CustomerList>>;
  getCustomer(actorId: string, customerId: string): Promise<CountryApiResult<CustomerDetailResponse>>;
  catalogueOptions(actorId: string): Promise<CountryApiResult<CatalogueOptions>>;
  listProducts(actorId: string, query?: ProductListQuery): Promise<CountryApiResult<ProductList>>;
  getProduct(actorId: string, slug: string): Promise<CountryApiResult<ProductDetailResponse>>;
  createProduct(actorId: string, slug: string, product: ProductInput): Promise<CountryApiResult<ProductSaveResult>>;
  updateProduct(actorId: string, slug: string, product: ProductInput): Promise<CountryApiResult<ProductSaveResult>>;
  setProductStatus(actorId: string, slug: string, publish: boolean): Promise<CountryApiResult<ProductStatusResult>>;
  setProductStock(actorId: string, slug: string, available: number): Promise<CountryApiResult<ProductStockResult>>;
  addProductImage(actorId: string, slug: string, image: ProductImageUpload): Promise<CountryApiResult<ProductImageAddResult>>;
  arrangeProductImages(actorId: string, slug: string, keep: string[]): Promise<CountryApiResult<ProductImageArrangeResult>>;
  getProductImage(actorId: string, slug: string, imageId: string): Promise<CountryApiResult<ProductImageResponse>>;
}

/** A country whose service cannot be called. Every request answers with the reason; nothing is sent anywhere. */
export function unavailableCountryApi(reason: CountryUnavailableReason): CountryAdminApi {
  const answer = async () => ({ available: false as const, reason, statusCode: null, latencyMs: null });
  return {
    health: answer,
    summary: answer,
    listOrders: answer,
    getOrder: answer,
    updateOrderStatus: answer,
    addOrderNote: answer,
    assignDelivery: answer,
    reportLocation: answer,
    getDelivery: answer,
    getDeliveryProof: answer,
    listMyDeliveries: answer,
    getMyDelivery: answer,
    updateMyDelivery: answer,
    riderFigures: answer,
    riderDeliveries: answer,
    listCustomers: answer,
    getCustomer: answer,
    catalogueOptions: answer,
    listProducts: answer,
    getProduct: answer,
    createProduct: answer,
    updateProduct: answer,
    setProductStatus: answer,
    setProductStock: answer,
    addProductImage: answer,
    arrangeProductImages: answer,
    getProductImage: answer,
  };
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
  if (status === 413) return "too_large";
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
      // A country that is not set up for the admin says what is missing (503).
      let reason = statusReason(response.status);
      if (response.status === 503) {
        const code = await response
          .json()
          .then((answer: unknown) => (answer as { code?: unknown } | null)?.code)
          .catch(() => undefined);
        if (typeof code === "string" && code.startsWith("verify_key_")) reason = "country_key_invalid";
        else if (code === "order_admin_missing") reason = "country_orders_missing";
        else if (code === "database_permission") reason = "country_database_denied";
        else if (code === "delivery_admin_missing") reason = "country_deliveries_missing";
        else if (code === "summary_missing") reason = "country_summary_missing";
        else if (code === "rider_figures_missing") reason = "country_rider_figures_missing";
        else if (code === "customers_missing") reason = "country_customers_missing";
        else if (code === "tracking_missing") reason = "country_tracking_missing";
        else if (code === "products_missing") reason = "country_products_missing";
      }
      return { available: false, reason, statusCode: response.status, latencyMs: elapsed() };
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
    summary(actorId) {
      return call("summary", countrySummarySchema, actorId);
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
    assignDelivery(actorId, orderNumber, rider) {
      return call("assignDelivery", deliveryAssignResponseSchema, actorId, { params: { orderNumber }, body: rider });
    },
    reportLocation(actorId, orderNumber, location) {
      return call("reportLocation", riderLocationResponseSchema, actorId, { params: { orderNumber }, body: location });
    },
    getDelivery(actorId, orderNumber) {
      return call("getDelivery", deliveryInfoResponseSchema, actorId, { params: { orderNumber } });
    },
    getDeliveryProof(actorId, orderNumber, kind) {
      return call("getDeliveryProof", deliveryProofResponseSchema, actorId, { params: { orderNumber, kind } });
    },
    listMyDeliveries(actorId) {
      return call("listMyDeliveries", riderDeliveryListResponseSchema, actorId);
    },
    getMyDelivery(actorId, orderNumber) {
      return call("getMyDelivery", riderDeliveryResponseSchema, actorId, { params: { orderNumber } });
    },
    updateMyDelivery(actorId, orderNumber, action, update) {
      return call("updateMyDelivery", riderDeliveryUpdateResponseSchema, actorId, { params: { orderNumber, action }, body: update });
    },
    riderFigures(actorId) {
      return call("riderFigures", riderFiguresResponseSchema, actorId);
    },
    riderDeliveries(actorId, riderId) {
      return call("riderDeliveries", riderDeliveriesResponseSchema, actorId, { params: { riderId } });
    },
    listCustomers(actorId, query = {}) {
      return call("listCustomers", customerListResponseSchema, actorId, {
        query: { q: query.q, page: query.page && query.page > 1 ? String(query.page) : undefined },
      });
    },
    getCustomer(actorId, customerId) {
      return call("getCustomer", customerDetailResponseSchema, actorId, { params: { customerId } });
    },
    catalogueOptions(actorId) {
      return call("catalogueOptions", catalogueOptionsResponseSchema, actorId);
    },
    listProducts(actorId, query = {}) {
      return call("listProducts", productListResponseSchema, actorId, {
        query: { q: query.q, category: query.category, status: query.status, page: query.page && query.page > 1 ? String(query.page) : undefined },
      });
    },
    getProduct(actorId, slug) {
      return call("getProduct", productDetailResponseSchema, actorId, { params: { slug } });
    },
    createProduct(actorId, slug, product) {
      return call("createProduct", productSaveResponseSchema, actorId, { body: { slug, product } });
    },
    updateProduct(actorId, slug, product) {
      return call("updateProduct", productSaveResponseSchema, actorId, { params: { slug }, body: { product } });
    },
    setProductStatus(actorId, slug, publish) {
      return call("setProductStatus", productStatusResponseSchema, actorId, { params: { slug }, body: { publish } });
    },
    setProductStock(actorId, slug, available) {
      return call("setProductStock", productStockResponseSchema, actorId, { params: { slug }, body: { available } });
    },
    addProductImage(actorId, slug, image) {
      return call("addProductImage", productImageAddResponseSchema, actorId, { params: { slug }, body: image });
    },
    arrangeProductImages(actorId, slug, keep) {
      return call("arrangeProductImages", productImageArrangeResponseSchema, actorId, { params: { slug }, body: { keep } });
    },
    getProductImage(actorId, slug, imageId) {
      return call("getProductImage", productImageResponseSchema, actorId, { params: { slug, imageId } });
    },
  };
}
