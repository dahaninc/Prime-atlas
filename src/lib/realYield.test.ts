import { describe, it, expect } from "vitest";
import { computeRealGrossYieldPct, isYieldEligible, YIELD_MIN_RENT_COMPS } from "./realYield";

describe("computeRealGrossYieldPct", () => {
  it("computes real gross yield from real rent-comp median at/above the gate", () => {
    // $300,000 price, $2,000/mo real median rent, 12 comps -> 8.0% gross yield
    const y = computeRealGrossYieldPct(300_000_00, { rentCompCount: 12, medianRentPriceMinor: 2_000_00 });
    expect(y).toBeCloseTo(8.0, 5);
  });

  it("returns null below the comp-count gate, never a fallback", () => {
    expect(computeRealGrossYieldPct(300_000_00, { rentCompCount: YIELD_MIN_RENT_COMPS - 1, medianRentPriceMinor: 2_000_00 })).toBeNull();
  });

  it("returns null exactly at comp-count 0 and null rent basis", () => {
    expect(computeRealGrossYieldPct(300_000_00, null)).toBeNull();
    expect(computeRealGrossYieldPct(300_000_00, { rentCompCount: 0, medianRentPriceMinor: null })).toBeNull();
  });

  it("returns null for missing or non-positive price regardless of rent coverage", () => {
    expect(computeRealGrossYieldPct(null, { rentCompCount: 20, medianRentPriceMinor: 2_000_00 })).toBeNull();
    expect(computeRealGrossYieldPct(0, { rentCompCount: 20, medianRentPriceMinor: 2_000_00 })).toBeNull();
  });

  it("is eligible exactly at the gate (>=10)", () => {
    expect(isYieldEligible({ rentCompCount: YIELD_MIN_RENT_COMPS, medianRentPriceMinor: 1 })).toBe(true);
    expect(isYieldEligible({ rentCompCount: YIELD_MIN_RENT_COMPS - 1, medianRentPriceMinor: 1 })).toBe(false);
  });
});
