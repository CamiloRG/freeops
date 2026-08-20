/**
 * CRM / Pipeline — app_spec.md § "Data Model & Schema" → "CRM / Pipeline".
 *
 * `crm_opportunities.converted_project_id` and `business.ts`'s
 * `projects.opportunity_id` form the two ends of the closed-won →
 * auto-project-creation link (interview §3.2); both are nullable and set
 * together by that automation. This creates a genuine mutual reference
 * between this file and `business.ts`, resolved with Drizzle's lazy
 * `AnyPgColumn` callback-reference pattern (safe under ESM's circular
 * imports because the callback is only invoked once both modules have
 * finished evaluating, e.g. by drizzle-kit at generate/push time).
 */
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { boolean, char, date, index, integer, numeric, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { citext, idColumn, softDelete, timestamps } from "./_helpers";
import { users } from "./identity";
import { projects } from "./business";

// [ASSUMED DEFAULT per spec] Pipeline stages modeled the same way as kanban
// columns (seeded defaults, freelancer can add/rename/reorder).
export const crmPipelineStages = pgTable(
  "crm_pipeline_stages",
  {
    id: idColumn(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull(),
    isWonStage: boolean("is_won_stage").notNull().default(false),
    isLostStage: boolean("is_lost_stage").notNull().default(false),
    isDefault: boolean("is_default").notNull().default(false), // true for the 6 seeded starter stages
    ...timestamps,
  },
  (table) => [unique("crm_pipeline_stages_user_position_unique").on(table.userId, table.position)]
);

export const crmOpportunities = pgTable(
  "crm_opportunities",
  {
    id: idColumn(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    stageId: uuid("stage_id")
      .notNull()
      .references(() => crmPipelineStages.id, { onDelete: "restrict" }),
    clientName: text("client_name").notNull(),
    clientEmail: citext("client_email"),
    clientPhone: text("client_phone"),
    dealValue: numeric("deal_value", { precision: 14, scale: 2 }),
    currency: char("currency", { length: 3 }).notNull().default("COP"),
    expectedCloseDate: date("expected_close_date"),
    notes: text("notes"),
    source: text("source"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    // Set by the closed-won automation, alongside business.ts's projects.opportunityId.
    convertedProjectId: uuid("converted_project_id").references((): AnyPgColumn => projects.id, {
      onDelete: "set null",
    }),
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    index("idx_crm_opportunities_user_stage")
      .on(table.userId, table.stageId)
      .where(sql`${table.deletedAt} is null`),
  ]
);
