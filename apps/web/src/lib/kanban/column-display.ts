/**
 * Column-name display translation — extracted out of the kanban UI's own
 * `kanban-types.ts` (post-Phase-5 "Ledger Quiet" business-module restyle,
 * commit `cb1cce0`) so the server-side WIP-limit rejection message (kanban
 * feature pack, item 1) can name a column using the SAME Spanish display
 * name the board UI shows, without re-deriving or duplicating the map —
 * duplicating it was exactly the class of bug that commit fixed (the
 * column header and the "Mover a" menu drifting out of sync because two
 * copies of this map existed). One source of truth, imported by both the
 * frontend (`kanban-types.ts` re-exports from here, zero call-site changes
 * needed) and the backend (`lib/services/kanban.ts`).
 *
 * The 4 seeded default column names stay stored in English in the DB
 * (`lib/services/projects.ts`'s `createProject`) — only the *display* is
 * translated via this exact-match map; a renamed or custom column renders
 * exactly as typed, untouched.
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
