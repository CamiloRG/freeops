/**
 * POST/DELETE /api/v1/board/tasks/:taskId/labels/:labelId — kanban
 * feature pack, item 3 (labels). Attach/detach a label on a task — see
 * `attachLabelToTask`'s doc comment in `lib/services/kanban.ts` for the
 * explicit same-board check (RLS proves ownership of both rows, not that
 * they're on the same board). Ownership enforced entirely by RLS's
 * transitive `kanban_tasks`/`kanban_labels` policies otherwise.
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { apiErrorResponse, toApiErrorResponse } from "@/lib/api/errors";
import { attachLabelToTask, detachLabelFromTask } from "@/lib/services/kanban";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ taskId: string; labelId: string }> }
) {
  try {
    const { taskId, labelId } = await params;
    const result = await withUserDb((tx) => attachLabelToTask(tx, taskId, labelId));
    if (result.status === "task_not_found") {
      return apiErrorResponse("NOT_FOUND", "Task not found.");
    }
    if (result.status === "label_not_found") {
      return apiErrorResponse("NOT_FOUND", "Label not found.");
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ taskId: string; labelId: string }> }
) {
  try {
    const { taskId, labelId } = await params;
    await withUserDb((tx) => detachLabelFromTask(tx, taskId, labelId));
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
