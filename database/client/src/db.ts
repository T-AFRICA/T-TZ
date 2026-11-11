/**
 * Minimal database boundary for the server-only query layer. The app runs it
 * on postgres.js (Supabase Postgres via DATABASE_URL); tests run the same
 * code on a disposable PGlite database. Parameters are always bound, never
 * concatenated into SQL.
 */
export type Row = Record<string, unknown>;

export interface Db {
  query<T extends Row = Row>(text: string, params?: readonly unknown[]): Promise<T[]>;
  /** Runs `fn` in one transaction (or inside the current one). */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
}

/**
 * Who a query runs as. Every storefront query runs as one of Supabase's API
 * roles so Row Level Security applies exactly as it would through the
 * Supabase API; the connection's owner role is never used for requests.
 * `userId` must come from a verified Supabase Auth session, never from
 * request input.
 */
export type Access = { role: "anon" } | { role: "authenticated"; userId: string };

export const ANON: Access = { role: "anon" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Runs `fn` in a transaction as the given role, with the JWT claims that
 * auth.uid() reads. `set local` ends with the transaction, so a pooled
 * connection never keeps the role or claims.
 */
export async function withAccess<T>(db: Db, access: Access, fn: (tx: Db) => Promise<T>): Promise<T> {
  if (access.role === "authenticated" && !UUID.test(access.userId)) {
    throw new Error("withAccess: authenticated access needs a user id (uuid)");
  }
  return db.transaction(async (tx) => {
    await tx.query(access.role === "anon" ? "set local role anon" : "set local role authenticated");
    const claims = access.role === "anon" ? { role: "anon" } : { sub: access.userId, role: "authenticated" };
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    return fn(tx);
  });
}

/**
 * Converts an integer column read from Postgres (number, bigint or the
 * decimal string postgres.js returns for int8) to a JS number, refusing
 * anything that is not a non-negative safe integer. This is the import
 * edge for stored money: minor units in, minor units out, never rescaled.
 */
export function toSafeInteger(value: unknown, label: string): number {
  const n = typeof value === "bigint" ? Number(value) : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof n !== "number" || !Number.isSafeInteger(n) || n < 0) {
    throw new Error(`${label}: expected a non-negative integer, got ${String(value)}`);
  }
  return n;
}
