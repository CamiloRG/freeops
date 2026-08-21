/**
 * GET/PUT /api/v1/me/resume — app_spec.md § "API Contracts &
 * Integrations" → "3. Resume / CV builder".
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { toApiErrorResponse } from "@/lib/api/errors";
import { resumeUpdateSchema } from "@/lib/validation/personal";
import { getResumeFull, replaceResume } from "@/lib/services/resume";
import { getSignedDownloadUrl } from "@/lib/storage/r2";

export const runtime = "nodejs";

async function serialize(full: Awaited<ReturnType<typeof getResumeFull>>) {
  const { resume, entries, skills } = full;
  const lastGeneratedPdfUrl = resume.lastGeneratedPdfKey
    ? await getSignedDownloadUrl("resumeExports", resume.lastGeneratedPdfKey)
    : null;
  return {
    id: resume.id,
    headline: resume.headline,
    summary: resume.summary,
    skills: skills.map((s) => s.skillName),
    sections: [
      {
        title: "Experience",
        items: entries.map((e) => ({
          id: e.id,
          source: e.source,
          projectId: e.projectId,
          title: e.title,
          clientName: e.clientName,
          description: e.description,
          startDate: e.startDate,
          endDate: e.endDate,
          displayOrder: e.displayOrder,
        })),
      },
    ],
    lastGeneratedPdfUrl,
    updatedAt: resume.updatedAt,
  };
}

export async function GET() {
  try {
    const result = await withUserDb(async (tx, user) => serialize(await getResumeFull(tx, user.id)));
    return NextResponse.json(result);
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const input = resumeUpdateSchema.parse(body);
    const result = await withUserDb(async (tx, user) => serialize(await replaceResume(tx, user.id, input)));
    return NextResponse.json(result);
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
