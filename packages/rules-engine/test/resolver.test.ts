import { describe, expect, it } from "vitest";
import {
  NoActiveRegulatoryConfigError,
  resolveActiveRegulatoryConfig,
} from "../src/resolver";
import { InvalidRegulatoryConfigError } from "../src/config";
import type { Db } from "@freeops/db";

interface FakeRow {
  id: string;
  country: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  config: unknown;
  sourceReference: string | null;
}

const VALID_PAYLOAD = {
  smlmv: 1_300_000,
  uvtValue: 47065,
  ibcMinPct: 0.4,
  ibcFloorSmlmv: 1,
  ibcCeilingSmlmv: 25,
  healthPct: 0.125,
  pensionPct: 0.16,
  arlPctByClass: { I: 0.00522, II: 0.01044, III: 0.02436, IV: 0.0435, V: 0.0696 },
};

/**
 * Builds a stub `db` object satisfying the
 * `.select().from().where().orderBy().limit()` chain that
 * `resolveActiveRegulatoryConfig` calls. Applies the same point-in-time
 * window semantics as the real SQL query (country match, effectiveFrom <=
 * forDate, effectiveTo null or > forDate), sorted desc by effectiveFrom —
 * implemented independently here (not imported from resolver.ts) so the
 * test cross-checks resolver's behavior rather than testing the mock
 * against itself.
 */
function createMockDb(rows: FakeRow[], country: string, forDateStr: string): Db {
  const matching = rows
    .filter(
      (r) =>
        r.country === country &&
        r.effectiveFrom <= forDateStr &&
        (r.effectiveTo === null || r.effectiveTo > forDateStr)
    )
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1));

  const chain = {
    from: () => ({
      where: () => ({
        orderBy: () => ({
          limit: async (n: number) => matching.slice(0, n),
        }),
      }),
    }),
  };

  return { select: () => chain } as unknown as Db;
}

const THREE_VERSIONS: FakeRow[] = [
  {
    id: "v2024",
    country: "CO",
    effectiveFrom: "2024-01-01",
    effectiveTo: "2025-01-01",
    config: { ...VALID_PAYLOAD, smlmv: 1_300_000 },
    sourceReference: "2024 decree",
  },
  {
    id: "v2025",
    country: "CO",
    effectiveFrom: "2025-01-01",
    effectiveTo: "2026-01-01",
    config: { ...VALID_PAYLOAD, smlmv: 1_423_500 },
    sourceReference: "2025 decree",
  },
  {
    id: "v2026",
    country: "CO",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    config: { ...VALID_PAYLOAD, smlmv: 1_750_905 },
    sourceReference: "2026 decree",
  },
];

describe("resolveActiveRegulatoryConfig", () => {
  it("picks the version whose window covers a date in the middle year", async () => {
    const forDate = new Date("2025-06-15T00:00:00.000Z");
    const db = createMockDb(THREE_VERSIONS, "CO", "2025-06-15");

    const result = await resolveActiveRegulatoryConfig(db, { country: "CO", forDate });

    expect(result.id).toBe("v2025");
    expect(result.config.smlmv).toBe(1_423_500);
  });

  it("picks the current (effectiveTo: null) version for a present-day date", async () => {
    const forDate = new Date("2026-08-28T00:00:00.000Z");
    const db = createMockDb(THREE_VERSIONS, "CO", "2026-08-28");

    const result = await resolveActiveRegulatoryConfig(db, { country: "CO", forDate });

    expect(result.id).toBe("v2026");
    expect(result.effectiveTo).toBeNull();
  });

  it("picks the earliest version for a date at the start of its window", async () => {
    const forDate = new Date("2024-03-01T00:00:00.000Z");
    const db = createMockDb(THREE_VERSIONS, "CO", "2024-03-01");

    const result = await resolveActiveRegulatoryConfig(db, { country: "CO", forDate });

    expect(result.id).toBe("v2024");
  });

  it("treats effectiveTo as exclusive — the boundary date belongs to the next version", async () => {
    const forDate = new Date("2025-01-01T00:00:00.000Z");
    const db = createMockDb(THREE_VERSIONS, "CO", "2025-01-01");

    const result = await resolveActiveRegulatoryConfig(db, { country: "CO", forDate });

    expect(result.id).toBe("v2025");
  });

  it("throws NoActiveRegulatoryConfigError when no window covers the target date", async () => {
    const forDate = new Date("2023-01-01T00:00:00.000Z");
    const db = createMockDb(THREE_VERSIONS, "CO", "2023-01-01");

    await expect(
      resolveActiveRegulatoryConfig(db, { country: "CO", forDate })
    ).rejects.toThrow(NoActiveRegulatoryConfigError);
  });

  it("throws NoActiveRegulatoryConfigError for a country with no rows at all", async () => {
    const forDate = new Date("2026-01-15T00:00:00.000Z");
    const db = createMockDb(THREE_VERSIONS, "MX", "2026-01-15");

    await expect(
      resolveActiveRegulatoryConfig(db, { country: "MX", forDate })
    ).rejects.toThrow(NoActiveRegulatoryConfigError);
  });

  it("throws InvalidRegulatoryConfigError when the matched row's config is malformed", async () => {
    const forDate = new Date("2026-02-01T00:00:00.000Z");
    const badRow: FakeRow = {
      id: "vbad",
      country: "CO",
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      config: { ...VALID_PAYLOAD, smlmv: "not-a-number" },
      sourceReference: "malformed",
    };
    const db = createMockDb([badRow], "CO", "2026-02-01");

    await expect(
      resolveActiveRegulatoryConfig(db, { country: "CO", forDate })
    ).rejects.toThrow(InvalidRegulatoryConfigError);
  });
});
