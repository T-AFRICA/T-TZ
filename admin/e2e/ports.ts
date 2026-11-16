/** Local ports used only by the admin browser tests and the local preview (all bound to 127.0.0.1). */
export const PORTS = {
  /** The admin application under test (a production build). */
  app: 3220,
  database: 54339,
  auth: 54340,
  control: 54341,
} as const;

/** The local preview (pnpm --filter @tronic/admin run preview:local) uses its own set, so both can run at once. */
export const PREVIEW_PORTS = {
  app: 3300,
  database: 54349,
  auth: 54350,
  control: 54351,
} as const;
