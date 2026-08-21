/**
 * Profile & Personal Data — app_spec.md § "API Contracts & Integrations" →
 * "1. Freelancer profile, banking & tax data" (profile half).
 *
 * Every function here MUST be called with an RLS-scoped transaction (see
 * `apps/web/src/lib/db/rls.ts`'s `withUserDb`), never `getDb()`.
 */
import { eq } from "drizzle-orm";
import { freelancerProfiles } from "@freeops/db/schema";
import type { RlsTx } from "@freeops/db/rls-client";
import type { ProfileUpdateInput } from "@/lib/validation/personal";

/**
 * Find-or-create, made race-safe with `ON CONFLICT DO NOTHING` +
 * fallback re-select rather than a plain SELECT-then-INSERT: Next.js's
 * `<Link>` prefetching (see `SectionTabs`) can trigger the Profile,
 * Branding, and Resume pages' Server Components concurrently for a brand-
 * new user (each calls its own `getOrCreate*`), and a naive
 * check-then-insert races on `freelancer_profiles.user_id`'s unique
 * constraint — caught by this phase's Playwright smoke test.
 */
export async function getOrCreateProfile(tx: RlsTx, userId: string, fallbackFullName?: string) {
  const [inserted] = await tx
    .insert(freelancerProfiles)
    .values({
      userId,
      fullName: fallbackFullName?.trim() || "New freelancer",
      country: "CO",
    })
    .onConflictDoNothing({ target: freelancerProfiles.userId })
    .returning();
  if (inserted) return inserted;

  const existing = await tx.query.freelancerProfiles.findFirst({
    where: eq(freelancerProfiles.userId, userId),
  });
  if (existing) return existing;
  throw new Error("getOrCreateProfile: insert conflicted but no existing row was found.");
}

export async function updateProfile(tx: RlsTx, userId: string, input: ProfileUpdateInput) {
  await getOrCreateProfile(tx, userId);

  const patch: Partial<typeof freelancerProfiles.$inferInsert> = {};
  if (input.fullName !== undefined) patch.fullName = input.fullName;
  if (input.displayName !== undefined) patch.displayName = input.displayName || null;
  if (input.phone !== undefined) patch.phone = input.phone || null;
  if (input.city !== undefined) patch.city = input.city || null;
  if (input.country !== undefined) patch.country = input.country;
  if (input.headline !== undefined) patch.headline = input.headline || null;
  if (input.bio !== undefined) patch.bio = input.bio || null;
  patch.updatedAt = new Date();

  const [updated] = await tx
    .update(freelancerProfiles)
    .set(patch)
    .where(eq(freelancerProfiles.userId, userId))
    .returning();
  return updated;
}
