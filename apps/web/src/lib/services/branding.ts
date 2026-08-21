/**
 * Branding — app_spec.md § "API Contracts & Integrations" → "2. Branding
 * (logo)". `logo_file_key` is an R2 object key (`branding-logos` bucket,
 * `logos/<userId>/...` prefix — see `@/lib/storage/r2`); the API always
 * hands back a short-lived signed URL, never the raw key.
 *
 * Spec deviation: the contract's `GET /api/v1/me/branding` response shape
 * is `{ logoUrl, primaryColor, updatedAt }` with no documented way to set
 * `primaryColor`/`secondaryColor` (only the logo upload/delete endpoints
 * are listed) — but the underlying `branding_assets` table clearly has
 * both color columns and the UI needs to set them for the invoice-preview
 * feature. This phase adds `PATCH /api/v1/me/branding` (not in the
 * literal spec text) to fill that gap; noted in this phase's report.
 */
import { eq } from "drizzle-orm";
import { brandingAssets } from "@freeops/db/schema";
import type { RlsTx } from "@freeops/db/rls-client";
import type { BrandingUpdateInput } from "@/lib/validation/personal";

/** Race-safe find-or-create — see `profile.ts`'s `getOrCreateProfile` doc comment for why. */
export async function getOrCreateBranding(tx: RlsTx, userId: string) {
  const [inserted] = await tx
    .insert(brandingAssets)
    .values({ userId })
    .onConflictDoNothing({ target: brandingAssets.userId })
    .returning();
  if (inserted) return inserted;

  const existing = await tx.query.brandingAssets.findFirst({ where: eq(brandingAssets.userId, userId) });
  if (existing) return existing;
  throw new Error("getOrCreateBranding: insert conflicted but no existing row was found.");
}

export async function updateBrandingColors(tx: RlsTx, userId: string, input: BrandingUpdateInput) {
  await getOrCreateBranding(tx, userId);

  const patch: Partial<typeof brandingAssets.$inferInsert> = { updatedAt: new Date() };
  if (input.primaryColor !== undefined) patch.primaryColor = input.primaryColor;
  if (input.secondaryColor !== undefined) patch.secondaryColor = input.secondaryColor;

  const [updated] = await tx
    .update(brandingAssets)
    .set(patch)
    .where(eq(brandingAssets.userId, userId))
    .returning();
  return updated;
}

export async function setLogoKey(tx: RlsTx, userId: string, logoFileKey: string) {
  await getOrCreateBranding(tx, userId);
  const [updated] = await tx
    .update(brandingAssets)
    .set({ logoFileKey, updatedAt: new Date() })
    .where(eq(brandingAssets.userId, userId))
    .returning();
  return updated;
}

export async function clearLogo(tx: RlsTx, userId: string) {
  const [updated] = await tx
    .update(brandingAssets)
    .set({ logoFileKey: null, updatedAt: new Date() })
    .where(eq(brandingAssets.userId, userId))
    .returning();
  return updated;
}
