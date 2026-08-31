/**
 * Regulatory-normativa alert queue for the `/admin` dashboard — the
 * "human in the loop" review surface for `regulatory_config_alerts`
 * (packages/db/src/schema/compliance.ts), a table populated exclusively by
 * a Postgres trigger on `regulatory_config_versions` (migration `0020`
 * — see that file's comment): every regulatory config version ever
 * inserted, by any path, raises an `open` alert here automatically. This
 * module never inserts alerts itself, only reads/acknowledges them.
 *
 * Same `getDb()` (RLS-bypassing admin client) convention as
 * `platform-metrics.ts`/`ops-metrics.ts` — `regulatory_config_alerts` has
 * RLS enabled with zero policies (same pattern as `platform_admins`), so
 * `withUserDb`/`withRlsContext` would always see zero rows regardless of
 * caller.
 */
import { desc, eq } from "drizzle-orm";
import { getDb } from "@freeops/db/client";
import { regulatoryConfigAlerts, regulatoryConfigVersions } from "@freeops/db/schema";

export interface OpenRegulatoryConfigAlert {
  id: string;
  country: string;
  effectiveFrom: string;
  sourceReference: string | null;
  createdAt: Date;
  /** The full config payload of the version that triggered this alert — shown raw (no diff) so the reviewer can judge it directly. */
  config: unknown;
}

/** Open alerts, newest first — this is what `/admin` renders at top priority. */
export async function getOpenRegulatoryConfigAlerts(): Promise<OpenRegulatoryConfigAlert[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: regulatoryConfigAlerts.id,
      country: regulatoryConfigAlerts.country,
      effectiveFrom: regulatoryConfigAlerts.effectiveFrom,
      sourceReference: regulatoryConfigAlerts.sourceReference,
      createdAt: regulatoryConfigAlerts.createdAt,
      config: regulatoryConfigVersions.config,
    })
    .from(regulatoryConfigAlerts)
    .innerJoin(regulatoryConfigVersions, eq(regulatoryConfigAlerts.regulatoryConfigVersionId, regulatoryConfigVersions.id))
    .where(eq(regulatoryConfigAlerts.status, "open"))
    .orderBy(desc(regulatoryConfigAlerts.createdAt));
  return rows;
}

/**
 * Marks one alert `acknowledged` by the given platform admin (idempotent —
 * re-acknowledging just refreshes who/when). Returns `null` if the alert
 * id doesn't exist.
 */
export async function acknowledgeRegulatoryConfigAlert(alertId: string, adminUserId: string) {
  const db = getDb();
  const [updated] = await db
    .update(regulatoryConfigAlerts)
    .set({ status: "acknowledged", acknowledgedByUserId: adminUserId, acknowledgedAt: new Date() })
    .where(eq(regulatoryConfigAlerts.id, alertId))
    .returning({ id: regulatoryConfigAlerts.id, status: regulatoryConfigAlerts.status });
  return updated ?? null;
}
