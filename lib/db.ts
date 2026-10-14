import "server-only";
import pg from "pg";

// One pool per process. Supabase session pooler (port 5432) in production,
// embedded Postgres locally (scripts/local-db.mjs).

declare global {
  var __pixcherryPool: pg.Pool | undefined;
}

function makePool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const local = /@(127\.0\.0\.1|localhost)[:/]/.test(url);
  const pool = new pg.Pool({
    connectionString: url,
    ssl: local ? false : { rejectUnauthorized: false },
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  pool.on("error", (e) => console.error("pg pool error", e));
  return pool;
}

export function pool() {
  globalThis.__pixcherryPool ??= makePool();
  return globalThis.__pixcherryPool;
}

export type Queryable = Pick<pg.PoolClient, "query">;

export async function q<T extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, params: unknown[] = [], db: Queryable = pool()) {
  return (await db.query<T>(sql, params)).rows;
}

export async function one<T extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, params: unknown[] = [], db: Queryable = pool()) {
  return (await db.query<T>(sql, params)).rows[0] ?? null;
}

export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool().connect();
  try {
    await c.query("begin");
    const out = await fn(c);
    await c.query("commit");
    return out;
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
