import type { KanbanLabelColor } from "@/lib/validation/business";

/**
 * Label color palette (kanban feature pack, item 3) — a small FIXED preset,
 * not a free color picker. 6 new hues (`blue`/`teal`/`plum`/`clay`/`olive`/
 * `slate`, defined as `--label-*` tokens in `globals.css`) distinct from
 * this design system's 4 reserved semantic colors, PLUS those 4 semantic
 * colors themselves (`accent`/`success`/`warning`/`danger`) offered
 * directly — a freelancer might genuinely want to label a task "Urgente"
 * in the same red the rest of the app uses for danger/destructive states.
 * 10 presets total.
 *
 * Rendered as plain mono text in its color, per this system's "status
 * markers are plain text, never a pill/chip/background box" convention —
 * `kanban-card.tsx`/`task-detail-dialog.tsx`/`manage-labels-dialog.tsx` all
 * use `LABEL_COLOR_TEXT_CLASS`, never a background swatch.
 */
export const LABEL_COLOR_TEXT_CLASS: Record<KanbanLabelColor, string> = {
  blue: "text-label-blue",
  teal: "text-label-teal",
  plum: "text-label-plum",
  clay: "text-label-clay",
  olive: "text-label-olive",
  slate: "text-label-slate",
  accent: "text-accent",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

export const LABEL_COLOR_DISPLAY_NAME: Record<KanbanLabelColor, string> = {
  blue: "Azul",
  teal: "Turquesa",
  plum: "Ciruela",
  clay: "Terracota",
  olive: "Oliva",
  slate: "Pizarra",
  accent: "Violeta",
  success: "Verde",
  warning: "Ámbar",
  danger: "Rojo",
};

export const LABEL_COLOR_ORDER: KanbanLabelColor[] = [
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
];
