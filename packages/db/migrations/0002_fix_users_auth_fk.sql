-- NOTE (hand-edited after `drizzle-kit generate`): the auto-generated
-- `CREATE SCHEMA "auth"` / `CREATE TABLE "auth"."users"` statements were
-- removed from this migration. `auth.users` already exists — it's
-- Supabase Auth's own table, owned and fully managed by Supabase, not by
-- this repo's migrations. `packages/db/src/schema/identity.ts` declares it
-- via `pgSchema("auth")` purely as a reference so `public.users.id` can
-- express a real FK into it (drizzle-kit has no "existing/external table"
-- flag as of this version, so it always emits CREATE DDL for any table it
-- sees referenced — that DDL must never actually run here). Only the
-- statements below, which touch `public.users`, are ours to apply.
ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "password_hash";