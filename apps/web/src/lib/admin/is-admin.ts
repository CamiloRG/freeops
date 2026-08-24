/**
 * Platform-operator authorization check for the `/admin` route group.
 *
 * Deliberately uses `getDb()` (packages/db/src/client.ts), not
 * `withUserDb`/`withRlsContext` — `platform_admins` has RLS enabled with
 * ZERO policies (migration 0014), so the RLS-scoped path would always see
 * zero rows regardless of who's asking. `getDb()`'s admin/background-job
 * connection bypasses RLS by design, which is exactly what an
 * authorization check for the admin area itself needs.
 */
import { eq } from "drizzle-orm";
import { getDb } from "@freeops/db/client";
import { platformAdmins } from "@freeops/db/schema";

export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: platformAdmins.id })
    .from(platformAdmins)
    .where(eq(platformAdmins.userId, userId))
    .limit(1);
  return Boolean(row);
}
