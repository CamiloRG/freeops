/**
 * Kanban boards, columns & tasks — app_spec.md § "API Contracts &
 * Integrations" → "7. Kanban boards, columns & tasks", and § "UX &
 * Frontend" → "Flow — Kanban board interaction" for the optimistic-
 * move/rollback contract the `PATCH .../tasks/:taskId` endpoint backs.
 *
 * Ownership for column/task routes is enforced entirely by RLS's
 * transitive `kanban_columns`/`kanban_tasks` policies (column -> board ->
 * project -> user_id, see `packages/db/migrations/0004_row_level_
 * security.sql`) — a plain `findFirst({ where: eq(id, ...) })` here
 * already returns nothing for a row some other user owns, so there is
 * deliberately no extra manual ownership check layered on top (the phase
 * instructions are explicit that RLS itself is the mechanism, not a
 * belt-and-suspenders app-layer join).
 *
 * `kanban_columns.position` carries a real `unique(board_id, position)` DB
 * constraint (immediate, not deferred), so any reorder that would produce
 * a transient duplicate mid-transaction (e.g. swapping two columns) uses
 * `reorderColumns`'s two-phase temporary-negative-position renumber to
 * avoid it. `kanban_tasks.position` has no such unique constraint (just an
 * index), so task moves assign final positions directly.
 */
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import {
  kanbanBoards,
  kanbanColumns,
  kanbanLabels,
  kanbanTaskChecklistItems,
  kanbanTaskLabels,
  kanbanTasks,
} from "@freeops/db/schema";
import type { RlsTx } from "@freeops/db/rls-client";
import { ApiError } from "@/lib/api/errors";
import { getOwnedProject } from "@/lib/services/projects";
import { displayColumnName } from "@/lib/kanban/column-display";
import type {
  KanbanChecklistItemCreateInput,
  KanbanChecklistItemUpdateInput,
  KanbanColumnCreateInput,
  KanbanColumnUpdateInput,
  KanbanLabelCreateInput,
  KanbanLabelUpdateInput,
  KanbanTaskCreateInput,
  KanbanTaskUpdateInput,
} from "@/lib/validation/business";

/**
 * WIP limits (kanban feature pack, item 1). `wip_limit` gates NEW
 * arrivals into a column only — `createTask` (direct add) and
 * `moveOrUpdateTask` when it's a genuine cross-column move. It must never
 * block: editing a task's fields in place, reordering within its current
 * column, or a column that already exceeds its limit continuing to exist
 * (no retroactive invalidation — see each call site below).
 */
function wipLimitMessage(action: "agregar" | "mover" | "restaurar", columnName: string, limit: number) {
  const display = displayColumnName(columnName);
  return `No se pudo ${action} la tarea — la columna "${display}" ya tiene su límite de ${limit} tarea${
    limit === 1 ? "" : "s"
  }.`;
}

async function countNonDeletedTasksInColumn(tx: RlsTx, columnId: string): Promise<number> {
  const rows = await tx.query.kanbanTasks.findMany({
    where: and(eq(kanbanTasks.columnId, columnId), isNull(kanbanTasks.deletedAt)),
    columns: { id: true },
  });
  return rows.length;
}

/** Throws `ApiError("UNPROCESSABLE_ENTITY", ...)` if `column` is already at/over its `wip_limit`. No-op if unlimited. */
async function assertColumnHasCapacity(
  tx: RlsTx,
  column: { id: string; name: string; wipLimit: number | null },
  action: "agregar" | "mover" | "restaurar"
) {
  if (column.wipLimit == null) return;
  const count = await countNonDeletedTasksInColumn(tx, column.id);
  if (count >= column.wipLimit) {
    throw new ApiError("UNPROCESSABLE_ENTITY", wipLimitMessage(action, column.name, column.wipLimit), {
      columnId: column.id,
      wipLimit: column.wipLimit,
    });
  }
}

// --- Board ---------------------------------------------------------------

