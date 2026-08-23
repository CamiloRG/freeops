/**
 * GET/POST/PATCH /api/v1/board/tasks/:taskId/checklist-items — kanban
 * feature pack, item 4 (checklists). List/add items, or bulk-reorder them
 * (`PATCH` with `{ orderedItemIds }` — no UI currently drives this, see
 * `kanbanChecklistReorderSchema`'s doc comment; kept as a real endpoint
 * per the phase instructions' explicit ask for a `reorderChecklistItems`
 * service function). Ownership enforced entirely by RLS's transitive
 * `kanban_tasks` policy.
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { apiErrorResponse, toApiErrorResponse } from "@/lib/api/errors";
import { kanbanChecklistItemCreateSchema, kanbanChecklistReorderSchema } from "@/lib/validation/business";
import { addChecklistItem, getTaskById, listChecklistItems, reorderChecklistItems } from "@/lib/services/kanban";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params;
    const result = await withUserDb(async (tx) => {
      const task = await getTaskById(tx, taskId);
      if (!task) return null;
      return listChecklistItems(tx, taskId);
    });
    if (!result) {
      return apiErrorResponse("NOT_FOUND", "Task not found.");
    }
    return NextResponse.json({
      items: result.map((i) => ({ id: i.id, text: i.text, isDone: i.isDone, position: i.position })),
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params;
    const body = await request.json();
    const input = kanbanChecklistItemCreateSchema.parse(body);

    const item = await withUserDb(async (tx) => {
      const task = await getTaskById(tx, taskId);
      if (!task) return null;
      return addChecklistItem(tx, taskId, input);
    });
    if (!item) {
      return apiErrorResponse("NOT_FOUND", "Task not found.");
    }
    return NextResponse.json(
      { id: item.id, text: item.text, isDone: item.isDone, position: item.position },
      { status: 201 }
    );
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params;
    const body = await request.json();
    const input = kanbanChecklistReorderSchema.parse(body);

    const result = await withUserDb(async (tx) => {
      const task = await getTaskById(tx, taskId);
      if (!task) return null;
      return reorderChecklistItems(tx, taskId, input.orderedItemIds);
    });
    if (!result) {
      return apiErrorResponse("NOT_FOUND", "Task not found.");
    }
    return NextResponse.json({
      items: result.map((i) => ({ id: i.id, text: i.text, isDone: i.isDone, position: i.position })),
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
