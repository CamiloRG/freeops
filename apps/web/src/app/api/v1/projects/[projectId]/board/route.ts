/**
 * GET /api/v1/projects/:projectId/board — app_spec.md § "API Contracts &
 * Integrations" → "7. Kanban boards, columns & tasks".
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { apiErrorResponse, toApiErrorResponse } from "@/lib/api/errors";
import { getBoardForProject } from "@/lib/services/kanban";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const result = await withUserDb((tx, user) => getBoardForProject(tx, user.id, projectId));
    if (!result) {
      return apiErrorResponse("NOT_FOUND", "Project or board not found.");
    }
    return NextResponse.json({
      id: result.board.id,
      columns: result.columns.map((column) => ({
        id: column.id,
        name: column.name,
        position: column.position,
        wipLimit: column.wipLimit,
        isDefault: column.isDefault,
        tasks: column.tasks.map((task) => ({
          id: task.id,
          title: task.title,
          description: task.description,
          position: task.position,
          dueDate: task.dueDate,
          createdAt: task.createdAt,
          taskNumber: task.taskNumber,
          labels: task.labels,
          checklist: task.checklist,
        })),
      })),
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
