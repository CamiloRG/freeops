/**
 * GET/PATCH /api/v1/me/branding — app_spec.md § "API Contracts &
 * Integrations" → "2. Branding (logo)". PATCH (colors) is a spec
 * extension — see `@/lib/services/branding`'s doc comment.
 */
import { NextResponse, type NextRequest } from "next/server";
import { withUserDb } from "@/lib/db/rls";
import { toApiErrorResponse } from "@/lib/api/errors";
import { brandingUpdateSchema } from "@/lib/validation/personal";
import { getOrCreateBranding, updateBrandingColors } from "@/lib/services/branding";
import { getSignedDownloadUrl } from "@/lib/storage/r2";

export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await withUserDb(async (tx, user) => {
      const branding = await getOrCreateBranding(tx, user.id);
      const logoUrl = branding.logoFileKey
        ? await getSignedDownloadUrl("brandingLogos", branding.logoFileKey)
        : null;
      return {
        logoUrl,
        primaryColor: branding.primaryColor,
        secondaryColor: branding.secondaryColor,
        updatedAt: branding.updatedAt,
      };
    });
    return NextResponse.json(result);
  } catch (error) {
    return toApiErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const input = brandingUpdateSchema.parse(body);
    const result = await withUserDb(async (tx, user) => {
      const branding = await updateBrandingColors(tx, user.id, input);
      const logoUrl = branding.logoFileKey
        ? await getSignedDownloadUrl("brandingLogos", branding.logoFileKey)
        : null;
      return {
        logoUrl,
        primaryColor: branding.primaryColor,
        secondaryColor: branding.secondaryColor,
        updatedAt: branding.updatedAt,
      };
    });
    return NextResponse.json(result);
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
