/**
 * Platform-operator allowlist — backs the `/admin` operations dashboard
 * (user-proposed, no basis in app_spec.md; see the codebase-memory-mcp
 * ADR's discussion of admin visibility for the rationale).
 *
 * Deliberately NOT a `role` column on `users`: every row in `users` is
 * still just a freelancer — that identity model doesn't change. Admin
 * access is an orthogonal, additive operational fact (a small, manually
 * maintained allowlist of platform operators), not a variant of who a
 * "user" is. A row here says "this person can also see the ops dashboard",
 * nothing about their product-facing account.
 *
 * RLS: enabled with ZERO policies (migration 0014) — this is a deliberate
 * default-deny, unlike every other table in this schema, which has
 * explicit owner-scoped policies. There is no "owner" concept for a
 * platform-wide allowlist, and nothing in the product UI should ever read
 * it via the RLS-scoped `withRlsContext`/`withUserDb` path. Only
 * `getDb()` (packages/db/src/client.ts, the admin/background-job client
 * that intentionally bypasses RLS) may query this table — see
 * `apps/web/src/lib/admin/is-admin.ts`.
 */
import { pgTable, text, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./_helpers";
import { users } from "./identity";

export const platformAdmins = pgTable("platform_admins", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  // Freeform context for whoever's reading the allowlist later ("founder",
  // "support lead", ...) — not shown in any product UI, admin-eyes-only.
  note: text("note"),
  createdAt: timestamps.createdAt,
});
