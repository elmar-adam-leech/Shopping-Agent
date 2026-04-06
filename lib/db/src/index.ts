import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const connectionString = process.env.NEON_DATABASE_STRING || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL or NEON_DATABASE_STRING must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString,
  max: parseInt(process.env.DB_POOL_MAX || "20", 10),
  idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || "30000", 10),
  connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || "5000", 10),
});

export const db = drizzle(pool, { schema });

export async function withTenantScope<T>(
  storeDomain: string,
  fn: (scopedDb: typeof db) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_store_domain', ${storeDomain}, true)`);
    return fn(tx as unknown as typeof db);
  });
}

export async function withAdminBypass<T>(
  fn: (scopedDb: typeof db) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.rls_bypass', 'on', true)`);
    return fn(tx as unknown as typeof db);
  });
}

export * from "./schema";
