/**
 * @tronic/database — the server-only query layer (Supabase Postgres).
 * Never import this from a client component: it holds the connection
 * string and talks to the database directly.
 */
export { ANON, toSafeInteger, withAccess, type Access, type Db, type Row } from "./db";
export { createPostgresDb } from "./postgres-db";
export { DatabaseCatalogClient, loadPublicProducts, rowToProduct } from "./catalog";
export {
  listCustomerOrders,
  placeCodOrder,
  trackOrder,
  type CustomerOrder,
  type LineProblem,
  type OrderLineInput,
  type PlaceCodOrderInput,
  type PlaceCodOrderResult,
  type TrackedOrder,
} from "./orders";
