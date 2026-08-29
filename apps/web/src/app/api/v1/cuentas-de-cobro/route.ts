/**
 * GET/POST /api/v1/cuentas-de-cobro — app_spec.md § "API Contracts &
 * Integrations" → "9. Cuentas de cobro". `/send` is explicitly NOT built
 * this stage (Phase 9's Resend/Twilio integration isn't available yet).
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { toApiErrorResponse } from "@/lib/api/errors";
import { cuentaDeCobroCreateSchema } from "@/lib/validation/finance";
import { createCuentaDeCobro, listCuentasDeCobro } from "@/lib/services/finance";
import { serializeCuentaDeCobro } from "@/lib/services/finance-view";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status") ?? undefined;
    const projectId = searchParams.get("projectId") ?? undefined;

    const rows = await withUserDb((tx, user) => listCuentasDeCobro(tx, user.id, { status, projectId }));
    return NextResponse.json({ data: rows.map(serializeCuentaDeCobro) });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = cuentaDeCobroCreateSchema.parse(body);

    const created = await withUserDb((tx, user) => createCuentaDeCobro(tx, user.id, input));
    return NextResponse.json(serializeCuentaDeCobro(created), { status: 201 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
