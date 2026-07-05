import { describe, it, expect } from "vitest";
import { computeScreener, screenerSensitivity, buildScorecard, US_DEFAULT_INPUTS } from "./screener";

describe("computeScreener", () => {
  const out = computeScreener(US_DEFAULT_INPUTS);

  it("computes income cascade correctly", () => {
    // 12 units × $1,850 × 12 = $266,400 GPR
    expect(out.gpr).toBe(266_400);
    // EGI = GPR × 0.95 + 6,000 = 259,080
    expect(out.egi).toBeCloseTo(259_080, 0);
    // NOI = EGI × (1 − 0.40) = 155,448
    expect(out.noi).toBeCloseTo(155_448, 0);
  });

  it("computes cap rate and price/unit", () => {
    expect(out.capRate).toBeCloseTo((155_448 / 2_450_000) * 100, 2); // ≈ 6.34%
    expect(out.pricePerUnit).toBeCloseTo(204_167, 0);
  });

  it("amortizes debt correctly (standard mortgage formula)", () => {
    // $1,715,000 @ 6.5% / 30yr → monthly ≈ $10,840.42
    expect(out.loanAmount).toBe(1_715_000);
    expect(out.annualDebtService).toBeCloseTo(130_079.6, 0);
    expect(out.dscr).toBeCloseTo(155_448 / 130_079.6, 2);
  });

  it("computes equity and cash-on-cash", () => {
    // equity = 30% down + 2% closing = 735,000 + 49,000 = 784,000
    expect(out.equity).toBeCloseTo(784_000, 0);
    expect(out.cashOnCash).toBeCloseTo(((155_448 - 130_085) / 784_000) * 100, 1);
  });

  it("handles zero-debt edge case without division blowups", () => {
    const cash = computeScreener({ ...US_DEFAULT_INPUTS, ltvPct: 0 });
    expect(cash.loanAmount).toBe(0);
    expect(cash.annualDebtService).toBe(0);
    expect(cash.dscr).toBe(0); // undefined DSCR reported as 0, not Infinity
    expect(Number.isFinite(cash.cashOnCash)).toBe(true);
  });

  it("grows exit NOI over the hold and applies exit cap", () => {
    expect(out.exitNoi).toBeCloseTo(155_448 * Math.pow(1.03, 5), 0);
    expect(out.exitValue).toBeCloseTo(out.exitNoi / 0.055, 0);
  });
});

describe("screenerSensitivity", () => {
  it("returns a 3x3 grid with exactly one base cell", () => {
    const grid = screenerSensitivity(US_DEFAULT_INPUTS);
    expect(grid.length).toBe(3);
    expect(grid[0].length).toBe(3);
    expect(grid.flat().filter((c) => c.isBase).length).toBe(1);
  });

  it("cash-on-cash falls as rates rise; exit value falls as cap expands", () => {
    const grid = screenerSensitivity(US_DEFAULT_INPUTS);
    expect(grid[0][1].cashOnCash).toBeGreaterThan(grid[2][1].cashOnCash);
    expect(grid[1][0].exitValue).toBeGreaterThan(grid[1][2].exitValue);
  });
});

describe("buildScorecard", () => {
  const out = computeScreener(US_DEFAULT_INPUTS);

  it("reports deltas, passes and failures per metric — no verdicts", () => {
    const lines = buildScorecard(
      { target_cap_pct: 6.0, min_dscr: 1.25, max_price_per_unit: 250_000,
        target_coc_pct: 8.0, hold_years: 5 },
      out,
    );
    expect(lines.length).toBe(4);
    const cap = lines.find((l) => l.metric === "Cap rate")!;
    expect(cap.pass).toBe(true);              // 6.34% ≥ 6.0%
    const coc = lines.find((l) => l.metric === "Cash-on-cash")!;
    expect(coc.pass).toBe(false);             // ≈3.2% < 8%
    expect(coc.delta).toMatch(/short by/);
    // language check: no advice words anywhere
    for (const l of lines) {
      expect(`${l.delta}${l.target}${l.actual}`).not.toMatch(/buy|sell|recommend|good deal/i);
    }
  });

  it("skips criteria the user left blank", () => {
    const lines = buildScorecard(
      { target_cap_pct: null, min_dscr: 1.2, max_price_per_unit: null,
        target_coc_pct: null, hold_years: null },
      out,
    );
    expect(lines.length).toBe(1);
  });
});
