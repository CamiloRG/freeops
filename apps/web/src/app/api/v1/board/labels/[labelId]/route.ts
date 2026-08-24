/**
 * PATCH/DELETE /api/v1/board/labels/:labelId — kanban feature pack, item 3
 * (labels). Rename/recolor or delete a board label (delete cascades to
 * `kanban_task_labels` at the DB level). Ownership enforced entirely by
 * RLS's transitive `kanban_labels` policy.
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { apiErrorResponse, toApiErrorResponse } from "@/lib/api/errors";
import { kanbanLabelUpdateSchema } from "@/lib/validation/business";
import { deleteLabel, updateLabel } from "@/lib/services/kanban";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ labelId: string }> }) {
  try {
    const { labelId } = await params;
    const body = await request.json();
    const input = kanbanLabelUpdateSchema.parse(body);

    const label = await withUserDb((tx) => updateLabel(tx, labelId, input));
    if (!label) {
      return apiErrorResponse("NOT_FOUND", "Label not found.");
    }
    return NextResponse.json({ id: label.id, name: label.name, color: label.color });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ labelId: string }> }) {
  try {
    const { labelId } = await params;
    const deleted = await withUserDb((tx) => deleteLabel(tx, labelId));
    if (!deleted) {
      return apiErrorResponse("NOT_FOUND", "Label not found.");
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