export async function getBoardForProject(tx: RlsTx, userId: string, projectId: string) {
  const project = await getOwnedProject(tx, userId, projectId);
  if (!project) return null;

  const board = await tx.query.kanbanBoards.findFirst({ where: eq(kanbanBoards.projectId, project.id) });
  if (!board) return null;

  const columns = await tx.query.kanbanColumns.findMany({
    where: eq(kanbanColumns.boardId, board.id),
    orderBy: [asc(kanbanColumns.position)],
  });

  const tasks = await tx.query.kanbanTasks.findMany({
    where: and(eq(kanbanTasks.boardId, board.id), isNull(kanbanTasks.deletedAt)),
    orderBy: [asc(kanbanTasks.position)],
  });

  // Kanban feature pack: `getBoardForProject` is this board's single
  // source of truth, so each task's attached labels (item 3) and
  // checklist completion summary (item 4) are folded in here via two
  // batched queries keyed on this board's task ids — never a second
  // round-trip per card.
  const taskIds = tasks.map((t) => t.id);
  const [labelRows, checklistRows] =
    taskIds.length > 0
      ? await Promise.all([
          tx
            .select({
              taskId: kanbanTaskLabels.taskId,
              id: kanbanLabels.id,
              name: kanbanLabels.name,
              color: kanbanLabels.color,
            })
            .from(kanbanTaskLabels)
            .innerJoin(kanbanLabels, eq(kanbanLabels.id, kanbanTaskLabels.labelId))
            .where(inArray(kanbanTaskLabels.taskId, taskIds)),
          tx.query.kanbanTaskChecklistItems.findMany({
            where: inArray(kanbanTaskChecklistItems.taskId, taskIds),
            columns: { taskId: true, isDone: true },
          }),
        ])
      : [[], []];

  const labelsByTask = new Map<string, { id: string; name: string; color: string }[]>();
  for (const row of labelRows) {
    const arr = labelsByTask.get(row.taskId) ?? [];
    arr.push({ id: row.id, name: row.name, color: row.color });
    labelsByTask.set(row.taskId, arr);
  }

  const checklistByTask = new Map<string, { total: number; done: number }>();
  for (const item of checklistRows) {
    const current = checklistByTask.get(item.taskId) ?? { total: 0, done: 0 };
    current.total += 1;
    if (item.isDone) current.done += 1;
    checklistByTask.set(item.taskId, current);
  }

  return {
    board,
    columns: columns.map((column) => ({
      ...column,
      tasks: tasks
        .filter((task) => task.columnId === column.id)
        .map((task) => ({
          ...task,
          labels: labelsByTask.get(task.id) ?? [],
          checklist: checklistByTask.get(task.id) ?? null,
        })),
    })),
  };
}

/** RLS-scoped board lookup for a project, without the full column/task fetch `getBoardForProject` does — used by routes that only need the board id (e.g. the archived-tasks list). */
export async function getOwnedBoard(tx: RlsTx, userId: string, projectId: string) {
  const project = await getOwnedProject(tx, userId, projectId);
  if (!project) return null;
  return tx.query.kanbanBoards.findFirst({ where: eq(kanbanBoards.projectId, project.id) });
}

/** Two-phase renumber (temp negative positions, then final 0..n-1) — avoids the `unique(board_id, position)` constraint firing on a transient duplicate mid-reorder. */
async function reorderColumns(tx: RlsTx, orderedColumnIds: string[]) {
  for (let i = 0; i < orderedColumnIds.length; i++) {
    await tx.update(kanbanColumns).set({ position: -(i + 1) }).where(eq(kanbanColumns.id, orderedColumnIds[i]));
  }
  for (let i = 0; i < orderedColumnIds.length; i++) {
    await tx
      .update(kanbanColumns)
      .set({ position: i, updatedAt: new Date() })
      .where(eq(kanbanColumns.id, orderedColumnIds[i]));
  }
}

// --- Columns ---------------------------------------------------------------

