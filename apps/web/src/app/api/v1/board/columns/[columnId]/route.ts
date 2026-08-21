/**
 * PATCH/DELETE /api/v1/board/columns/:columnId — app_spec.md §
 * "API Contracts & Integrations" → "7. Kanban boards, columns & tasks".
 * Ownership enforced entirely by RLS's transitive `kanban_columns` policy
 * (column -> board -> project -> user_id) — see `@/lib/services/kanban`'s
 * doc comment.
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { apiErrorResponse, toApiErrorResponse } from "@/lib/api/errors";
import { kanbanColumnDeleteSchema, kanbanColumnUpdateSchema } from "@/lib/validation/business";
import { deleteColumn, updateColumn } from "@/lib/services/kanban";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ columnId: string }> }) {
  try {
    const { columnId } = await params;
    const body = await request.json();
    const input = kanbanColumnUpdateSchema.parse(body);

    const column = await withUserDb((tx) => updateColumn(tx, columnId, input));
    if (!column) {
      return apiErrorResponse("NOT_FOUND", "Column not found.");
    }
    return NextResponse.json({
      id: column.id,
      name: column.name,
      position: column.position,
      wipLimit: column.wipLimit,
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ columnId: string }> }) {
  try {
    const { columnId } = await params;
    const body = await request.json().catch(() => ({}));
    const input = kanbanColumnDeleteSchema.parse(body);

    const result = await withUserDb((tx) => deleteColumn(tx, columnId, input.moveTasksToColumnId));

    if (result.status === "not_found") {
      return apiErrorResponse("NOT_FOUND", "Column not found.");
    }
    if (result.status === "needs_target") {
      return apiErrorResponse(
        "UNPROCESSABLE_ENTITY",
        "This column has tasks — pass `moveTasksToColumnId` to move them before deleting, or move/delete them individually first."
      );
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
