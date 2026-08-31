/**
 * POST /api/v1/pila/calculations/:id/confirm-paid — app_spec.md § "API
 * Contracts & Integrations" → "13. PILA calculation". Self-attested by
 * the freelancer after completing payment on their chosen operator's
 * site — there is no API into MiPlanilla/SOI/Aportes en Línea/Simple to
 * verify this. `422`s if already `paid` (see `confirmPilaPaid`'s doc
 * comment in `@/lib/services/pila`).
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { apiErrorResponse, toApiErrorResponse } from "@/lib/api/errors";
import { pilaConfirmPaidSchema } from "@/lib/validation/pila";
import { confirmPilaPaid } from "@/lib/services/pila";
import { serializePilaRecord } from "@/lib/services/pila-view";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const input = pilaConfirmPaidSchema.parse(body);

    const updated = await withUserDb((tx, user) => confirmPilaPaid(tx, user.id, id, input));
    if (!updated) {
      return apiErrorResponse("NOT_FOUND", "Cálculo de PILA no encontrado.");
    }
    return NextResponse.json(serializePilaRecord(updated));
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
