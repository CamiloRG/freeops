/**
 * Zod schemas for the Business module (Phase 5: Projects, Contract
 * Documents, Kanban) — app_spec.md § "API Contracts & Integrations" →
 * "5. Projects", "6. Contract & amendment documents", "7. Kanban boards,
 * columns & tasks". Same shared-frontend/backend pattern as
 * `@/lib/validation/personal`.
 *
 * Field-name mapping note (spec deviation, flagged in the phase report):
 * the API contract's prose lists `{ name, clientName, clientEmail?,
 * description?, startDate, expectedEndDate?, value? }` for
 * `POST /api/v1/projects`, but `packages/db/src/schema/business.ts`'s
 * `projects` table (which matches the Data Model section verbatim) has
 * `title` (not `name`), `deal_value` (not `value`), and three separate
 * date columns (`expected_start_date`, `start_date`, `end_date`) rather
 * than one `startDate`/`expectedEndDate` pair. Mapping used throughout
 * this phase: API `name` <-> column `title`, API `value` <-> column
 * `deal_value`, API `startDate` <-> column `start_date`, API
 * `expectedEndDate` <-> column `end_date`. `expected_start_date` has no
 * corresponding API contract field this phase — it stays null for every
 * manually-created project, same as `opportunity_id`, until Phase 6's
 * CRM auto-project-creation flow populates it.
 */
import { z } from "zod";

export const projectStatusSchema = z.enum(["active", "completed", "archived", "cancelled"]);

export const projectCreateSchema = z.object({
  name: z.string().trim().min(1, "Enter a project name.").max(300),
  clientName: z.string().trim().min(1, "Enter the client's name.").max(300),
  clientEmail: z.email("Enter a valid email.").trim().optional().or(z.literal("")),
  clientTaxId: z.string().trim().max(30).optional().or(z.literal("")),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  scopeNotes: z.string().trim().max(4000).optional().or(z.literal("")),
  startDate: z.string().trim().min(1, "Enter a start date."), // ISO date (YYYY-MM-DD)
  expectedEndDate: z.string().trim().optional().or(z.literal("")),
  value: z.number().nonnegative().optional().nullable(),
  currency: z.string().trim().length(3).optional(),
});
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;

export const projectUpdateSchema = z.object({
  name: z.string().trim().min(1).max(300).optional(),
  clientName: z.string().trim().min(1).max(300).optional(),
  clientEmail: z.email("Enter a valid email.").trim().optional().or(z.literal("")),
  clientTaxId: z.string().trim().max(30).optional().or(z.literal("")),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  scopeNotes: z.string().trim().max(4000).optional().or(z.literal("")),
  status: projectStatusSchema.optional(),
  startDate: z.string().trim().optional().or(z.literal("")),
  expectedEndDate: z.string().trim().optional().or(z.literal("")),
  value: z.number().nonnegative().optional().nullable(),
  currency: z.string().trim().length(3).optional(),
});
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;

export const contractDocumentTypeSchema = z.enum([
  "executed_contract",
  "amendment",
  "appendix",
  "change_order",
]);

export const contractDocumentUploadMetaSchema = z.object({
  type: contractDocumentTypeSchema,
  label: z.string().trim().min(1, "Enter a document label.").max(300),
});

// --- Kanban ------------------------------------------------------------

export const kanbanColumnCreateSchema = z.object({
  name: z.string().trim().min(1, "Enter a column name.").max(120),
  position: z.number().int().min(0).optional(),
});
export type KanbanColumnCreateInput = z.infer<typeof kanbanColumnCreateSchema>;

export const kanbanColumnUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  position: z.number().int().min(0).optional(),
  // Kanban feature pack, item 1 (WIP limits): `null` explicitly clears the
  // limit back to unlimited; `undefined` (the field simply absent) leaves
  // it unchanged, same "absent vs null" convention `kanbanTaskUpdateSchema`
  // already uses for `description`/`dueDate` below.
  wipLimit: z.number().int().min(1).max(999).nullable().optional(),
});
export type KanbanColumnUpdateInput = z.infer<typeof kanbanColumnUpdateSchema>;

