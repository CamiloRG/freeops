/**
 * GET /api/v1/pila/calculations/:id/handoff — app_spec.md § "API
 * Contracts & Integrations" → "13. PILA calculation": "guided hand-off
 * panel with deep-link(s) to the freelancer's chosen PILA operator" — no
 * data is transmitted to the operator via this API, these are plain
 * deep-links opened in a new tab by the UI. Always returns all 4
 * operators (see `@/lib/pila/operators`) — purely informational, never
 * claims submission occurred.
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { apiErrorResponse, toApiErrorResponse } from "@/lib/api/errors";
import { getOwnedPilaCalculation } from "@/lib/services/pila";
import { buildPilaHandoff } from "@/lib/services/pila-view";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const record = await withUserDb((tx, user) => getOwnedPilaCalculation(tx, user.id, id));
    if (!record) {
      return apiErrorResponse("NOT_FOUND", "Cálculo de PILA no encontrado.");
    }
    return NextResponse.json(buildPilaHandoff(record));
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
