/**
 * Unit tests for `@/lib/services/pila` — income-summing, empty-month
 * (`422`), and duplicate-period (`409`) logic. Same mock-`RlsTx`-by-table-
 * identity technique `packages/rules-engine/test/resolver.test.ts` uses
 * for its fake `Db`, extended here to also cover `insert`/`update` and the
 * `tx.query.pilaRecords.findFirst` Drizzle relational-query API this
 * service uses for its 404/409 existence checks.
 */
import { describe, expect, it } from "vitest";
import { cuentasDeCobro, invoices, regulatoryConfigVersions, pilaRecords } from "@freeops/db/schema";
import type { RlsTx } from "@freeops/db/rls-client";
import { ApiError } from "@/lib/api/errors";
import {
  createPilaCalculation,
  recalculatePilaCalculation,
  confirmPilaPaid,
  formatPeriod,
  monthDateRange,
  parseMonthParam,
  sumIncomeRows,
} from "@/lib/services/pila";

const VALID_CONFIG_PAYLOAD = {
  smlmv: 1_423_500,
  uvtValue: 47065,
  ibcMinPct: 0.4,
  ibcFloorSmlmv: 1,
  ibcCeilingSmlmv: 25,
  healthPct: 0.125,
  pensionPct: 0.16,
  arlPctByClass: { I: 0.00522, II: 0.01044, III: 0.02436, IV: 0.0435, V: 0.0696 },
};

const REGULATORY_CONFIG_ROW = {
  id: "config-v1",
  country: "CO",
  effectiveFrom: "2025-01-01",
  effectiveTo: null,
  config: VALID_CONFIG_PAYLOAD,
  sourceReference: "test fixture",
};

const PART_TIME_REGIME_CONFIG_ROW = {
  ...REGULATORY_CONFIG_ROW,
  id: "config-v2-part-time",
  config: {
    ...VALID_CONFIG_PAYLOAD,
    partTimeIndependentRegime: {
      pensionIbcBrackets: [
        { daysUpTo: 7, ibcFractionOfSmlmv: 0.25 },
        { daysUpTo: 14, ibcFractionOfSmlmv: 0.5 },
        { daysUpTo: 21, ibcFractionOfSmlmv: 0.75 },
        { daysUpTo: 30, ibcFractionOfSmlmv: 1 },
      ],
      arlIbcSmlmvMultiple: 1,
      compensationFundRateOptions: [0.006, 0.02],
    },
  },
};

interface FakeTxOptions {
  existingRecord?: unknown;
  cdcRows?: { amount: string }[];
  invoiceRows?: { amount: string }[];
  regulatoryConfigRow?: typeof REGULATORY_CONFIG_ROW | null;
  insertShouldConflict?: boolean;
  recordForUpdate?: Record<string, unknown>;
}

/**
 * Builds a stub `RlsTx` satisfying exactly the calls
 * `@/lib/services/pila` (and, transitively, `resolveActiveRegulatoryConfig`)
 * makes: `tx.query.pilaRecords.findFirst`, `tx.select().from(table).where()`
 * (dispatched by table object identity, mirroring
 * `resolver.test.ts`'s `createMockDb`), and `tx.insert()`/`tx.update()`.
 */
