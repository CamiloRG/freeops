/**
 * Identity & Auth — app_spec.md § "Data Model & Schema" → "Identity & Auth".
 *
 * Fine-grained auth (sessions, refresh tokens, OAuth account linking) lives
 * in Supabase Auth's own schema, not here — `users.id` is the join key the
 * rest of this schema references.
 */
import { check, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { citext, idColumn, softDelete, timestamps } from "./_helpers";

export const users = pgTable(
  "users",
  {
    id: idColumn(),
    email: citext("email").notNull().unique(),
    passwordHash: text("password_hash"), // null when OAuth-only
    authProvider: text("auth_provider").notNull().default("email"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    locale: text("locale").notNull().default("es-CO"),
    timezone: text("timezone").notNull().default("America/Bogota"),
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