export async function createColumn(tx: RlsTx, userId: string, projectId: string, input: KanbanColumnCreateInput) {
  const project = await getOwnedProject(tx, userId, projectId);
  if (!project) return null;
  const board = await tx.query.kanbanBoards.findFirst({ where: eq(kanbanBoards.projectId, project.id) });
  if (!board) return null;

  const existing = await tx.query.kanbanColumns.findMany({
    where: eq(kanbanColumns.boardId, board.id),
    orderBy: [asc(kanbanColumns.position)],
  });

  // Pre-existing bug fix (found during this batch's own archive/restore
  // verification, which was the first time anything in this codebase's
  // history actually exercised "+ Agregar columna" end-to-end against a
  // board that already has its 4 default columns — see the ADR's kanban
  // feature pack section): the new row's placeholder position must not
  // collide with `reorderColumns`'s own temporary negative-value phase
  // (`-(i+1)` for each column being reordered, including this new one).
  // The old placeholder (`-1`) collided with that phase's very first
  // temp value whenever the new column wasn't first in `orderedIds`,
  // throwing `kanban_columns_board_position_unique` — a real, latent bug,
  // not something this batch introduced. `existing.length` (one past the
  // current max real position) is guaranteed free of every existing row
  // AND of every value the negative phase will use, since real positions
  // are always a contiguous `0..existing.length-1` range (that invariant
  // is what `reorderColumns` itself maintains).
  const [created] = await tx
    .insert(kanbanColumns)
    .values({ boardId: board.id, name: input.name, position: existing.length, isDefault: false })
    .returning();

  const targetIndex = Math.min(Math.max(input.position ?? existing.length, 0), existing.length);
  const orderedIds = existing.map((c) => c.id);
  orderedIds.splice(targetIndex, 0, created.id);
  await reorderColumns(tx, orderedIds);

  return tx.query.kanbanColumns.findFirst({ where: eq(kanbanColumns.id, created.id) });
}

export async function getColumnById(tx: RlsTx, columnId: string) {
  return tx.query.kanbanColumns.findFirst({ where: eq(kanbanColumns.id, columnId) });
}

export async function updateColumn(tx: RlsTx, columnId: string, input: KanbanColumnUpdateInput) {
  const column = await getColumnById(tx, columnId);
  if (!column) return null;

  if (input.position !== undefined) {
    const siblings = await tx.query.kanbanColumns.findMany({
      where: eq(kanbanColumns.boardId, column.boardId),
      orderBy: [asc(kanbanColumns.position)],
    });
    const withoutMoved = siblings.filter((c) => c.id !== columnId).map((c) => c.id);
    const targetIndex = Math.min(Math.max(input.position, 0), withoutMoved.length);
    withoutMoved.splice(targetIndex, 0, columnId);
    await reorderColumns(tx, withoutMoved);
  }

  if (input.name !== undefined) {
    await tx.update(kanbanColumns).set({ name: input.name, updatedAt: new Date() }).where(eq(kanbanColumns.id, columnId));
  }

  // Kanban feature pack, item 1: `wipLimit` set/clear ("Límite de tareas").
  // `undefined` (field absent) leaves it unchanged; `null` explicitly
  // clears it back to unlimited — see `kanbanColumnUpdateSchema`. Setting
  // a limit below the column's current task count is deliberately allowed
  // (no retroactive invalidation) — only future arrivals are gated, at
  // `createTask`/`moveOrUpdateTask`/`restoreTask`.
  if (input.wipLimit !== undefined) {
    await tx
      .update(kanbanColumns)
      .set({ wipLimit: input.wipLimit, updatedAt: new Date() })
      .where(eq(kanbanColumns.id, columnId));
  }

  return tx.query.kanbanColumns.findFirst({ where: eq(kanbanColumns.id, columnId) });
}

export async function deleteColumn(tx: RlsTx, columnId: string, moveTasksToColumnId?: string) {
  const column = await getColumnById(tx, columnId);
  if (!column) return { status: "not_found" as const };

  const remainingTasks = await tx.query.kanbanTasks.findMany({
    where: and(eq(kanbanTasks.columnId, columnId), isNull(kanbanTasks.deletedAt)),
  });

  if (remainingTasks.length > 0) {
    if (!moveTasksToColumnId) {
      return { status: "needs_target" as const };
    }
    // RLS-scoped lookup — also confirms the target column exists and is
    // reachable by this user, but callers must additionally confirm it's
    // on the same board (checked here, not by RLS, since RLS can't know
    // "same board" is required by this specific operation).
    const target = await getColumnById(tx, moveTasksToColumnId);
    if (!target || target.boardId !== column.boardId) {
      throw new ApiError("VALIDATION_ERROR", "`moveTasksToColumnId` must be another column on the same board.");
    }

    const targetTasks = await tx.query.kanbanTasks.findMany({
      where: and(eq(kanbanTasks.columnId, moveTasksToColumnId), isNull(kanbanTasks.deletedAt)),
    });
    let nextPosition = targetTasks.length > 0 ? Math.max(...targetTasks.map((t) => t.position)) + 1 : 0;
    for (const task of remainingTasks) {
      await tx
        .update(kanbanTasks)
        .set({ columnId: moveTasksToColumnId, position: nextPosition, updatedAt: new Date() })
        .where(eq(kanbanTasks.id, task.id));
      nextPosition += 1;
    }
  }

  await tx.delete(kanbanColumns).where(eq(kanbanColumns.id, columnId));
  return { status: "deleted" as const };
}

