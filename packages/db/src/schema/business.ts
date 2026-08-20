/**
 * Business: Projects, Contracts, Kanban — app_spec.md § "Data Model &
 * Schema" → "Business: Projects, Contracts, Kanban".
 *
 * See `crm.ts` for the closed-won → auto-project-creation link and the
 * note on the mutual `projects` ↔ `crm_opportunities` reference.
 */
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  bigint,
  boolean,
  char,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { citext, idColumn, softDelete, timestamps } from "./_helpers";
import { users } from "./identity";
import { crmOpportunities } from "./crm";

export const projects = pgTable(
  "projects",
  {
    id: idColumn(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    // Set when auto-created from closed-won — see crm.ts.
    opportunityId: uuid("opportunity_id").references((): AnyPgColumn => crmOpportunities.id, {
      onDelete: "set null",
    }),
    clientName: text("client_name").notNull(),
    clientEmail: citext("client_email"),
    clientTaxId: text("client_tax_id"),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("active"), // active | completed | archived | cancelled
    scopeNotes: text("scope_notes"),
    dealValue: numeric("deal_value", { precision: 14, scale: 2 }),
    currency: char("currency", { length: 3 }).notNull().default("COP"),
    expectedStartDate: date("expected_start_date"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    index("idx_projects_user_status")
      .on(table.userId, table.status)
      .where(sql`${table.deletedAt} is null`),
    check("projects_status_check", sql`${table.status} in ('active','completed','archived','cancelled')`),
  ]
);

// Financial/tax-relevant: soft-delete + DIAN warning applies (executed contracts are audit evidence).
export const contractDocuments = pgTable(
  "contract_documents",
  {
    id: idColumn(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "restrict" }),
    documentType: text("document_type").notNull(), // executed_contract | amendment | appendix | change_order
    title: text("title").notNull(),
    version: integer("version").notNull().default(1),
    // Links an amendment/appendix back to the base contract or prior version.
    parentDocumentId: uuid("parent_document_id").references((): AnyPgColumn => contractDocuments.id, {
      onDelete: "set null",
    }),
    fileKey: text("file_key").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type"),
    fileSizeBytes: bigint("file_size_bytes", { mode: "number" }),
    effectiveDate: date("effective_date"),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    index("idx_contract_documents_project").on(table.projectId, table.documentType),
    check(
      "contract_documents_document_type_check",
      sql`${table.documentType} in ('executed_contract','amendment','appendix','change_order')`
    ),
  ]
);

export const kanbanBoards = pgTable("kanban_boards", {
  id: idColumn(),
  projectId: uuid("project_id")
    .notNull()
    .unique()
    .references(() => projects.id, { onDelete: "cascade" }),
  ...timestamps,
  ...softDelete,
});

export const kanbanColumns = pgTable(
  "kanban_columns",
  {
    id: idColumn(),
    boardId: uuid("board_id")
      .notNull()
      .references(() => kanbanBoards.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull(),
    isDefault: boolean("is_default").notNull().default(false), // true for the 4 seeded starter columns
    wipLimit: integer("wip_limit"),
    ...timestamps,
  },
  (table) => [unique("kanban_columns_board_position_unique").on(table.boardId, table.position)]
);

export const kanbanTasks = pgTable(
  "kanban_tasks",
  {
    id: idColumn(),
    columnId: uuid("column_id")
      .notNull()
      .references(() => kanbanColumns.id, { onDelete: "cascade" }),
    // Denormalized for board-wide queries.
    boardId: uuid("board_id")
      .notNull()
      .references(() => kanbanBoards.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    position: integer("position").notNull(),
    dueDate: date("due_date"),
    ...timestamps,
    ...softDelete,
  },
  (table) => [index("idx_kanban_tasks_column_position").on(table.columnId, table.position)]
);
