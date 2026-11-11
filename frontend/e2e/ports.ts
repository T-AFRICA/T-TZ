/** Local ports used only by the browser tests (all bound to 127.0.0.1). */
export const PORTS = {
  /** Storefront with the database, orders and (stand-in) auth connected. */
  connected: 3210,
  /** The same build with nothing connected (mock catalogue, no auth). */
  disconnected: 3211,
  database: 54329,
  auth: 54330,
  control: 54331,
} as const;
