/**
 * Deletion-warning audit log — app_spec.md § "Data Model & Schema" →
 * "Deletion-warning audit log".
 *
 * Supports "warn before deleting DIAN-retention-relevant records" without
 * a hard block: drives the UI warning copy and gives the freelancer/
 * accountant an audit trail proving the warning was shown.
 */
import { boolean, check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { idColumn } from "./_helpers";
import { users } from "./identity";

export const deletionWarnings = pgTable(
  "deletion_warnings",
  {
    id: idColumn(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(), // e.g. 'cuenta_de_cobro', 'invoice', 'contract_document', 'pila_record', ...
    entityId: uuid("entity_id").notNull(),
    action: text("action").notNull(), // soft_delete_requested | soft_delete_confirmed | restore
    // true if the record is younger than ~5 years, i.e. still inside the DIAN audit window.
    withinDianWindow: boolean("within_dian_window").notNull(),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }), // when the user clicked through the warning
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_deletion_warnings_entity").on(table.entityType, table.entityId),
    index("idx_deletion_warnings_user").on(table.userId, table.createdAt),
    check(
      "deletion_warnings_action_check",
      sql`${table.action} in ('soft_delete_requested','soft_delete_confirmed','restore')`
    ),
  ]
);
