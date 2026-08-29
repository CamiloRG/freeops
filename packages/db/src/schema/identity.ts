/**
 * Identity & Auth — app_spec.md § "Data Model & Schema" → "Identity & Auth",
 * corrected in Phase 3 for real Supabase Auth usage (see ADR).
 *
 * Fine-grained auth (sessions, refresh tokens, password hashes, OAuth
 * account linking) lives entirely in Supabase Auth's own `auth` schema, not
 * here. `public.users` is a thin, RLS-friendly mirror keyed 1:1 on
 * `auth.users.id` — never independently generated — so that
 * `auth.uid() = user_id`-style RLS policies across the rest of the schema
 * have a stable join key. A `public.handle_new_user()` trigger (see
 * migrations/0003_auth_trigger.sql) keeps this row in sync automatically
 * whenever Supabase Auth creates a new `auth.users` row; app code must
 * never insert into `public.users` directly.
 */
import { check, index, integer, pgSchema, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { citext, softDelete, timestamps } from "./_helpers";

/**
 * Reference-only declaration of Supabase's `auth.users` table, so
 * `public.users.id` can express a real foreign key into it. This schema and
 * table are entirely owned/managed by Supabase Auth — drizzle-kit must
 * never generate DDL that creates, alters, or drops `auth.users` itself;
 * only the FK on `public.users.id` (declared below) is ours to manage.
 */
export const authSchema = pgSchema("auth");
export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
});

export const users = pgTable(
  "users",
  {
    // References auth.users(id) on delete cascade — NOT an independently
    // generated default. This is Supabase's standard pattern: it's what
    // makes `auth.uid() = user_id`-style RLS policies elsewhere in this
    // schema valid, and it guarantees public.users can never drift out of
    // sync with who Supabase Auth actually considers a valid identity.
    id: uuid("id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    email: citext("email").notNull().unique(),
    // Credential storage (password hash, OAuth tokens, MFA, sessions) is
    // owned entirely by Supabase Auth in the `auth` schema — there is no
    // legitimate way for this app to populate a password hash itself, so
    // the column from the original spec draft is intentionally dropped.
    authProvider: text("auth_provider").notNull().default("email"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    locale: text("locale").notNull().default("es-CO"),
    timezone: text("timezone").notNull().default("America/Bogota"),
    // Phase 7 Stage 2 addition: atomic per-user document-numbering
    // counters for cuentas de cobro / invoices — claimed via the same
    // race-safe `UPDATE ... SET x = x + 1 RETURNING x - 1` technique
    // `kanban_boards.next_task_number` already uses (see
    // `@/lib/services/finance`'s numbering helpers). Deliberately never
    // resets across years — the year in `CDC-{year}-{seq}` /
    // `INV-{year}-{seq}` just reflects `issueDate`'s year at claim time.
    nextCuentaDeCobroNumber: integer("next_cuenta_de_cobro_number").notNull().default(1),
    nextInvoiceNumber: integer("next_invoice_number").notNull().default(1),
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    index("idx_users_email").on(table.email),
    check(
      "users_auth_provider_check",
      sql`${table.authProvider} in ('email','google','microsoft')`
    ),
  ]
);
