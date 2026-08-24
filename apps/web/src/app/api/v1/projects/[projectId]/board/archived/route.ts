/**
 * GET /api/v1/projects/:projectId/board/archived — kanban feature pack,
 * item 2 (archive/restore). Lists this board's soft-deleted tasks,
 * most-recently-deleted first, each paired with the column they'd return
 * to (`columnName: null` if that column has since been hard-deleted —
 * see `listArchivedTasks`'s doc comment in `lib/services/kanban.ts`).
 * Ownership enforced entirely by RLS's transitive `kanban_tasks` policy,
 * same as every other board route.
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { apiErrorResponse, toApiErrorResponse } from "@/lib/api/errors";
import { getOwnedBoard, listArchivedTasks } from "@/lib/services/kanban";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const result = await withUserDb(async (tx, user) => {
      const board = await getOwnedBoard(tx, user.id, projectId);
      if (!board) return null;
      return listArchivedTasks(tx, board.id);
    });
    if (!result) {
      return apiErrorResponse("NOT_FOUND", "Project or board not found.");
    }
    return NextResponse.json({ tasks: result });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
