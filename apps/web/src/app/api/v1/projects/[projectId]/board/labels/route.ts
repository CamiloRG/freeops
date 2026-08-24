/**
 * GET/POST /api/v1/projects/:projectId/board/labels — kanban feature
 * pack, item 3 (labels). List/create board-scoped labels. Ownership
 * enforced entirely by RLS's transitive `kanban_boards` policy.
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { apiErrorResponse, toApiErrorResponse } from "@/lib/api/errors";
import { kanbanLabelCreateSchema } from "@/lib/validation/business";
import { createLabel, getOwnedBoard, listLabelsForBoard } from "@/lib/services/kanban";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const result = await withUserDb(async (tx, user) => {
      const board = await getOwnedBoard(tx, user.id, projectId);
      if (!board) return null;
      return listLabelsForBoard(tx, board.id);
    });
    if (!result) {
      return apiErrorResponse("NOT_FOUND", "Project or board not found.");
    }
    return NextResponse.json({ labels: result });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const input = kanbanLabelCreateSchema.parse(body);

    const label = await withUserDb(async (tx, user) => {
      const board = await getOwnedBoard(tx, user.id, projectId);
      if (!board) return null;
      return createLabel(tx, board.id, input);
    });
    if (!label) {
      return apiErrorResponse("NOT_FOUND", "Project or board not found.");
    }
    return NextResponse.json({ id: label.id, name: label.name, color: label.color }, { status: 201 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
