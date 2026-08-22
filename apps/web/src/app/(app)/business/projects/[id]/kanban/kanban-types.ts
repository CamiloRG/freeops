export interface KanbanTask {
  id: string;
  title: string;
  description: string | null;
  position: number;
  dueDate: string | null;
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

/**
 * The 4 seeded default column names are stored in English in the DB
 * (`projects.ts`'s `createProject` — a service-layer/schema-adjacent file,
 * out of the Ledger Quiet restyle's touch list). This maps only an EXACT
 * match of one of those 4 stored strings to its Spanish display label;
 * anything else (a renamed column, or a custom one the user added) renders
 * as typed, untouched. Translating the *display* only, not the stored
 * value. Shared here (not local to one component) so every place that
 * shows a column name — the column header itself (`kanban-column.tsx`) AND
 * the "Mover a" menu listing other columns (`kanban-card.tsx`) — stays in
 * sync; keeping two separate copies previously let the column header show
 * "EN PROGRESO" while the move-menu still showed raw "In Progress" for the
 * exact same column.
 */
const DEFAULT_COLUMN_DISPLAY_LABEL: Record<string, string> = {
  Backlog: "Backlog",
  "In Progress": "En progreso",
  Review: "Revisión",
  Done: "Hecho",
};

export function displayColumnName(name: string) {
  return DEFAULT_COLUMN_DISPLAY_LABEL[name] ?? name;
}
