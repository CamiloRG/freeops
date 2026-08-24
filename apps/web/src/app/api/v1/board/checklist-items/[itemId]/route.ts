/**
 * PATCH/DELETE /api/v1/board/checklist-items/:itemId — kanban feature
 * pack, item 4 (checklists). Edit text/toggle `isDone`, or delete an item.
 * Ownership enforced entirely by RLS's transitive
 * `kanban_task_checklist_items` policy.
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { apiErrorResponse, toApiErrorResponse } from "@/lib/api/errors";
import { kanbanChecklistItemUpdateSchema } from "@/lib/validation/business";
import { deleteChecklistItem, updateChecklistItem } from "@/lib/services/kanban";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const { itemId } = await params;
    const body = await request.json();
    const input = kanbanChecklistItemUpdateSchema.parse(body);

    const item = await withUserDb((tx) => updateChecklistItem(tx, itemId, input));
    if (!item) {
      return apiErrorResponse("NOT_FOUND", "Checklist item not found.");
    }
    return NextResponse.json({ id: item.id, text: item.text, isDone: item.isDone, position: item.position });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const { itemId } = await params;
    const deleted = await withUserDb((tx) => deleteChecklistItem(tx, itemId));
    if (!deleted) {
      return apiErrorResponse("NOT_FOUND", "Checklist item not found.");
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
