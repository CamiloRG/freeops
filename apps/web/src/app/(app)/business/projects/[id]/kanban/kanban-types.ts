export interface KanbanLabel {
  id: string;
  name: string;
  color: string;
}

export interface KanbanChecklistSummary {
  total: number;
  done: number;
}

export interface KanbanTask {
  id: string;
  title: string;
  description: string | null;
  position: number;
  dueDate: string | null;
  taskNumber?: number | null;
  labels?: KanbanLabel[];
  checklist?: KanbanChecklistSummary | null;
}

export interface KanbanColumn {
  id: string;
  name: string;
  position: number;
  wipLimit: number | null;
  isDefault?: boolean;
  tasks: KanbanTask[];
}

export interface KanbanBoardData {
  id: string;
  columns: KanbanColumn[];
}

export interface KanbanArchivedTask {
  id: string;
  title: string;
  // Kanban feature pack: null when the task's column was hard-deleted
  // while it was already soft-deleted (`ON DELETE SET NULL` — see
  // `packages/db/src/schema/business.ts`'s doc comment on
  // `kanbanTasks.columnId`).
  columnId: string | null;
  columnName: string | null;
  deletedAt: string;
}

/**
 * The 4 seeded default column names are stored in English in the DB
 * (`projects.ts`'s `createProject` — a service-layer/schema-adjacent file,
 * out of the Ledger Quiet restyle's touch list). This maps only an EXACT
 * match of one of those 4 stored strings to its Spanish display label;
 * anything else (a renamed column, or a custom one the user added) renders
 * as typed, untouched. Translating the *display* only, not the stored
 * value. Re-exported from `@/lib/kanban/column-display` (kanban feature
 * pack) so the server-side WIP-limit rejection message can use the exact
 * same map without duplicating it — see that module's doc comment for why
 * duplication is specifically the bug class this codebase already hit
 * once (commit `cb1cce0`).
 */
export { displayColumnName } from "@/lib/kanban/column-display";
