/**
 * POST /api/v1/me/resume/export — app_spec.md § "API Contracts &
 * Integrations" → "3. Resume / CV builder".
 *
 * Spec deviation (see `@/lib/services/resume`'s doc comment): the
 * contract's `202 { jobId }` + poll shape implies a background-job queue,
 * which isn't wired up yet (queue-backed workers are a later phase's
 * scope, not this one). Generation runs synchronously here — a resume PDF
 * is small/fast — but the contract's response shape is preserved so a
 * real queue can slot in later without a client-facing change. `jobId` is
 * the R2 object key itself (URL-safe base64), which the poll endpoint
 * decodes and checks for existence/ownership.
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { toApiErrorResponse } from "@/lib/api/errors";
import { resumeExportSchema } from "@/lib/validation/personal";
import { getResumeFull, renderResumePdf, setLastGeneratedPdfKey } from "@/lib/services/resume";
import { getOrCreateProfile } from "@/lib/services/profile";
import { putResumeExportPdf } from "@/lib/storage/r2";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = request.headers.get("content-length") === "0" ? {} : await request.json().catch(() => ({}));
    resumeExportSchema.parse(body);

    const jobId = await withUserDb(async (tx, user) => {
      const profile = await getOrCreateProfile(tx, user.id, user.fullNameFromSignup);
      const { resume, entries, skills } = await getResumeFull(tx, user.id);

      const pdfBuffer = await renderResumePdf({
        fullName: profile.fullName,
        headline: resume.headline,
        summary: resume.summary,
        skills: skills.map((s) => s.skillName),
        entries: entries.map((e) => ({
          title: e.title,
          clientName: e.clientName,
          description: e.description,
          startDate: e.startDate,
          endDate: e.endDate,
        })),
      });

      const key = await putResumeExportPdf(user.id, pdfBuffer);
      await setLastGeneratedPdfKey(tx, user.id, key);
      return Buffer.from(key, "utf8").toString("base64url");
    });

    return NextResponse.json({ jobId }, { status: 202 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
