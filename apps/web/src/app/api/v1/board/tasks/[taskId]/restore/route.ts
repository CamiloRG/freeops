/**
 * POST /api/v1/board/tasks/:taskId/restore — kanban feature pack, item 2
 * (archive/restore). Restores a soft-deleted task — see `restoreTask` in
 * `lib/services/kanban.ts` for the dangling-column fallback and WIP-limit
 * re-check this performs. Ownership enforced entirely by RLS's transitive
 * `kanban_tasks` policy (RLS doesn't filter on `deleted_at`, so a
 * soft-deleted row the caller owns is still reachable here).
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { apiErrorResponse, toApiErrorResponse } from "@/lib/api/errors";
import { restoreTask } from "@/lib/services/kanban";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params;
    const task = await withUserDb((tx) => restoreTask(tx, taskId));
    if (!task) {
      return apiErrorResponse("NOT_FOUND", "Task not found, or it isn't archived.");
    }
    return NextResponse.json({
      id: task.id,
      title: task.title,
      description: task.description,
      position: task.position,
      dueDate: task.dueDate,
      columnId: task.columnId,
      taskNumber: task.taskNumber,
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