// --- Tasks ---------------------------------------------------------------

export async function createTask(tx: RlsTx, columnId: string, input: KanbanTaskCreateInput) {
  const column = await getColumnById(tx, columnId);
  if (!column) return null;

  // Kanban feature pack, item 1: adding directly into a column is a "new
  // arrival" — gated by the destination column's WIP limit exactly like a
  // cross-column move (see `moveOrUpdateTask`).
  await assertColumnHasCapacity(tx, column, "agregar");

  const siblings = await tx.query.kanbanTasks.findMany({
    where: and(eq(kanbanTasks.columnId, columnId), isNull(kanbanTasks.deletedAt)),
  });
  const position = siblings.length > 0 ? Math.max(...siblings.map((t) => t.position)) + 1 : 0;

  // Kanban feature pack, item 7 (card numbering): atomically claim this
  // board's current `next_task_number` and advance it in one `UPDATE ...
  // RETURNING` — the row-level lock Postgres takes for the duration of
  // this UPDATE serializes any concurrent `createTask` call on the same
  // board, so two concurrent creates can never receive the same number
  // (a plain read-then-write here would race).
  const [claimed] = await tx
    .update(kanbanBoards)
    .set({ nextTaskNumber: sql`${kanbanBoards.nextTaskNumber} + 1` })
    .where(eq(kanbanBoards.id, column.boardId))
    .returning({ taskNumber: sql<number>`${kanbanBoards.nextTaskNumber} - 1` });

  const [created] = await tx
    .insert(kanbanTasks)
    .values({
      columnId,
      boardId: column.boardId,
      title: input.title,
      description: input.description || null,
      dueDate: input.dueDate || null,
      position,
      taskNumber: claimed.taskNumber,
    })
    .returning();
  return created;
}

export async function getTaskById(tx: RlsTx, taskId: string) {
  return tx.query.kanbanTasks.findFirst({ where: eq(kanbanTasks.id, taskId) });
}

/**
 * Edits and/or moves a task. A `columnId` change is what the kanban UI's
 * drag-and-drop (and its accessible "Move" menu equivalent) calls — see
 * this file's doc comment. Moving between columns re-sequences both the
 * destination column (task inserted at `position`) so ordering stays
 * sane; the origin column's remaining tasks keep their existing relative
 * order with a harmless gap (no unique constraint on `kanban_tasks.
 * position`, so this doesn't need the columns' two-phase renumber).
 */
