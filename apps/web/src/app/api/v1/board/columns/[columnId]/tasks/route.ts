/**
 * POST /api/v1/board/columns/:columnId/tasks — app_spec.md §
 * "API Contracts & Integrations" → "7. Kanban boards, columns & tasks".
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { apiErrorResponse, toApiErrorResponse } from "@/lib/api/errors";
import { kanbanTaskCreateSchema } from "@/lib/validation/business";
import { createTask } from "@/lib/services/kanban";

export async function POST(request: NextRequest, { params }: { params: Promise<{ columnId: string }> }) {
  try {
    const { columnId } = await params;
    const body = await request.json();
    const input = kanbanTaskCreateSchema.parse(body);

    const task = await withUserDb((tx) => createTask(tx, columnId, input));
    if (!task) {
      return apiErrorResponse("NOT_FOUND", "Column not found.");
    }
    return NextResponse.json(
      {
        id: task.id,
        title: task.title,
        description: task.description,
        position: task.position,
        dueDate: task.dueDate,
        createdAt: task.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
