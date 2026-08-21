/**
 * POST /api/v1/me/resume/sync-projects — app_spec.md § "API Contracts &
 * Integrations" → "3. Resume / CV builder". Pulls `status = "completed"`
 * projects into `resume_entries` (`source: "project"`), idempotent by
 * `projectId`. Business/Projects (Phase 5) has no project-creation UI yet,
 * so this correctly returns an empty-ish resume today — expected, not a
 * bug.
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { toApiErrorResponse } from "@/lib/api/errors";
import { resumeSyncProjectsSchema } from "@/lib/validation/personal";
import { syncProjectsIntoResume } from "@/lib/services/resume";
import { getSignedDownloadUrl } from "@/lib/storage/r2";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = request.headers.get("content-length") === "0" ? {} : await request.json().catch(() => ({}));
    const input = resumeSyncProjectsSchema.parse(body);

    const result = await withUserDb(async (tx, user) => {
      const full = await syncProjectsIntoResume(tx, user.id, input.projectIds);
      const lastGeneratedPdfUrl = full.resume.lastGeneratedPdfKey
        ? await getSignedDownloadUrl("resumeExports", full.resume.lastGeneratedPdfKey)
        : null;
      return {
        id: full.resume.id,
        headline: full.resume.headline,
        summary: full.resume.summary,
        skills: full.skills.map((s) => s.skillName),
        sections: [
          {
            title: "Experience",
            items: full.entries.map((e) => ({
              id: e.id,
              source: e.source,
              projectId: e.projectId,
              title: e.title,
              clientName: e.clientName,
              description: e.description,
              startDate: e.startDate,
              endDate: e.endDate,
            })),
          },
        ],
        lastGeneratedPdfUrl,
        updatedAt: full.resume.updatedAt,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
