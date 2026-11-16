import "server-only";
import { createPostgresDb, type Db } from "@tronic/database";
import { databaseUrl } from "./config";

let db: Db | null = null;

/**
 * The Central Admin database pool. Requests never run as the connection's
 * owner: every query goes through withAdminAccess (@tronic/database/admin),
 * which switches to the `authenticated` role with the signed-in
 * administrator's id, so Row Level Security applies.
 */
export function getAdminDb(): Db {
  db ??= createPostgresDb(databaseUrl(), { max: Number(process.env.ADMIN_DATABASE_POOL_MAX ?? 5) });
  return db;
}
