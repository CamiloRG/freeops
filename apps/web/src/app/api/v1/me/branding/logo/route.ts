/**
 * POST/DELETE /api/v1/me/branding/logo — app_spec.md § "API Contracts &
 * Integrations" → "2. Branding (logo)". `multipart/form-data`, field
 * `file` (PNG/JPG/SVG, ≤5MB). SVGs are sanitized server-side (see
 * `@/lib/storage/r2`'s `sanitizeSvg`); raster images have EXIF stripped.
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { toApiErrorResponse, apiErrorResponse, ApiError } from "@/lib/api/errors";
import { clearLogo, getOrCreateBranding, setLogoKey } from "@/lib/services/branding";
import { deleteFile, FileValidationError, getSignedDownloadUrl, processAndUploadFile } from "@/lib/storage/r2";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return apiErrorResponse("VALIDATION_ERROR", "Missing `file` field.");
    }
    const buffer = Buffer.from(await file.arrayBuffer());

    const result = await withUserDb(async (tx, user) => {
      const existing = await getOrCreateBranding(tx, user.id);
      let upload;
      try {
        upload = await processAndUploadFile({
          bucket: "brandingLogos",
          keyPrefix: `logos/${user.id}`,
          buffer,
          slot: "logo",
        });
      } catch (error) {
        if (error instanceof FileValidationError) {
          throw new ApiError(
            error.kind === "PAYLOAD_TOO_LARGE" ? "PAYLOAD_TOO_LARGE" : "UNSUPPORTED_MEDIA_TYPE",
            error.message
          );
        }
        throw error;
      }

      const updated = await setLogoKey(tx, user.id, upload.key);

      // Best-effort cleanup of the previous logo object, if any — not part
      // of the transaction (R2 isn't transactional with Postgres), so a
      // failure here just leaves one harmless orphaned object rather than
      // blocking the actual logo change.
      if (existing.logoFileKey && existing.logoFileKey !== upload.key) {
        deleteFile("brandingLogos", existing.logoFileKey).catch(() => {});
      }

      return updated;
    });

    const logoUrl = await getSignedDownloadUrl("brandingLogos", result.logoFileKey!);
    return NextResponse.json({ logoUrl }, { status: 201 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function DELETE() {
  try {
    await withUserDb(async (tx, user) => {
      const branding = await getOrCreateBranding(tx, user.id);
      if (branding.logoFileKey) {
        await deleteFile("brandingLogos", branding.logoFileKey);
      }
      await clearLogo(tx, user.id);
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
