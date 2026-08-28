/**
 * Point-in-time resolver for `regulatory_config_versions` — the core of
 * the config-driven rules engine's "no formula is ever hardcoded, and
 * every calculation is reproducible as of the period it applies to"
 * guarantee (app_spec.md, "Config-driven compliance rules engine").
 */
import { and, desc, eq, isNull, lte, or, gt } from "drizzle-orm";
import { regulatoryConfigVersions, type Db } from "@freeops/db";
import { parseRegulatoryConfigPayload, type RegulatoryConfigPayload } from "./config";

export interface ResolveActiveRegulatoryConfigInput {
  /** ISO 3166-1 alpha-2 country code, e.g. "CO". */
  country: string;
  /** The date the calculation applies to (the target period). */
  forDate: Date;
}

export interface ResolvedRegulatoryConfig {
  id: string;
  country: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  config: RegulatoryConfigPayload;
  sourceReference: string | null;
}

/**
 * Thrown when no `regulatory_config_versions` row's
 * `[effective_from, effective_to)` window covers `forDate` for `country`.
 * Deliberately distinct from a generic Error so callers (later stages) can
 * distinguish "no config for this period" from other failure modes (e.g.
 * a DB connectivity error, or a malformed config row).
 */
export class NoActiveRegulatoryConfigError extends Error {
  readonly country: string;
  readonly forDate: Date;

  constructor(country: string, forDate: Date) {
    super(
      `No active regulatory_config_versions row for country="${country}" covering ${forDate.toISOString().slice(0, 10)}`
    );
    this.name = "NoActiveRegulatoryConfigError";
    this.country = country;
    this.forDate = forDate;
  }
}

/**
 * Resolves the `regulatory_config_versions` row whose
 * `[effective_from, effective_to)` window covers `forDate`, for `country`.
 * When more than one row could match (should not happen for well-formed
 * data, but defensively handled), the row with the latest `effectiveFrom`
 * wins. Validates the resolved row's `config` payload before returning it,
 * so callers never receive an unvalidated jsonb blob.
 */
export async function resolveActiveRegulatoryConfig(
  db: Db,
  input: ResolveActiveRegulatoryConfigInput
): Promise<ResolvedRegulatoryConfig> {
  const forDateStr = toDateOnlyString(input.forDate);

  const rows = await db
    .select()
    .from(regulatoryConfigVersions)
    .where(
      and(
        eq(regulatoryConfigVersions.country, input.country),
        lte(regulatoryConfigVersions.effectiveFrom, forDateStr),
        or(
          isNull(regulatoryConfigVersions.effectiveTo),
          gt(regulatoryConfigVersions.effectiveTo, forDateStr)
        )
      )
    )
    .orderBy(desc(regulatoryConfigVersions.effectiveFrom))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new NoActiveRegulatoryConfigError(input.country, input.forDate);
  }

  const config = parseRegulatoryConfigPayload(
    row.config,
    `regulatory_config_versions.id=${row.id}`
  );

  return {
    id: row.id,
    country: row.country,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    config,
    sourceReference: row.sourceReference,
  };
}

function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}
