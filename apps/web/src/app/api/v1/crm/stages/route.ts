/**
 * GET/POST /api/v1/crm/stages — app_spec.md § "API Contracts &
 * Integrations" → "8. CRM pipeline / opportunities". `GET` also lazily
 * seeds the 6 default stages on a caller's very first request — see
 * `@/lib/services/crm`'s `ensureDefaultStages` doc comment.
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { toApiErrorResponse } from "@/lib/api/errors";
import { crmStageCreateSchema } from "@/lib/validation/crm";
import { createStage, listPipelineStages } from "@/lib/services/crm";
import { serializeStage } from "@/lib/services/crm-view";

export async function GET() {
  try {
    const rows = await withUserDb((tx, user) => listPipelineStages(tx, user.id));
    return NextResponse.json({ data: rows.map(serializeStage) });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = crmStageCreateSchema.parse(body);

    const stage = await withUserDb((tx, user) => createStage(tx, user.id, input));
    return NextResponse.json(serializeStage(stage!), { status: 201 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
