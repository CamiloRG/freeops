/**
 * POST /api/v1/me/resume/extract — "Import from resume" — user-proposed
 * feature beyond app_spec.md's original scope (see the codebase-memory-mcp
 * ADR). Accepts `multipart/form-data` (field `file`: PDF/PNG/JPEG, ≤10MB),
 * extracts structured resume fields via Claude, and returns them as JSON
 * for the client to merge into the resume form's existing React state as
 * EDITABLE SUGGESTIONS — same UX shape as `POST .../resume/sync-projects`.
 * Nothing is auto-saved; the user still clicks "Save resume" themselves.
 *
 * The uploaded file is NEVER persisted to R2 or anywhere else — read into
 * memory, used for the extraction call, then discarded. Tier + rate limit
 * are resolved and checked BEFORE calling Claude, so an over-cap
 * default-tier request never reaches the Anthropic API at all.
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { toApiErrorResponse, apiErrorResponse, ApiError } from "@/lib/api/errors";
import { FileValidationError, sniffAndValidate } from "@/lib/storage/r2";
import { determineTier, isUnderDefaultTierLimit } from "@/lib/ai/rate-limit";
import { ExtractionError, RESUME_EXTRACTION_MODEL, extractResumeFromFile } from "@/lib/ai/extract-resume";
import { aiExtractionLog } from "@freeops/db/schema";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return apiErrorResponse("VALIDATION_ERROR", "Missing `file` field.");
    }
    const buffer = Buffer.from(await file.arrayBuffer());

    let mimeType: "application/pdf" | "image/png" | "image/jpeg";
    try {
      const sniffed = await sniffAndValidate(buffer, "resumeImport");
      mimeType = sniffed.mimeType as "application/pdf" | "image/png" | "image/jpeg";
    } catch (error) {
      if (error instanceof FileValidationError) {
        throw new ApiError(
          error.kind === "PAYLOAD_TOO_LARGE" ? "PAYLOAD_TOO_LARGE" : "UNSUPPORTED_MEDIA_TYPE",
          error.kind === "UNSUPPORTED_MEDIA_TYPE"
            ? "Only PDF, JPG, or PNG resumes are supported."
            : error.message
        );
      }
      throw error;
    }

    const result = await withUserDb(async (tx, user) => {
      const { tier, apiKey } = await determineTier(tx, user.id);

      if (tier === "default") {
        const { underLimit, used, limit } = await isUnderDefaultTierLimit(tx, user.id);
        if (!underLimit) {
          // Rejected before ever calling Claude — no point spending
          // FreeOps's own money on a request that's guaranteed to be
          // rejected. Not logged to ai_extraction_log: that table records
          // actual extraction attempts, and this one never became one.
          throw new ApiError(
            "RATE_LIMITED",
            `You've used all ${limit} free resume imports this month. Connect your own Anthropic API key to import without a monthly limit, or try again next month.`,
            { used, limit, tier }
          );
        }
      }

      try {
        const extracted = await extractResumeFromFile({ apiKey, buffer, mimeType });
        await tx.insert(aiExtractionLog).values({
          userId: user.id,
          documentType: "resume",
          tier,
          provider: "anthropic",
          model: RESUME_EXTRACTION_MODEL,
          status: "succeeded",
        });

        const quota =
          tier === "default"
            ? { used: (await isUnderDefaultTierLimit(tx, user.id)).used, limit: 5 }
            : null;

        return { extracted, tier, quota };
      } catch (error) {
        await tx.insert(aiExtractionLog).values({
          userId: user.id,
          documentType: "resume",
          tier,
          provider: "anthropic",
          model: RESUME_EXTRACTION_MODEL,
          status: "failed",
        });
        if (error instanceof ExtractionError) {
          throw new ApiError(
            "UPSTREAM_ERROR",
            "Couldn't read that file — try a clearer scan/PDF or fill in the fields manually."
          );
        }
        throw error;
      }
    });

    return NextResponse.json({
      headline: result.extracted.headline,
      summary: result.extracted.summary,
      skills: result.extracted.skills,
      entries: result.extracted.entries,
      tier: result.tier,
      quota: result.quota,
    });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