function makeFakeTx(opts: FakeTxOptions = {}): RlsTx {
  const cdcRows = opts.cdcRows ?? [];
  const invoiceRows = opts.invoiceRows ?? [];
  const regulatoryConfigRow = opts.regulatoryConfigRow === undefined ? REGULATORY_CONFIG_ROW : opts.regulatoryConfigRow;

  const fakeTx = {
    query: {
      pilaRecords: {
        findFirst: async () => opts.existingRecord ?? undefined,
      },
    },
    select: () => ({
      from: (table: unknown) => {
        if (table === cuentasDeCobro) {
          return { where: async () => cdcRows };
        }
        if (table === invoices) {
          return { where: async () => invoiceRows };
        }
        if (table === regulatoryConfigVersions) {
          return {
            where: () => ({
              orderBy: () => ({
                limit: async () => (regulatoryConfigRow ? [regulatoryConfigRow] : []),
              }),
            }),
          };
        }
        throw new Error("makeFakeTx: unexpected table passed to select().from()");
      },
    }),
    insert: (table: unknown) => {
      if (table !== pilaRecords) throw new Error("makeFakeTx: unexpected insert target");
      return {
        values: (vals: Record<string, unknown>) => ({
          returning: async () => {
            if (opts.insertShouldConflict) {
              const err = new Error("duplicate key value violates unique constraint") as Error & { code: string };
              err.code = "23505";
              throw err;
            }
            return [{ id: "new-record-id", ...vals }];
          },
        }),
      };
    },
    update: (table: unknown) => {
      if (table !== pilaRecords) throw new Error("makeFakeTx: unexpected update target");
      return {
        set: (patch: Record<string, unknown>) => ({
          where: () => ({
            returning: async () => [{ ...(opts.recordForUpdate ?? {}), ...patch }],
          }),
        }),
      };
    },
  };

  return fakeTx as unknown as RlsTx;
}

describe("parseMonthParam", () => {
  it("parses a well-formed YYYY-MM string", () => {
    expect(parseMonthParam("2026-08")).toEqual({ periodYear: 2026, periodMonth: 8 });
  });

  it("throws a VALIDATION_ERROR ApiError for a malformed string", () => {
    expect(() => parseMonthParam("not-a-month")).toThrow(ApiError);
  });

  it("throws for an out-of-range month", () => {
    expect(() => parseMonthParam("2026-13")).toThrow(ApiError);
  });
});

describe("formatPeriod", () => {
  it("zero-pads the month and round-trips with parseMonthParam", () => {
    expect(formatPeriod(2026, 3)).toBe("2026-03");
    expect(parseMonthParam(formatPeriod(2026, 3))).toEqual({ periodYear: 2026, periodMonth: 3 });
  });
});

describe("monthDateRange", () => {
  it("returns [start, end) bounds within a year", () => {
    expect(monthDateRange(2026, 3)).toEqual({ start: "2026-03-01", end: "2026-04-01" });
  });

  it("rolls over into the next year for December", () => {
    expect(monthDateRange(2026, 12)).toEqual({ start: "2026-12-01", end: "2027-01-01" });
  });
});

describe("sumIncomeRows", () => {
  it("sums numeric-string amount columns", () => {
    expect(sumIncomeRows([{ amount: "100.50" }, { amount: "49.50" }])).toBe(150);
  });

  it("returns 0 for an empty list", () => {
    expect(sumIncomeRows([])).toBe(0);
  });

  it("treats a null amount as 0 rather than throwing", () => {
    expect(sumIncomeRows([{ amount: null }, { amount: "10" }])).toBe(10);
  });
});