export async function moveOrUpdateTask(tx: RlsTx, taskId: string, input: KanbanTaskUpdateInput) {
  const task = await getTaskById(tx, taskId);
  if (!task) return null;

  const targetColumnId = input.columnId ?? task.columnId;
  if (!targetColumnId) {
    // `task.columnId` is only ever null for a task whose column was
    // hard-deleted while it was already soft-deleted (see business.ts's
    // doc comment on `kanbanTasks.columnId`) — i.e. an archived task. This
    // route isn't meant to edit archived tasks (restore it first via
    // `restoreTask`), so this is a defensive guard, not an expected path.
    throw new ApiError("VALIDATION_ERROR", "This task has no column — restore it before editing it.");
  }
  // Kanban feature pack, item 1: only a GENUINE cross-column move (task
  // currently in a different column than the requested `columnId`) is a
  // "new arrival" subject to the destination's WIP limit. Editing
  // title/description/dueDate with no `columnId` change, or reordering
  // within the SAME column (`columnId` present but equal to the task's
  // current column — the accessible Move menu never does this, but a
  // client could), must never be blocked by this check.
  const isCrossColumnMove = input.columnId !== undefined && input.columnId !== task.columnId;
  if (input.columnId !== undefined) {
    const targetColumn = await getColumnById(tx, targetColumnId);
    if (!targetColumn) {
      throw new ApiError("VALIDATION_ERROR", "`columnId` does not refer to a column you own.");
    }
    if (isCrossColumnMove) {
      await assertColumnHasCapacity(tx, targetColumn, "mover");
    }
  }

  if (input.columnId !== undefined || input.position !== undefined) {
    const destSiblings = await tx.query.kanbanTasks.findMany({
      where: and(eq(kanbanTasks.columnId, targetColumnId), isNull(kanbanTasks.deletedAt)),
    });
    const withoutMoved = destSiblings.filter((t) => t.id !== taskId).map((t) => t.id);
    const targetIndex = Math.min(Math.max(input.position ?? withoutMoved.length, 0), withoutMoved.length);
    withoutMoved.splice(targetIndex, 0, taskId);

    for (let i = 0; i < withoutMoved.length; i++) {
      await tx
        .update(kanbanTasks)
        .set({
          position: i,
          columnId: targetColumnId,
          updatedAt: new Date(),
          ...(withoutMoved[i] === taskId
            ? {
                title: input.title ?? undefined,
                description: input.description !== undefined ? input.description || null : undefined,
                dueDate: input.dueDate !== undefined ? input.dueDate || null : undefined,
              }
            : {}),
        })
        .where(eq(kanbanTasks.id, withoutMoved[i]));
    }
  } else if (input.title !== undefined || input.description !== undefined || input.dueDate !== undefined) {
    await tx
      .update(kanbanTasks)
      .set({
        title: input.title ?? undefined,
        description: input.description !== undefined ? input.description || null : undefined,
        dueDate: input.dueDate !== undefined ? input.dueDate || null : undefined,
        updatedAt: new Date(),
      })
      .where(eq(kanbanTasks.id, taskId));
  }

  return tx.query.kanbanTasks.findFirst({ where: eq(kanbanTasks.id, taskId) });
}

export async function deleteTask(tx: RlsTx, taskId: string) {
  const [updated] = await tx
    .update(kanbanTasks)
    .set({ deletedAt: new Date() })
    .where(eq(kanbanTasks.id, taskId))
    .returning();
  return updated;
}

// --- Archive / restore (kanban feature pack, item 2) ----------------------

/**
 * Soft-deleted tasks for a board, most-recently-deleted first, each
 * paired with the (possibly no-longer-existing) column they'd return to —
 * `deleteColumn` **hard**-deletes columns (see that function above), and a
 * column can be removed while it still has already-soft-deleted tasks
 * pointing at it (`deleteColumn`'s `needs_target` check only counts
 * NON-deleted tasks). Since `kanban_tasks.column_id` is `ON DELETE SET
 * NULL` (see business.ts's doc comment on that column — changed from the
 * schema's original `cascade` specifically to make this case survivable
 * rather than destroying the row outright), such a task's `columnId` is
 * genuinely `null` here, not a stale/dangling id — `columnName` is `null`
 * for that same case; the caller (route/UI) shows "esta columna ya no
 * existe" instead of a name.
 */
export async function listArchivedTasks(tx: RlsTx, boardId: string) {
  const tasks = await tx.query.kanbanTasks.findMany({
    where: and(eq(kanbanTasks.boardId, boardId), isNotNull(kanbanTasks.deletedAt)),
    orderBy: [desc(kanbanTasks.deletedAt)],
  });
  if (tasks.length === 0) return [];

  const columnIds = [...new Set(tasks.map((t) => t.columnId).filter((id): id is string => id !== null))];
  const columns =
    columnIds.length > 0
      ? await tx.query.kanbanColumns.findMany({ where: inArray(kanbanColumns.id, columnIds) })
      : [];
  const columnById = new Map(columns.map((c) => [c.id, c]));

  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    columnId: task.columnId,
    columnName: task.columnId ? (columnById.get(task.columnId)?.name ?? null) : null,
    deletedAt: task.deletedAt!,
  }));
}

