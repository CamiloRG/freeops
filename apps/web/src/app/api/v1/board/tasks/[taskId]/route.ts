/**
 * PATCH/DELETE /api/v1/board/tasks/:taskId — app_spec.md § "API
 * Contracts & Integrations" → "7. Kanban boards, columns & tasks".
 * `PATCH` with a `columnId` change is what the kanban UI's drag-and-drop
 * (and its accessible "Move" menu equivalent) calls — see the UX flow's
 * optimistic-update/rollback contract in `app_spec.md` § "UX & Frontend"
 * and `@/lib/services/kanban`'s doc comment. Ownership enforced entirely
 * by RLS's transitive `kanban_tasks` policy.
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { apiErrorResponse, toApiErrorResponse } from "@/lib/api/errors";
import { kanbanTaskUpdateSchema } from "@/lib/validation/business";
import { deleteTask, moveOrUpdateTask } from "@/lib/services/kanban";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params;
    const body = await request.json();
    const input = kanbanTaskUpdateSchema.parse(body);

    const task = await withUserDb((tx) => moveOrUpdateTask(tx, taskId, input));
    if (!task) {
      return apiErrorResponse("NOT_FOUND", "Task not found.");
    }
    return NextResponse.json({
      id: task.id,
      title: task.title,
      description: task.description,
      position: task.position,
      dueDate: task.dueDate,
      columnId: task.columnId,
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params;
    const deleted = await withUserDb((tx) => deleteTask(tx, taskId));
    if (!deleted) {
      return apiErrorResponse("NOT_FOUND", "Task not found.");
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
