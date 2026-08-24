/**
 * GET/POST /api/v1/crm/opportunities — app_spec.md § "API Contracts &
 * Integrations" → "8. CRM pipeline / opportunities".
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { toApiErrorResponse } from "@/lib/api/errors";
import { crmOpportunityCreateSchema } from "@/lib/validation/crm";
import { createOpportunity, listOpportunities } from "@/lib/services/crm";
import { serializeOpportunity } from "@/lib/services/crm-view";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const stageId = searchParams.get("stageId") ?? undefined;
    const q = searchParams.get("q") ?? undefined;

    const rows = await withUserDb((tx, user) => listOpportunities(tx, user.id, { stageId, q }));
    return NextResponse.json({ data: rows.map(serializeOpportunity) });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = crmOpportunityCreateSchema.parse(body);

    const opportunity = await withUserDb((tx, user) => createOpportunity(tx, user.id, input));
    return NextResponse.json(serializeOpportunity(opportunity), { status: 201 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
