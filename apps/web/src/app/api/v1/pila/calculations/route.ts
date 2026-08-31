/**
 * GET/POST /api/v1/pila/calculations — app_spec.md § "API Contracts &
 * Integrations" → "13. PILA calculation (+ guided hand-off)". See
 * `@/lib/services/pila`'s doc comment for the income-base rule, the ARL
 * opt-in decision, the cotizante-tipo-76 regime, and the real
 * `calculated|paid|overdue` status lifecycle this app actually uses.
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { toApiErrorResponse } from "@/lib/api/errors";
import { pilaCalculationCreateSchema, pilaCalculationListQuerySchema } from "@/lib/validation/pila";
import { createPilaCalculation, listPilaCalculations } from "@/lib/services/pila";
import { serializePilaRecord } from "@/lib/services/pila-view";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const { month } = pilaCalculationListQuerySchema.parse({ month: searchParams.get("month") ?? undefined });

    const rows = await withUserDb((tx, user) => listPilaCalculations(tx, user.id, month));
    return NextResponse.json({ data: rows.map(serializePilaRecord) });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = pilaCalculationCreateSchema.parse(body);

    const created = await withUserDb((tx, user) => createPilaCalculation(tx, user.id, input));
    return NextResponse.json(serializePilaRecord(created), { status: 201 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
