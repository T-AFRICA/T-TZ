import postgres from "postgres";
import type { Db, Row } from "./db";

type Sql = postgres.Sql | postgres.TransactionSql;

/**
 * postgres.js adapter. `prepare: false` keeps it compatible with Supabase's
 * transaction pooler (port 6543). Server-only: the connection string is a
 * secret and the browser never imports this package.
 */
export function createPostgresDb(url: string, options: { max?: number } = {}): Db {
  const sql = postgres(url, { max: options.max ?? 5, prepare: false, idle_timeout: 20, connect_timeout: 10 });
  return wrap(sql);
}

function wrap(sql: Sql): Db {
  return {
    async query<T extends Row = Row>(text: string, params: readonly unknown[] = []): Promise<T[]> {
      // Boundary cast: postgres.js types its parameters as serialisable
      // values; ours are strings, numbers, booleans, null and string arrays.
      const rows = await sql.unsafe(text, params as postgres.ParameterOrJSON<never>[]);
      return rows as unknown as T[];
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
      if ("savepoint" in sql) return fn(wrap(sql));
      return (await sql.begin((tx) => fn(wrap(tx)))) as T;
    },
  };
}
