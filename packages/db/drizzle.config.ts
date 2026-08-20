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
  // `identity.ts` declares a reference-only `auth.users` table (via
  // `pgSchema("auth")`) purely so `public.users.id` can express a real FK
  // into Supabase Auth's own table — that table/schema is owned and
  // managed entirely by Supabase, never by drizzle-kit. Restricting
  // generate/push/introspect to `public` keeps drizzle-kit from ever
  // trying to CREATE/ALTER/DROP `auth.*` while still letting the FK
  // reference resolve at the schema-object level (schemaFilter only
  // affects generate/push/introspect, not TS references).
  schemaFilter: ["public"],
  strict: true,
  verbose: true,
});
