/**
 * Runtime DB client factory — pointed at `DATABASE_URL`, the Supabase
 * transaction-mode pooler (port 6543), per app_spec.md's "Connection
 * pooling & retry strategy" section.
 *
 * Supabase + Drizzle gotcha: in transaction-pooling mode, PgBouncer can
 * hand out a different backend connection per statement, so server-side
 * prepared statements (which are tied to one backend connection) break.
 * `postgres.js` is configured with `prepare: false` here to disable them —
 * this is the documented fix for "prepared statement already exists" /
 * similar errors when using Drizzle + postgres.js against Supabase's
 * pooler. Migrations do NOT go through this client — see `migrate.ts`,
 * which uses `DIRECT_URL` (unpooled) instead, since drizzle-kit's
 * migrator needs a stable session for DDL and advisory locks.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

export type Db = ReturnType<typeof createDb>;

export interface CreateDbOptions {
  /** Conservative per-instance pool size — see spec's pooling/retry strategy. */
  max?: number;
  idleTimeoutSeconds?: number;
}

/**
 * Builds a fresh Drizzle client against `connectionString`. Prefer
 * `getDb()` below for the shared app-runtime singleton; use this directly
 * only when you need an isolated client (tests, scripts, a different
 * environment's connection string).
 */
export function createDb(connectionString: string, options: CreateDbOptions = {}) {
  const client = postgres(connectionString, {
    prepare: false, // required for Supabase's transaction-mode pooler
    max: options.max ?? 10,
    idle_timeout: options.idleTimeoutSeconds ?? 30,
  });
  return drizzle(client, { schema });
}

declare global {
  // eslint-disable-next-line no-var
  var __freeopsDb: Db | undefined;
}

/**
 * Lazily-created, process-wide singleton DB client for app runtime code,
 * pointed at `process.env.DATABASE_URL`. Cached on `globalThis` so
 * Next.js dev-mode hot reload doesn't leak a fresh postgres.js connection
 * pool on every module reload.
 *
 * Throws if `DATABASE_URL` is unset — called lazily (not at module load)
 * so importing this file doesn't require the env var to be present.
 */
export function getDb(): Db {
  if (globalThis.__freeopsDb) {
    return globalThis.__freeopsDb;
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy packages/db/.env.example guidance into apps/web/.env.local " +
        "(runtime/pooled connection, port 6543)."
    );
  }
  const db = createDb(connectionString);
  if (process.env.NODE_ENV !== "production") {
    globalThis.__freeopsDb = db;
  }
  return db;
}