describe("createPilaCalculation", () => {
  it("throws CONFLICT (409) when a record already exists for that user+period", async () => {
    const tx = makeFakeTx({ existingRecord: { id: "existing" } });

    await expect(createPilaCalculation(tx, "user-1", { month: "2026-08" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("throws UNPROCESSABLE_ENTITY (422) when no cuentas de cobro/invoices exist for that month", async () => {
    const tx = makeFakeTx({ cdcRows: [], invoiceRows: [] });

    await expect(createPilaCalculation(tx, "user-1", { month: "2026-08" })).rejects.toMatchObject({
      code: "UNPROCESSABLE_ENTITY",
    });
  });

  it("sums cuentas de cobro + invoices amount columns and computes PILA via the rules engine", async () => {
    const tx = makeFakeTx({
      cdcRows: [{ amount: "1000000.00" }],
      invoiceRows: [{ amount: "2000000.00" }],
    });

    const created = (await createPilaCalculation(tx, "user-1", { month: "2026-08" })) as Record<string, unknown>;

    // grossMonthlyIncomeCop = 3,000,000; ibcMinPct 0.4 -> raw IBC 1,200,000,
    // clamped to [1x, 25x] SMLMV (1,423,500 .. 35,587,500) -> floor applies.
    expect(created.totalIncomeBase).toBe("3000000.00");
    expect(created.ibc).toBe((VALID_CONFIG_PAYLOAD.smlmv * VALID_CONFIG_PAYLOAD.ibcFloorSmlmv).toFixed(2));
    expect(created.arlContribution).toBeNull();
    expect(created.status).toBe("calculated");
    expect(created.regulatoryConfigVersionId).toBe(REGULATORY_CONFIG_ROW.id);
  });

  it("ignores draft/cancelled documents by construction — the caller only ever passes already-filtered eligible rows", async () => {
    // sumMonthlyIncome's own SQL filters status in ('issued','paid','overdue') —
    // this test documents the contract at the pure-sum level: whatever
    // rows the (mocked) query layer returns are trusted verbatim.
    const tx = makeFakeTx({ cdcRows: [{ amount: "500.00" }], invoiceRows: [] });
    const created = (await createPilaCalculation(tx, "user-1", { month: "2026-01" })) as Record<string, unknown>;
    expect(created.totalIncomeBase).toBe("500.00");
  });

  it("translates a DB-level unique-constraint violation into CONFLICT (race backstop)", async () => {
    const tx = makeFakeTx({
      cdcRows: [{ amount: "1000000.00" }],
      insertShouldConflict: true,
    });

    await expect(createPilaCalculation(tx, "user-1", { month: "2026-08" })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  describe("cotizante tipo 76 (income below 1 SMLMV, config declares partTimeIndependentRegime)", () => {
    it("throws a needs_part_time_info 422 (creates nothing) when daysWorkedInPeriod/arlRiskClass are missing", async () => {
      const tx = makeFakeTx({
        cdcRows: [{ amount: "500000.00" }], // well below the 1,423,500 SMLMV fixture
        regulatoryConfigRow: PART_TIME_REGIME_CONFIG_ROW,
      });

      await expect(createPilaCalculation(tx, "user-1", { month: "2026-08" })).rejects.toMatchObject({
        code: "UNPROCESSABLE_ENTITY",
        details: expect.objectContaining({ reason: "needs_part_time_info", cotizanteType: "76" }),
      });
    });

    it("computes and persists the 76 regime once daysWorkedInPeriod/arlRiskClass are supplied", async () => {
      const tx = makeFakeTx({
        cdcRows: [{ amount: "500000.00" }],
        regulatoryConfigRow: PART_TIME_REGIME_CONFIG_ROW,
      });

      const created = (await createPilaCalculation(tx, "user-1", {
        month: "2026-08",
        daysWorkedInPeriod: 8,
        arlRiskClass: "I",
        compensationFundRate: 0.02,
      })) as Record<string, unknown>;

      expect(created.cotizanteType).toBe("76");
      expect(created.ibc).toBe((0.5 * VALID_CONFIG_PAYLOAD.smlmv).toFixed(2)); // 8 days -> 2nd bracket
      expect(created.healthContribution).toBeNull();
      expect(created.arlIbc).toBe(VALID_CONFIG_PAYLOAD.smlmv.toFixed(2));
      expect(created.daysWorkedInPeriod).toBe(8);
      expect(created.arlRiskClass).toBe("I");
      expect(created.compensationFundContribution).not.toBeNull();
    });

    it("does not require part-time info when income is at/above 1 SMLMV, even under the part-time-regime config", async () => {
      const tx = makeFakeTx({
        cdcRows: [{ amount: "5000000.00" }],
        regulatoryConfigRow: PART_TIME_REGIME_CONFIG_ROW,
      });

      const created = (await createPilaCalculation(tx, "user-1", { month: "2026-08" })) as Record<string, unknown>;
      expect(created.cotizanteType).toBe("standard");
    });
  });
});

describe("recalculatePilaCalculation", () => {
  it("returns null when the record doesn't exist / isn't owned", async () => {
    const tx = makeFakeTx({ existingRecord: undefined });
    const result = await recalculatePilaCalculation(tx, "user-1", "missing-id");
    expect(result).toBeNull();
  });

  it("throws UNPROCESSABLE_ENTITY (422) when the record is already paid", async () => {
    const tx = makeFakeTx({
      existingRecord: { id: "rec-1", periodYear: 2026, periodMonth: 8, status: "paid" },
    });

    await expect(recalculatePilaCalculation(tx, "user-1", "rec-1")).rejects.toMatchObject({
      code: "UNPROCESSABLE_ENTITY",
    });
  });

  it("re-sums income and overwrites the computed figures while status is 'calculated'", async () => {
    const tx = makeFakeTx({
      existingRecord: { id: "rec-1", periodYear: 2026, periodMonth: 8, status: "calculated" },
      cdcRows: [{ amount: "4000000.00" }],
      invoiceRows: [],
      recordForUpdate: { id: "rec-1" },
    });

    const updated = (await recalculatePilaCalculation(tx, "user-1", "rec-1")) as Record<string, unknown>;
    expect(updated.totalIncomeBase).toBe("4000000.00");
    expect(updated.regulatoryConfigVersionId).toBe(REGULATORY_CONFIG_ROW.id);
  });

  it("reuses the record's stored daysWorkedInPeriod/arlRiskClass for a 76-regime recalculation", async () => {
    const tx = makeFakeTx({
      existingRecord: {
        id: "rec-1",
        periodYear: 2026,
        periodMonth: 8,
        status: "calculated",
        daysWorkedInPeriod: 14,
        arlRiskClass: "II",
        compensationFundRate: "0.0200",
      },
      cdcRows: [{ amount: "500000.00" }],
      invoiceRows: [],
      regulatoryConfigRow: PART_TIME_REGIME_CONFIG_ROW,
      recordForUpdate: { id: "rec-1" },
    });

    const updated = (await recalculatePilaCalculation(tx, "user-1", "rec-1")) as Record<string, unknown>;
    expect(updated.cotizanteType).toBe("76");
    expect(updated.ibc).toBe((0.5 * VALID_CONFIG_PAYLOAD.smlmv).toFixed(2)); // 14 days -> 2nd bracket
  });

  it("throws needs_part_time_info on recalculate when income newly dropped below 1 SMLMV without stored days/risk-class", async () => {
    const tx = makeFakeTx({
      existingRecord: { id: "rec-1", periodYear: 2026, periodMonth: 8, status: "calculated" },
      cdcRows: [{ amount: "500000.00" }],
      invoiceRows: [],
      regulatoryConfigRow: PART_TIME_REGIME_CONFIG_ROW,
    });

    await expect(recalculatePilaCalculation(tx, "user-1", "rec-1")).rejects.toMatchObject({
      code: "UNPROCESSABLE_ENTITY",
      details: expect.objectContaining({ reason: "needs_part_time_info" }),
    });
  });
});

describe("confirmPilaPaid", () => {
  it("returns null when the record doesn't exist / isn't owned", async () => {
    const tx = makeFakeTx({ existingRecord: undefined });
    const result = await confirmPilaPaid(tx, "user-1", "missing-id", { paidDate: "2026-09-01" });
    expect(result).toBeNull();
  });

  it("throws UNPROCESSABLE_ENTITY (422) when already paid", async () => {
    const tx = makeFakeTx({ existingRecord: { id: "rec-1", status: "paid" } });

    await expect(confirmPilaPaid(tx, "user-1", "rec-1", { paidDate: "2026-09-01" })).rejects.toMatchObject({
      code: "UNPROCESSABLE_ENTITY",
    });
  });

  it("sets status to 'paid' and persists paidAt/confirmationReference/operator", async () => {
    const tx = makeFakeTx({
      existingRecord: { id: "rec-1", status: "calculated" },
      recordForUpdate: { id: "rec-1" },
    });

    const updated = (await confirmPilaPaid(tx, "user-1", "rec-1", {
      paidDate: "2026-09-01",
      confirmationReference: "REF-123",
      operator: "miplanilla",
    })) as Record<string, unknown>;

    expect(updated.status).toBe("paid");
    expect(updated.paidAt).toBe("2026-09-01");
    expect(updated.confirmationReference).toBe("REF-123");
    expect(updated.operator).toBe("miplanilla");
  });
});
