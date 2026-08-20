/**
 * Runs pending drizzle-kit migrations against `DIRECT_URL` (the unpooled
 * Postgres connection) — per app_spec.md's "Migration approach": migrations
 * always go through the direct connection, never the transaction pooler,
 * since DDL + drizzle-kit's migration-lock bookkeeping need a stable
 * session.
 *
 * Env resolution order (first match wins, via dotenv's default
 * don't-override-already-set behavior):
 *   1. Already-set process env (CI, `pnpm --filter @freeops/db db:migrate`
 *      invoked with an explicit `DIRECT_URL=...` prefix, etc.)
 *   2. packages/db/.env.local — local docker-compose Postgres override
 *   3. apps/web/.env.local — the shared real Supabase credentials
 *
 * Usage:
 *   pnpm --filter @freeops/db db:migrate        # against whatever DIRECT_URL resolves to
 */
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

config({ path: path.resolve(moduleDir, "../.env.local"), quiet: true });
config({ path: path.resolve(moduleDir, "../../../apps/web/.env.local"), quiet: true });

function redact(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    return `${url.protocol}//${url.hostname}:${url.port}${url.pathname}`;
  } catch {
    return "<unparseable connection string>";
  }
}

async function main() {
  const connectionString = process.env.DIRECT_URL;
  if (!connectionString) {
    throw new Error(
      "DIRECT_URL is not set. Set it in apps/web/.env.local (Supabase direct connection, port 5432) " +
        "or packages/db/.env.local (local docker-compose Postgres)."
    );
  }

  console.log(`[db:migrate] Connecting to ${redact(connectionString)} ...`);
  const migrationClient = postgres(connectionString, { max: 1 });
  const db = drizzle(migrationClient);

  const migrationsFolder = path.resolve(moduleDir, "../migrations");
  console.log(`[db:migrate] Applying migrations from ${migrationsFolder} ...`);
  await migrate(db, { migrationsFolder });

  await migrationClient.end();
  console.log("[db:migrate] Done.");
}

main().catch((err) => {
  console.error("[db:migrate] Failed:", err);
  process.exit(1);
});
