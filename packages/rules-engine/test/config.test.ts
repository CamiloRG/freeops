import { describe, expect, it } from "vitest";
import {
  InvalidRegulatoryConfigError,
  parseRegulatoryConfigPayload,
} from "../src/config";

const VALID_CONFIG = {
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

describe("parseRegulatoryConfigPayload", () => {
  it("accepts a well-formed payload", () => {
    const parsed = parseRegulatoryConfigPayload(VALID_CONFIG);
    expect(parsed.smlmv).toBe(1750905);
    expect(parsed.arlPctByClass.IV).toBe(0.0435);
  });

  it("rejects a payload missing a required field", () => {
    const { smlmv, ...missingSmlmv } = VALID_CONFIG;
    expect(() => parseRegulatoryConfigPayload(missingSmlmv)).toThrow(
      InvalidRegulatoryConfigError
    );
  });

  it("rejects a payload with a string where a number belongs", () => {
    const malformed = { ...VALID_CONFIG, smlmv: "1750905" };
    expect(() => parseRegulatoryConfigPayload(malformed)).toThrow(
      InvalidRegulatoryConfigError
    );
  });

  it("rejects a payload with a string inside arlPctByClass", () => {
    const malformed = {
      ...VALID_CONFIG,
      arlPctByClass: { ...VALID_CONFIG.arlPctByClass, I: "0.00522" },
    };
    expect(() => parseRegulatoryConfigPayload(malformed)).toThrow(
      InvalidRegulatoryConfigError
    );
  });

  it("rejects a ceiling below the floor", () => {
    const malformed = { ...VALID_CONFIG, ibcFloorSmlmv: 30, ibcCeilingSmlmv: 25 };
    expect(() => parseRegulatoryConfigPayload(malformed)).toThrow(
      InvalidRegulatoryConfigError
    );
  });

  it("accepts a payload with a well-formed partTimeIndependentRegime block", () => {
    const withRegime = {
      ...VALID_CONFIG,
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
    };
    const parsed = parseRegulatoryConfigPayload(withRegime);
    expect(parsed.partTimeIndependentRegime?.compensationFundRateOptions).toEqual([0.006, 0.02]);
  });

  it("rejects a partTimeIndependentRegime whose pensionIbcBrackets never reaches day 30", () => {
    const malformed = {
      ...VALID_CONFIG,
      partTimeIndependentRegime: {
        pensionIbcBrackets: [{ daysUpTo: 21, ibcFractionOfSmlmv: 0.75 }],
        arlIbcSmlmvMultiple: 1,
        compensationFundRateOptions: [0.006],
      },
    };
    expect(() => parseRegulatoryConfigPayload(malformed)).toThrow(InvalidRegulatoryConfigError);
  });

  it("rejects null/undefined/non-object input", () => {
    expect(() => parseRegulatoryConfigPayload(null)).toThrow(
      InvalidRegulatoryConfigError
    );
    expect(() => parseRegulatoryConfigPayload(undefined)).toThrow(
      InvalidRegulatoryConfigError
    );
    expect(() => parseRegulatoryConfigPayload("not an object")).toThrow(
      InvalidRegulatoryConfigError
    );
  });
});
