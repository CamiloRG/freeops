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
import { and, asc, eq, isNull } from "drizzle-orm";
import { kanbanBoards, kanbanColumns, kanbanTasks } from "@freeops/db/schema";
import type { RlsTx } from "@freeops/db/rls-client";
import { ApiError } from "@/lib/api/errors";
import { getOwnedProject } from "@/lib/services/projects";
import type {
  KanbanColumnCreateInput,
  KanbanColumnUpdateInput,
  KanbanTaskCreateInput,
  KanbanTaskUpdateInput,
} from "@/lib/validation/business";

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

  return {
    board,
    columns: columns.map((column) => ({
      ...column,
      tasks: tasks.filter((task) => task.columnId === column.id),
    })),
  };
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

  const [created] = await tx
    .insert(kanbanColumns)
    .values({ boardId: board.id, name: input.name, position: -1, isDefault: false })
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

  const siblings = await tx.query.kanbanTasks.findMany({
    where: and(eq(kanbanTasks.columnId, columnId), isNull(kanbanTasks.deletedAt)),
  });
  const position = siblings.length > 0 ? Math.max(...siblings.map((t) => t.position)) + 1 : 0;

  const [created] = await tx
    .insert(kanbanTasks)
    .values({
      columnId,
      boardId: column.boardId,
      title: input.title,
      description: input.description || null,
      dueDate: input.dueDate || null,
      position,
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
  if (input.columnId !== undefined) {
    const targetColumn = await getColumnById(tx, targetColumnId);
    if (!targetColumn) {
      throw new ApiError("VALIDATION_ERROR", "`columnId` does not refer to a column you own.");
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
