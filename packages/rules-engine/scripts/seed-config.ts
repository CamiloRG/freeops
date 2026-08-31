/**
 * Seeds `regulatory_config_versions` from the versioned JSON files checked
 * into `packages/rules-engine/config/` — app_spec.md's "seeded initially
 * from versioned JSON files" requirement. Run via:
 *
 *   pnpm --filter @freeops/rules-engine db:seed
 *
 * Idempotent: skips (and reports) rather than duplicate-inserting if a row
 * for the same country + effectiveFrom already exists. Uses `getDb()`, the
 * same RLS-bypassing admin client the admin dashboard uses — this table
 * has no per-user RLS concept, it's global reference data.
 *
 * NOTE: this script performs a real write against whatever database
 * `DATABASE_URL` points at. It is intentionally NOT run automatically by
 * this stage's build/test scripts.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config as loadEnv } from "dotenv";
import { and, eq, isNull, lt } from "drizzle-orm";
import { getDb, regulatoryConfigVersions } from "@freeops/db";
import { parseRegulatoryConfigPayload } from "../src/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Same env resolution order as packages/db/src/migrate.ts: already-set
// process env wins, then a local docker-compose override, then the shared
// real Supabase credentials in apps/web/.env.local.
loadEnv({ path: join(__dirname, "../.env.local"), quiet: true });
loadEnv({ path: join(__dirname, "../../../apps/web/.env.local"), quiet: true });

interface SeedFile {
  country: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  config: unknown;
  sourceReference: string;
}

const SEED_FILES = ["co-2026-01.json", "co-2026-08.json"];

async function seedOne(fileName: string): Promise<void> {
  const filePath = join(__dirname, "..", "config", fileName);
  const raw = readFileSync(filePath, "utf-8");
  const seed = JSON.parse(raw) as SeedFile;

  // Fail fast if the checked-in JSON itself doesn't validate — never insert
  // an unvalidated config row.
  const validatedConfig = parseRegulatoryConfigPayload(seed.config, fileName);

  const db = getDb();

  const existing = await db
    .select({ id: regulatoryConfigVersions.id })
    .from(regulatoryConfigVersions)
    .where(
      and(
        eq(regulatoryConfigVersions.country, seed.country),
        eq(regulatoryConfigVersions.effectiveFrom, seed.effectiveFrom)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    console.log(
      `[skip] ${fileName}: regulatory_config_versions row already exists for country=${seed.country} effectiveFrom=${seed.effectiveFrom} (id=${existing[0].id})`
    );
    return;
  }

  const [inserted] = await db
    .insert(regulatoryConfigVersions)
    .values({
      country: seed.country,
      effectiveFrom: seed.effectiveFrom,
      effectiveTo: seed.effectiveTo,
      config: validatedConfig,
      sourceReference: seed.sourceReference,
    })
    .returning({ id: regulatoryConfigVersions.id });

  console.log(
    `[inserted] ${fileName}: regulatory_config_versions row created for country=${seed.country} effectiveFrom=${seed.effectiveFrom} (id=${inserted.id})`
  );

  // Keep the table well-formed for `resolveActiveRegulatoryConfig`'s own
  // assumption ("should not happen for well-formed data" that two rows'
  // windows overlap): close out any earlier open-ended row for the same
  // country now that this newer one exists, rather than leaving two
  // `effectiveTo IS NULL` rows around and relying on ORDER BY to pick the
  // right one by luck.
  const closed = await db
    .update(regulatoryConfigVersions)
    .set({ effectiveTo: seed.effectiveFrom })
    .where(
      and(
        eq(regulatoryConfigVersions.country, seed.country),
        isNull(regulatoryConfigVersions.effectiveTo),
        lt(regulatoryConfigVersions.effectiveFrom, seed.effectiveFrom)
      )
    )
    .returning({ id: regulatoryConfigVersions.id, effectiveFrom: regulatoryConfigVersions.effectiveFrom });

  for (const row of closed) {
    console.log(
      `[closed] country=${seed.country} effectiveFrom=${row.effectiveFrom} (id=${row.id}) → effectiveTo=${seed.effectiveFrom}`
    );
  }
}

async function main(): Promise<void> {
  for (const fileName of SEED_FILES) {
    await seedOne(fileName);
  }
}

main()
  .then(() => {
    console.log("Seed complete.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
