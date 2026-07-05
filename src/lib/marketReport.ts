/**
 * Deal Board market report engine.
 *
 * Deterministic computation over Prime Atlas's own market data — municipality
 * conviction scores, live listing statistics, and weekly score history. The
 * demand-signal narratives are template interpretations of computed numbers,
 * and the rate-implication grid models a representative median-priced asset
 * under stated assumptions. No verdicts, no recommendations — calculations
 * and clearly-labelled assumptions only.
 */

export interface MarketReportSource {
  muni: {
    id: string; name: string; region: string; country: string;
    currency_code: string | null; population: number;
    opportunity_score: number; growth_score: number; risk_score: number;
    development_score: number; infrastructure_score: number; liquidity_score: number;
  };
  stats: {
    sale_count: number | null; rent_count: number | null;
    median_price: number | null;   // minor units
    median_ppsqm: number | null;   // minor units
    underpriced_count: number | null;
  } | null;
  history: { captured_on: string; opportunity_score: number; growth_score: number; risk_score: number }[];
  /** Median ppsqm across all covered markets in the same country (minor units). */
  countryMedianPpsqm: number | null;
}

export interface RateScenarioRow {
  ratePct: number;
  annualDebtService: number;   // major units
  breakevenYieldPct: number;   // debt service / price
  horizons: {
    years: number;
    cumulativeInterest: number;   // major units
    remainingBalancePct: number;  // % of original loan
    /** Value drift if cap rates move 50bp per 100bp of rate change vs base. */
    impliedValueDeltaPct: number;
  }[];
}

export interface DemandSignal {
  label: string;
  value: string;
  reading: "strong" | "neutral" | "soft";
  note: string;
}

export interface MarketReport {
  generatedAt: string;
  market: { name: string; region: string; country: string; currencySymbol: string };
  scores: {
    opportunity: number; growth: number; risk: number;
    development: number; infrastructure: number; liquidity: number;
  };
  momentum: { capturedOn: string; opportunity: number }[];
  momentumDeltaPts: number | null;
  inventory: {
    saleCount: number; rentCount: number;
    medianPrice: number | null;   // major units
    medianPpsqm: number | null;   // major units
    underpricedCount: number; underpricedSharePct: number | null;
    rentToSaleRatio: number | null;
  };
  demandSignals: DemandSignal[];
  rate: {
    baseRatePct: number;
    assumptions: string;
    scenarios: RateScenarioRow[];   // base-1 / base / base+1
  };
  disclaimer: string;
}

export const REPORT_DISCLAIMER =
  "All figures are deterministic calculations from Prime Atlas market data and the stated " +
  "assumptions. Rate scenarios model a representative median-priced asset, not any specific " +
  "property. This is market analytics, not investment advice.";

const HOLD_HORIZONS = [3, 5, 10];

/** Amortization math for one rate scenario over the standard horizons. */
function rateScenario(price: number, ratePct: number, baseRatePct: number): RateScenarioRow {
  const ltv = 0.70;
  const amortYears = 30;
  const loan = price * ltv;
  const r = ratePct / 100 / 12;
  const n = amortYears * 12;
  const pmt = r > 0
    ? loan * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
    : loan / n;

  const horizons = HOLD_HORIZONS.map((years) => {
    const m = years * 12;
    // Remaining balance after m payments (standard annuity formula).
    const remaining = r > 0
      ? loan * (Math.pow(1 + r, n) - Math.pow(1 + r, m)) / (Math.pow(1 + r, n) - 1)
      : loan * (1 - m / n);
    const principalPaid = loan - remaining;
    const cumulativeInterest = pmt * m - principalPaid;
    // Stated assumption: cap rates drift 50bp per 100bp of financing-rate move.
    // Value impact via cap-rate expansion/compression on a 5.5% base cap.
    const baseCap = 5.5;
    const scenarioCap = baseCap + (ratePct - baseRatePct) * 0.5;
    const impliedValueDeltaPct = ((baseCap / scenarioCap) - 1) * 100;
    return {
      years,
      cumulativeInterest,
      remainingBalancePct: (remaining / loan) * 100,
      impliedValueDeltaPct,
    };
  });

  return {
    ratePct,
    annualDebtService: pmt * 12,
    breakevenYieldPct: price > 0 ? (pmt * 12 / price) * 100 : 0,
    horizons,
  };
}

