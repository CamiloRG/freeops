/**
 * GET/POST /api/v1/projects — app_spec.md § "API Contracts & Integrations"
 * → "5. Projects". See `@/lib/validation/business`'s doc comment for the
 * `name`/`title`, `value`/`deal_value`, `startDate`/`start_date`,
 * `expectedEndDate`/`end_date` field-name mapping between the contract
 * prose and the schema.
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { toApiErrorResponse } from "@/lib/api/errors";
import { projectCreateSchema } from "@/lib/validation/business";
import { createProject, listProjects } from "@/lib/services/projects";
import { serializeProject } from "@/lib/services/project-view";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status") ?? undefined;
    const q = searchParams.get("q") ?? undefined;

    const rows = await withUserDb((tx, user) => listProjects(tx, user.id, { status, q }));
    return NextResponse.json({ data: rows.map(serializeProject) });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = projectCreateSchema.parse(body);

    const result = await withUserDb((tx, user) => createProject(tx, user.id, input));
    return NextResponse.json(serializeProject(result.project), { status: 201 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