export const kanbanColumnDeleteSchema = z.object({
  moveTasksToColumnId: z.uuid().optional(),
});

export const kanbanTaskCreateSchema = z.object({
  title: z.string().trim().min(1, "Enter a task title.").max(300),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  dueDate: z.string().trim().optional().or(z.literal("")),
});
export type KanbanTaskCreateInput = z.infer<typeof kanbanTaskCreateSchema>;

export const kanbanTaskUpdateSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().max(4000).optional().or(z.literal("")).nullable(),
  dueDate: z.string().trim().optional().or(z.literal("")).nullable(),
  columnId: z.uuid().optional(),
  position: z.number().int().min(0).optional(),
});
export type KanbanTaskUpdateInput = z.infer<typeof kanbanTaskUpdateSchema>;

// --- Kanban feature pack (post-Phase-5) ---------------------------------
//
// Driven by a Trello feature-gap analysis (an Artifact, not a repo file).
// See the ADR's "KANBAN FEATURE PACK" section for the full write-up.

/**
 * Fixed preset label-color palette (item 3). Deliberately NOT a free color
 * picker — 6 new, muted, plain-mono-legible hues distinct from this
 * design system's 4 reserved semantic colors (`--accent`/`--success`/
 * `--warning`/`--danger`), so a label is never visually mistaken for a
 * real system status. `accent`/`success`/`warning`/`danger` are ALSO
 * offered (labels-as-status-language, e.g. "Urgente" in `--danger`) per
 * the phase instructions' explicit sanctioning of that option — 10 keys
 * total. See `globals.css` for the 6 new `--label-*` token definitions and
 * `kanban-label.tsx` for the Spanish display name + token mapping.
 */
export const LABEL_COLOR_KEYS = [
  "blue",
  "teal",
  "plum",
  "clay",
  "olive",
  "slate",
  "accent",
  "success",
  "warning",
  "danger",
] as const;
export const kanbanLabelColorSchema = z.enum(LABEL_COLOR_KEYS);
export type KanbanLabelColor = z.infer<typeof kanbanLabelColorSchema>;

export const kanbanLabelCreateSchema = z.object({
  name: z.string().trim().min(1, "Ponle un nombre a la etiqueta.").max(80),
  color: kanbanLabelColorSchema,
});
export type KanbanLabelCreateInput = z.infer<typeof kanbanLabelCreateSchema>;

export const kanbanLabelUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  color: kanbanLabelColorSchema.optional(),
});
export type KanbanLabelUpdateInput = z.infer<typeof kanbanLabelUpdateSchema>;

export const kanbanChecklistItemCreateSchema = z.object({
  text: z.string().trim().min(1, "Escribe un ítem de la lista.").max(500),
});
export type KanbanChecklistItemCreateInput = z.infer<typeof kanbanChecklistItemCreateSchema>;

export const kanbanChecklistItemUpdateSchema = z.object({
  text: z.string().trim().min(1).max(500).optional(),
  isDone: z.boolean().optional(),
});
export type KanbanChecklistItemUpdateInput = z.infer<typeof kanbanChecklistItemUpdateSchema>;

/**
 * Bulk position renumber for a task's checklist items — `reorderChecklistItems`
 * has no drag-and-drop UI wired to it this batch (the Task Detail dialog's
 * spec never described item-reordering interaction, unlike columns/tasks
 * which have an explicit drag contract) — kept as a real, callable
 * service function + route per the phase instructions' explicit ask,
 * proportionate-scope judgment call flagged in the ADR.
 */
export const kanbanChecklistReorderSchema = z.object({
  orderedItemIds: z.array(z.uuid()).min(1),
});
export type KanbanChecklistReorderInput = z.infer<typeof kanbanChecklistReorderSchema>;