/**
 * Restores a soft-deleted task. Handles the real dangling-column edge
 * case rather than assuming it away: if the task's original `columnId` no
 * longer exists (the column was hard-deleted while this task was already
 * soft-deleted — see `listArchivedTasks`'s doc comment), this restores
 * the task into the board's lowest-position column instead of ever
 * writing back a dangling `columnId` (option (a) from the phase
 * instructions — silently corrupting the row with a foreign key that no
 * longer resolves was never on the table). If the board somehow has NO
 * columns left at all (every column deleted — an extreme edge case this
 * schema doesn't otherwise prevent), restore is rejected with a clear
 * error rather than guessing. Either way, the restored task's title/
 * description/dueDate are left completely untouched — only `columnId`/
 * `position`/`deletedAt` change. A restore is still an "arrival" into a
 * column, so the destination's WIP limit (item 1) is re-checked here too,
 * surfaced through the identical `ApiError` shape as a move/create
 * rejection.
 */
export async function restoreTask(tx: RlsTx, taskId: string) {
  const task = await getTaskById(tx, taskId);
  if (!task || !task.deletedAt) return null;

  // `task.columnId` is `null` exactly when its column was hard-deleted
  // while this task was already soft-deleted (`ON DELETE SET NULL` — see
  // business.ts). A non-null `columnId` might STILL no longer resolve to
  // a real row in some other edge case, so both are checked the same way.
  let targetColumn = task.columnId ? await getColumnById(tx, task.columnId) : undefined;
  if (!targetColumn) {
    const fallbackColumns = await tx.query.kanbanColumns.findMany({
      where: eq(kanbanColumns.boardId, task.boardId),
      orderBy: [asc(kanbanColumns.position)],
      limit: 1,
    });
    targetColumn = fallbackColumns[0];
    if (!targetColumn) {
      throw new ApiError(
        "UNPROCESSABLE_ENTITY",
        "No se pudo restaurar la tarea — este tablero ya no tiene columnas."
      );
    }
  }

  await assertColumnHasCapacity(tx, targetColumn, "restaurar");

  const siblings = await tx.query.kanbanTasks.findMany({
    where: and(eq(kanbanTasks.columnId, targetColumn.id), isNull(kanbanTasks.deletedAt)),
  });
  const position = siblings.length > 0 ? Math.max(...siblings.map((t) => t.position)) + 1 : 0;

  const [restored] = await tx
    .update(kanbanTasks)
    .set({ columnId: targetColumn.id, position, deletedAt: null, updatedAt: new Date() })
    .where(eq(kanbanTasks.id, taskId))
    .returning();
  return restored;
}

// --- Labels (kanban feature pack, item 3) ---------------------------------

export async function listLabelsForBoard(tx: RlsTx, boardId: string) {
  return tx.query.kanbanLabels.findMany({
    where: eq(kanbanLabels.boardId, boardId),
    orderBy: [asc(kanbanLabels.createdAt)],
  });
}

export async function createLabel(tx: RlsTx, boardId: string, input: KanbanLabelCreateInput) {
  try {
    const [created] = await tx
      .insert(kanbanLabels)
      .values({ boardId, name: input.name, color: input.color })
      .returning();
    return created;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError("CONFLICT", "Ya existe una etiqueta con ese nombre en este tablero.");
    }
    throw error;
  }
}

export async function updateLabel(tx: RlsTx, labelId: string, input: KanbanLabelUpdateInput) {
  const patch: Partial<typeof kanbanLabels.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.color !== undefined) patch.color = input.color;
  try {
    const [updated] = await tx.update(kanbanLabels).set(patch).where(eq(kanbanLabels.id, labelId)).returning();
    return updated ?? null;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError("CONFLICT", "Ya existe una etiqueta con ese nombre en este tablero.");
    }
    throw error;
  }
}

/** Cascades to `kanban_task_labels` at the DB level (`onDelete: "cascade"`) — no manual join-row cleanup needed. */
export async function deleteLabel(tx: RlsTx, labelId: string) {
  const [deleted] = await tx.delete(kanbanLabels).where(eq(kanbanLabels.id, labelId)).returning();
  return deleted ?? null;
}

/**
 * Attaches a label to a task. RLS proves the caller owns BOTH rows, but
 * not that they're on the SAME board — a user with multiple projects
 * could otherwise attach another board's label to this task, so that
 * cross-board check is done here explicitly (same class of check
 * `deleteColumn`'s `moveTasksToColumnId` already does for "same board").
 * Idempotent — attaching an already-attached label is a no-op, not an
 * error (`onConflictDoNothing` against the `(task_id, label_id)` unique
 * constraint).
 */