export function buildMarketReport(src: MarketReportSource): MarketReport {
  const sym = src.muni.currency_code === "GBP" ? "£" : "$";
  const saleCount = src.stats?.sale_count ?? 0;
  const rentCount = src.stats?.rent_count ?? 0;
  const medianPriceMajor = src.stats?.median_price != null ? src.stats.median_price / 100 : null;
  const medianPpsqmMajor = src.stats?.median_ppsqm != null ? src.stats.median_ppsqm / 100 : null;
  const underpriced = src.stats?.underpriced_count ?? 0;
  const underpricedShare = saleCount > 0 ? (underpriced / saleCount) * 100 : null;
  const rentToSale = saleCount > 0 ? rentCount / saleCount : null;

  /* Momentum: weekly opportunity-score snapshots, oldest → newest. */
  const momentum = [...src.history]
    .sort((a, b) => a.captured_on.localeCompare(b.captured_on))
    .map((h) => ({ capturedOn: h.captured_on, opportunity: h.opportunity_score }));
  const momentumDelta = momentum.length >= 2
    ? momentum[momentum.length - 1].opportunity - momentum[0].opportunity
    : null;

  /* Demand signals — template interpretations of computed numbers. */
  const signals: DemandSignal[] = [];

  if (rentToSale != null) {
    const reading = rentToSale >= 0.8 ? "strong" : rentToSale >= 0.35 ? "neutral" : "soft";
    signals.push({
      label: "Rental demand proxy",
      value: `${rentToSale.toFixed(2)} rent : sale listings`,
      reading,
      note: reading === "strong"
        ? "Deep rental inventory relative to sales — consistent with active tenant demand and landlord participation."
        : reading === "neutral"
        ? "Balanced rental-to-sales inventory — no acute pressure in either direction."
        : "Thin rental inventory vs sales — either owner-occupier-dominated or limited landlord activity.",
    });
  }
  if (underpricedShare != null) {
    const reading = underpricedShare >= 12 ? "strong" : underpricedShare >= 5 ? "neutral" : "soft";
    signals.push({
      label: "Mispricing opportunity",
      value: `${underpricedShare.toFixed(1)}% of sale listings ≥15% below median /sqm`,
      reading,
      note: reading === "strong"
        ? "Elevated share of below-median pricing — dispersion this wide usually rewards fast, criteria-driven screening."
        : reading === "neutral"
        ? "Normal pricing dispersion for a functioning market."
        : "Tight pricing — sellers are anchored near the median, little visible dispersion to work.",
    });
  }
  if (src.countryMedianPpsqm != null && src.stats?.median_ppsqm != null) {
    const rel = (src.stats.median_ppsqm / src.countryMedianPpsqm - 1) * 100;
    const reading = rel <= -15 ? "strong" : rel <= 20 ? "neutral" : "soft";
    signals.push({
      label: "Relative value vs national coverage",
      value: `${rel >= 0 ? "+" : ""}${rel.toFixed(0)}% vs country median /sqm`,
      reading,
      note: reading === "strong"
        ? "Prices well below the national coverage median — entry basis is the structural advantage here."
        : reading === "neutral"
        ? "Priced in line with national coverage — market selection matters more than entry basis."
        : "Premium market — underwriting depends on rent depth and exit liquidity, not entry discount.",
    });
  }
  if (momentumDelta != null) {
    const reading = momentumDelta >= 2 ? "strong" : momentumDelta >= -2 ? "neutral" : "soft";
    signals.push({
      label: "Score momentum",
      value: `${momentumDelta >= 0 ? "+" : ""}${momentumDelta.toFixed(1)} pts over tracked window`,
      reading,
      note: reading === "strong"
        ? "Composite conviction score is trending up across weekly snapshots."
        : reading === "neutral"
        ? "Score is stable week over week."
        : "Composite score is softening — watch the next snapshots before sizing up.",
    });
  }

  /* Rate implications: base rate by currency zone, ±100bp scenarios. */
  const baseRate = src.muni.currency_code === "GBP" ? 5.25 : 6.5;
  const price = medianPriceMajor ?? 0;
  const scenarios = price > 0
    ? [baseRate - 1, baseRate, baseRate + 1].map((r) => rateScenario(price, r, baseRate))
    : [];

  return {
    generatedAt: new Date().toISOString(),
    market: {
      name: src.muni.name, region: src.muni.region,
      country: src.muni.country, currencySymbol: sym,
    },
    scores: {
      opportunity: src.muni.opportunity_score,
      growth: src.muni.growth_score,
      risk: src.muni.risk_score,
      development: src.muni.development_score,
      infrastructure: src.muni.infrastructure_score,
      liquidity: src.muni.liquidity_score,
    },
    momentum,
    momentumDeltaPts: momentumDelta,
    inventory: {
      saleCount, rentCount,
      medianPrice: medianPriceMajor,
      medianPpsqm: medianPpsqmMajor,
      underpricedCount: underpriced,
      underpricedSharePct: underpricedShare,
      rentToSaleRatio: rentToSale,
    },
    demandSignals: signals,
    rate: {
      baseRatePct: baseRate,
      assumptions:
        `Representative asset at the market's median sale price, 70% LTV, 30-year amortization. ` +
        `Base financing rate ${baseRate.toFixed(2)}% (${src.muni.currency_code === "GBP" ? "UK" : "US"} zone) ± 100bp. ` +
        `Value drift assumes cap rates move 50bp per 100bp of rate change from a 5.5% base cap.`,
      scenarios,
    },
    disclaimer: REPORT_DISCLAIMER,
  };
}
