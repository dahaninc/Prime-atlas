import { describe, it, expect } from "vitest";
import { buildMarketReport, type MarketReportSource } from "./marketReport";

const baseSource: MarketReportSource = {
  muni: {
    id: "m1", name: "Austin", region: "Texas", country: "United States",
    currency_code: "USD", population: 950_000,
    opportunity_score: 82, growth_score: 78, risk_score: 35,
    development_score: 70, infrastructure_score: 65, liquidity_score: 74,
  },
  stats: {
    sale_count: 200, rent_count: 120,
    median_price: 45_000_000,   // $450,000 in minor units
    median_ppsqm: 350_000,      // $3,500/sqm in minor units
    underpriced_count: 24,
  },
  history: [
    { captured_on: "2026-06-01", opportunity_score: 78, growth_score: 75, risk_score: 36 },
    { captured_on: "2026-06-08", opportunity_score: 80, growth_score: 76, risk_score: 35 },
    { captured_on: "2026-06-15", opportunity_score: 82, growth_score: 78, risk_score: 35 },
  ],
  countryMedianPpsqm: 400_000,
};

describe("buildMarketReport", () => {
  it("converts minor units to major and computes shares", () => {
    const r = buildMarketReport(baseSource);
    expect(r.inventory.medianPrice).toBe(450_000);
    expect(r.inventory.medianPpsqm).toBe(3_500);
    expect(r.inventory.underpricedSharePct).toBeCloseTo(12, 1);
    expect(r.inventory.rentToSaleRatio).toBeCloseTo(0.6, 5);
  });

  it("orders momentum oldest-first and computes the delta", () => {
    const r = buildMarketReport(baseSource);
    expect(r.momentum[0].capturedOn).toBe("2026-06-01");
    expect(r.momentumDeltaPts).toBeCloseTo(4, 5);
  });

  it("builds three rate scenarios around the USD base rate", () => {
    const r = buildMarketReport(baseSource);
    expect(r.rate.baseRatePct).toBe(6.5);
    expect(r.rate.scenarios.map((s) => s.ratePct)).toEqual([5.5, 6.5, 7.5]);
    // Higher rate → higher debt service and breakeven yield.
    const [lo, base, hi] = r.rate.scenarios;
    expect(hi.annualDebtService).toBeGreaterThan(base.annualDebtService);
    expect(base.annualDebtService).toBeGreaterThan(lo.annualDebtService);
    expect(hi.breakevenYieldPct).toBeGreaterThan(lo.breakevenYieldPct);
  });

  it("amortization: remaining balance decreases with horizon and stays under 100%", () => {
    const r = buildMarketReport(baseSource);
    for (const s of r.rate.scenarios) {
      const [h3, h5, h10] = s.horizons;
      expect(h3.remainingBalancePct).toBeLessThan(100);
      expect(h5.remainingBalancePct).toBeLessThan(h3.remainingBalancePct);
      expect(h10.remainingBalancePct).toBeLessThan(h5.remainingBalancePct);
      expect(h10.cumulativeInterest).toBeGreaterThan(h3.cumulativeInterest);
    }
  });

  it("value drift: base scenario is flat, +100bp negative, -100bp positive", () => {
    const r = buildMarketReport(baseSource);
    const [lo, base, hi] = r.rate.scenarios;
    expect(base.horizons[0].impliedValueDeltaPct).toBeCloseTo(0, 5);
    expect(hi.horizons[0].impliedValueDeltaPct).toBeLessThan(0);
    expect(lo.horizons[0].impliedValueDeltaPct).toBeGreaterThan(0);
  });

  it("uses GBP base rate for UK markets and £ symbol", () => {
    const r = buildMarketReport({
      ...baseSource,
      muni: { ...baseSource.muni, country: "United Kingdom", currency_code: "GBP" },
    });
    expect(r.rate.baseRatePct).toBe(5.25);
    expect(r.market.currencySymbol).toBe("£");
  });

  it("degrades without stats: no scenarios, no crash", () => {
    const r = buildMarketReport({ ...baseSource, stats: null });
    expect(r.rate.scenarios).toEqual([]);
    expect(r.inventory.saleCount).toBe(0);
    expect(r.inventory.underpricedSharePct).toBeNull();
  });

  it("never emits verdict language in signal notes", () => {
    const r = buildMarketReport(baseSource);
    const text = r.demandSignals.map((s) => `${s.label} ${s.note}`).join(" ").toLowerCase();
    expect(text).not.toMatch(/good deal|buy now|recommend|guaranteed/);
    expect(r.disclaimer).toMatch(/not investment advice/);
  });
});
