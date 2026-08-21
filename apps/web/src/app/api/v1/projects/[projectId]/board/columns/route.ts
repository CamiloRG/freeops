/**
 * POST /api/v1/projects/:projectId/board/columns — app_spec.md §
 * "API Contracts & Integrations" → "7. Kanban boards, columns & tasks".
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { apiErrorResponse, toApiErrorResponse } from "@/lib/api/errors";
import { kanbanColumnCreateSchema } from "@/lib/validation/business";
import { createColumn } from "@/lib/services/kanban";

export async function POST(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const input = kanbanColumnCreateSchema.parse(body);

    const column = await withUserDb((tx, user) => createColumn(tx, user.id, projectId, input));
    if (!column) {
      return apiErrorResponse("NOT_FOUND", "Project or board not found.");
    }
    return NextResponse.json(
      { id: column.id, name: column.name, position: column.position, wipLimit: column.wipLimit, tasks: [] },
      { status: 201 }
    );
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
