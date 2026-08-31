/**
 * PATCH /api/v1/pila/calculations/:id/recalculate — app_spec.md § "API
 * Contracts & Integrations" → "13. PILA calculation". `422`s if the
 * record is already `paid` (see `recalculatePilaCalculation`'s doc
 * comment in `@/lib/services/pila`).
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { apiErrorResponse, toApiErrorResponse } from "@/lib/api/errors";
import { recalculatePilaCalculation } from "@/lib/services/pila";
import { serializePilaRecord } from "@/lib/services/pila-view";

export const runtime = "nodejs";

export async function PATCH(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const updated = await withUserDb((tx, user) => recalculatePilaCalculation(tx, user.id, id));
    if (!updated) {
      return apiErrorResponse("NOT_FOUND", "Cálculo de PILA no encontrado.");
    }
    return NextResponse.json(serializePilaRecord(updated));
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