export async function attachLabelToTask(tx: RlsTx, taskId: string, labelId: string) {
  const task = await getTaskById(tx, taskId);
  if (!task) return { status: "task_not_found" as const };
  const label = await tx.query.kanbanLabels.findFirst({ where: eq(kanbanLabels.id, labelId) });
  if (!label) return { status: "label_not_found" as const };
  if (label.boardId !== task.boardId) {
    throw new ApiError("VALIDATION_ERROR", "Esta etiqueta pertenece a otro tablero.");
  }
  await tx.insert(kanbanTaskLabels).values({ taskId, labelId }).onConflictDoNothing();
  return { status: "attached" as const };
}

export async function detachLabelFromTask(tx: RlsTx, taskId: string, labelId: string) {
  await tx
    .delete(kanbanTaskLabels)
    .where(and(eq(kanbanTaskLabels.taskId, taskId), eq(kanbanTaskLabels.labelId, labelId)));
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";
}

// --- Checklists (kanban feature pack, item 4) -----------------------------

export async function listChecklistItems(tx: RlsTx, taskId: string) {
  return tx.query.kanbanTaskChecklistItems.findMany({
    where: eq(kanbanTaskChecklistItems.taskId, taskId),
    orderBy: [asc(kanbanTaskChecklistItems.position)],
  });
}

export async function addChecklistItem(tx: RlsTx, taskId: string, input: KanbanChecklistItemCreateInput) {
  const siblings = await tx.query.kanbanTaskChecklistItems.findMany({
    where: eq(kanbanTaskChecklistItems.taskId, taskId),
  });
  const position = siblings.length > 0 ? Math.max(...siblings.map((i) => i.position)) + 1 : 0;
  const [created] = await tx
    .insert(kanbanTaskChecklistItems)
    .values({ taskId, text: input.text, position })
    .returning();
  return created;
}

export async function updateChecklistItem(tx: RlsTx, itemId: string, input: KanbanChecklistItemUpdateInput) {
  const patch: Partial<typeof kanbanTaskChecklistItems.$inferInsert> = { updatedAt: new Date() };
  if (input.text !== undefined) patch.text = input.text;
  if (input.isDone !== undefined) patch.isDone = input.isDone;
  const [updated] = await tx
    .update(kanbanTaskChecklistItems)
    .set(patch)
    .where(eq(kanbanTaskChecklistItems.id, itemId))
    .returning();
  return updated ?? null;
}

export async function deleteChecklistItem(tx: RlsTx, itemId: string) {
  const [deleted] = await tx
    .delete(kanbanTaskChecklistItems)
    .where(eq(kanbanTaskChecklistItems.id, itemId))
    .returning();
  return deleted ?? null;
}

/**
 * Simple sequential position renumber — no unique DB constraint on this
 * table's `position` (unlike columns), so no two-phase temp-negative
 * dance is needed, a plain in-order update is safe. Only IDs that
 * actually belong to `taskId` are renumbered (defends against a caller
 * passing an id for some other task it also owns — RLS would allow the
 * update to succeed, but silently misplacing an unrelated task's
 * checklist item into this list's position sequence would be a data
 * integrity bug, not a security one, so it's filtered out here rather
 * than trusted blindly). No route/UI currently drives this — see
 * `kanbanChecklistReorderSchema`'s doc comment for why it's still
 * implemented for real.
 */
export async function reorderChecklistItems(tx: RlsTx, taskId: string, orderedItemIds: string[]) {
  const existing = await tx.query.kanbanTaskChecklistItems.findMany({
    where: eq(kanbanTaskChecklistItems.taskId, taskId),
  });
  const validIds = new Set(existing.map((i) => i.id));
  const ordered = orderedItemIds.filter((id) => validIds.has(id));
  for (let i = 0; i < ordered.length; i++) {
    await tx
      .update(kanbanTaskChecklistItems)
      .set({ position: i, updatedAt: new Date() })
      .where(eq(kanbanTaskChecklistItems.id, ordered[i]));
  }
  return listChecklistItems(tx, taskId);
}
