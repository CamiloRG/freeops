/**
 * drizzle-kit config — migrations always run against `DIRECT_URL` (the
 * unpooled Postgres connection), never `DATABASE_URL` (the transaction
 * pooler), per app_spec.md's "Migration approach" / "Connection pooling &
 * retry strategy" sections. `DATABASE_URL` is only for the app-runtime
 * client (see `src/client.ts`).
 *
 * Env resolution mirrors `src/migrate.ts`: packages/db/.env.local (local
 * docker-compose Postgres) takes priority if present, else
 * apps/web/.env.local (shared real Supabase credentials).
 */
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "drizzle-kit";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));

config({ path: path.resolve(packageRoot, ".env.local"), quiet: true });
config({ path: path.resolve(packageRoot, "../../apps/web/.env.local"), quiet: true });

const directUrl = process.env.DIRECT_URL;
if (!directUrl) {
  throw new Error(
    "DIRECT_URL is not set. Set it in apps/web/.env.local (Supabase direct connection, port 5432) " +
      "or packages/db/.env.local (local docker-compose Postgres)."
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dbCredentials: {
    url: directUrl,
  },
  strict: true,
  verbose: true,
});
