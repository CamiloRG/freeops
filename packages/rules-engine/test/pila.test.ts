import { describe, expect, it } from "vitest";
import { calculatePila, InvalidPilaInputError } from "../src/pila";
import type { RegulatoryConfigPayload } from "../src/config";

// Mirrors the real co-2026-01.json seed values, so expectations here are
// hand-computable against the same numbers a reviewer can spot-check.
const CO_2026_CONFIG: RegulatoryConfigPayload = {
  smlmv: 1750905,
  uvtValue: 52374,
  ibcMinPct: 0.4,
  ibcFloorSmlmv: 1,
  ibcCeilingSmlmv: 25,
  healthPct: 0.125,
  pensionPct: 0.16,
  arlPctByClass: {
    I: 0.00522,
    II: 0.01044,
    III: 0.02436,
    IV: 0.0435,
    V: 0.0696,
  },
};

describe("calculatePila", () => {
  it("clamps the IBC to the floor (1 SMLMV) for a very low income", () => {
    // 40% of 1,000,000 = 400,000, well below the floor of 1,750,905.
    const result = calculatePila({
      grossMonthlyIncomeCop: 1_000_000,
      config: CO_2026_CONFIG,
    });

    expect(result.ibc).toBe(CO_2026_CONFIG.smlmv);
    expect(result.healthContribution).toBe(round2(CO_2026_CONFIG.smlmv * 0.125));
    expect(result.pensionContribution).toBe(round2(CO_2026_CONFIG.smlmv * 0.16));
    expect(result.arlContribution).toBeNull();
    expect(result.totalAmountOwed).toBe(
      round2(result.healthContribution + result.pensionContribution)
    );
  });

  it("clamps the IBC to the ceiling (25 SMLMV) for a very high income", () => {
    // 40% of 500,000,000 = 200,000,000, well above the ceiling of
    // 25 * 1,750,905 = 43,772,625.
    const ceiling = 25 * CO_2026_CONFIG.smlmv;
    const result = calculatePila({
      grossMonthlyIncomeCop: 500_000_000,
      config: CO_2026_CONFIG,
    });

    expect(result.ibc).toBe(round2(ceiling));
    expect(result.healthContribution).toBe(round2(ceiling * 0.125));
    expect(result.pensionContribution).toBe(round2(ceiling * 0.16));
  });

  it("computes the standard mid-range case against a hand-computed value", () => {
    // Gross income 5,000,000 COP/month.
    // IBC = 40% * 5,000,000 = 2,000,000 (between floor 1,750,905 and
    // ceiling 43,772,625, so no clamping).
    const grossIncome = 5_000_000;
    const expectedIbc = 2_000_000;
    const expectedHealth = round2(expectedIbc * 0.125); // 250,000.00
    const expectedPension = round2(expectedIbc * 0.16); // 320,000.00
    const expectedArl = round2(expectedIbc * 0.00522); // 10,440.00 (Class I)

    const result = calculatePila({
      grossMonthlyIncomeCop: grossIncome,
      config: CO_2026_CONFIG,
      arlRiskClass: "I",
    });

    expect(result.ibc).toBe(expectedIbc);
    expect(result.healthContribution).toBe(expectedHealth);
    expect(result.pensionContribution).toBe(expectedPension);
    expect(result.arlContribution).toBe(expectedArl);
    expect(result.totalAmountOwed).toBe(
      round2(expectedHealth + expectedPension + expectedArl)
    );
    // Sanity-check the hand-computed literals themselves.
    expect(expectedHealth).toBe(250000);
    expect(expectedPension).toBe(320000);
    expect(expectedArl).toBe(10440);
    expect(result.totalAmountOwed).toBe(580440);
  });

  it("omits ARL (null) when arlRiskClass is not passed", () => {
    const result = calculatePila({
      grossMonthlyIncomeCop: 5_000_000,
      config: CO_2026_CONFIG,
    });

    expect(result.arlContribution).toBeNull();
    expect(result.totalAmountOwed).toBe(
      round2(result.healthContribution + result.pensionContribution)
    );
  });

  it("throws InvalidPilaInputError for zero, negative, or NaN income", () => {
    expect(() =>
      calculatePila({ grossMonthlyIncomeCop: 0, config: CO_2026_CONFIG })
    ).toThrow(InvalidPilaInputError);
    expect(() =>
      calculatePila({ grossMonthlyIncomeCop: -100, config: CO_2026_CONFIG })
    ).toThrow(InvalidPilaInputError);
    expect(() =>
      calculatePila({ grossMonthlyIncomeCop: NaN, config: CO_2026_CONFIG })
    ).toThrow(InvalidPilaInputError);
  });
});

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
