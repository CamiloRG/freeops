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
  // Kanban feature pack — card numbering (item 7): the next stable,
  // per-board sequential card number `createTask` will claim. Claimed
  // atomically via `UPDATE ... SET next_task_number = next_task_number + 1
  // RETURNING next_task_number - 1` (see `kanban.ts`), never a plain
  // read-then-write, so two concurrent `createTask` calls can never
  // receive the same number.
  nextTaskNumber: integer("next_task_number").notNull().default(1),
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
    // Kanban feature pack, item 2 (archive/restore): changed from
    // `.notNull().references(..., { onDelete: "cascade" })` to nullable +
    // `onDelete: "set null"` — found and fixed during this batch's own
    // real-system verification, not a pre-planned change. The ORIGINAL
    // cascade FK meant a hard-deleted column (`deleteColumn`'s
    // `tx.delete(kanbanColumns)`) destroyed EVERY task row referencing
    // it at the DB level, including already-soft-deleted ones — so the
    // "column deleted while an already-soft-deleted task still points at
    // it" edge case this feature pack's archive/restore is supposed to
    // handle could never actually occur; `restoreTask`'s fallback-column
    // logic was unreachable dead code. Confirmed directly against real
    // Postgres (`pg_constraint.confdeltype = 'c'`) before changing this.
    // `SET NULL` lets an already-soft-deleted task survive its column's
    // hard-delete with `column_id = null` — exactly the dangling case
    // `restoreTask` is written to detect and fall back from. A NON-
    // deleted task can never end up with a null `column_id` in practice:
    // `deleteColumn` already reassigns every remaining (non-deleted) task
    // to `moveTasksToColumnId` (or refuses to delete without one) before
    // ever issuing the hard delete, so only rows already excluded from
    // every board-rendering query (`deletedAt is not null`) are affected.
    columnId: uuid("column_id").references(() => kanbanColumns.id, { onDelete: "set null" }),
    // Denormalized for board-wide queries.
    boardId: uuid("board_id")
      .notNull()
      .references(() => kanbanBoards.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    position: integer("position").notNull(),
    dueDate: date("due_date"),
    // Kanban feature pack — card numbering (item 7): stable, per-board
    // sequential number, never reused/renumbered, claimed atomically from
    // `kanban_boards.next_task_number` (see `kanban.ts`'s `createTask`).
    // Deliberately nullable rather than `.notNull()`: a `NOT NULL` column
    // added to a table that may already hold rows needs either a literal
    // default (not possible here — each row needs a distinct, board-scoped
    // sequential value) or an interactive drizzle-kit "provide a default"
    // prompt at `generate` time, which this non-interactive environment
    // cannot answer. The migration backfills every existing row via a
    // `row_number() over (partition by board_id order by created_at)`
    // window function, and `createTask` always assigns one for every new
    // row going forward, so in practice this column is always populated —
    // just not hard-enforced NOT NULL at the DB level. Flagged as a
    // deliberate relaxation, same spirit as `wip_limit`'s own
    // nullable-by-design column.
    taskNumber: integer("task_number"),
    ...timestamps,
    ...softDelete,
  },
  (table) => [index("idx_kanban_tasks_column_position").on(table.columnId, table.position)]
);

// --- Kanban feature pack: labels, task-label attachments, checklists ------
//
// Added post-Phase-5, driven by a Trello feature-gap analysis (an Artifact,
// not a repo file) — see the ADR's "KANBAN FEATURE PACK" section for the
// full write-up, judgment calls, and verification.

/**
 * Board-scoped, reusable, colored labels. `color` is a key into a small
 * FIXED preset palette (`LABEL_COLOR_KEYS` in
 * `apps/web/src/lib/validation/business.ts`), not a free-text hex value —
 * enforced here too via a named CHECK constraint, same
 * enum-modeled-as-text-plus-CHECK convention as every other enum-like
 * column in this schema. No soft-delete: labels aren't tax/financial-
 * history data, and a hard delete cascades cleanly into
 * `kanban_task_labels`.
 */
export const kanbanLabels = pgTable(
  "kanban_labels",
  {
    id: idColumn(),
    boardId: uuid("board_id")
      .notNull()
      .references(() => kanbanBoards.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull(),
    ...timestamps,
  },
  (table) => [
    unique("kanban_labels_board_name_unique").on(table.boardId, table.name),
    check(
      "kanban_labels_color_check",
      sql`${table.color} in ('blue','teal','plum','clay','olive','slate','accent','success','warning','danger')`
    ),
  ]
);

/**
 * Task <-> label join table. This codebase has no pure composite-PK join
 * table precedent anywhere else (every table uses a surrogate `id` +
 * `unique()`, per a grep of every `schema/*.ts` file before adding this
 * one) — kept consistent with that established convention rather than
 * introducing a new composite-PK shape for just this table. No
 * timestamps: a pure attach/detach fact, nothing here is ever edited in
 * place.
 */
export const kanbanTaskLabels = pgTable(
  "kanban_task_labels",
  {
    id: idColumn(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => kanbanTasks.id, { onDelete: "cascade" }),
    labelId: uuid("label_id")
      .notNull()
      .references(() => kanbanLabels.id, { onDelete: "cascade" }),
  },
  (table) => [unique("kanban_task_labels_task_label_unique").on(table.taskId, table.labelId)]
);

/** Checklist items on a task's detail view. No soft-delete — trivial, hard-delete is fine and simpler. */
export const kanbanTaskChecklistItems = pgTable(
  "kanban_task_checklist_items",
  {
    id: idColumn(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => kanbanTasks.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    isDone: boolean("is_done").notNull().default(false),
    position: integer("position").notNull(),
    ...timestamps,
  },
  (table) => [index("idx_kanban_checklist_items_task_position").on(table.taskId, table.position)]
);
