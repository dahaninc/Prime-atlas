/**
 * Deal Screener engine — US acquisition module.
 *
 * Pure pro-forma math over user/parsed inputs ONLY. No market comps, no
 * "underpriced vs median" claims, no verdicts — scorecards report per-metric
 * deltas against the user's own saved criteria. (UK module — initial yield,
 * SDLT, service charge conventions — ships separately once the US module has
 * validated with design partners, per spec.)
 */

export interface ScreenerInputs {
  purchasePrice: number;     // major units
  units: number;
  avgRentMo: number;         // per unit, monthly, major units
  otherIncomeYr: number;     // parking/laundry/etc, annual
  vacancyPct: number;        // e.g. 5
  expenseRatioPct: number;   // % of EGI, e.g. 40 (or from parsed T12)
  ltvPct: number;            // e.g. 70
  interestPct: number;       // e.g. 6.5
  amortYears: number;        // e.g. 30
  closingCostPct: number;    // % of price, e.g. 2
  exitCapPct: number;        // e.g. 5.5
  holdYears: number;         // e.g. 5
  rentGrowthPct: number;     // annual, e.g. 3
}

export interface ScreenerOutputs {
  gpr: number;               // gross potential rent (annual)
  egi: number;               // effective gross income
  opex: number;
  noi: number;
  capRate: number;           // % — NOI / purchase price
  pricePerUnit: number;
  loanAmount: number;
  annualDebtService: number;
  dscr: number;
  equity: number;            // down payment + closing costs
  cashFlowYr1: number;       // NOI - debt service
  cashOnCash: number;        // %
  exitNoi: number;           // NOI grown over hold
  exitValue: number;         // exit NOI / exit cap
}

export function computeScreener(i: ScreenerInputs): ScreenerOutputs {
  const gpr  = i.units * i.avgRentMo * 12;
  const egi  = gpr * (1 - i.vacancyPct / 100) + i.otherIncomeYr;
  const opex = egi * (i.expenseRatioPct / 100);
  const noi  = egi - opex;

  const capRate      = i.purchasePrice > 0 ? (noi / i.purchasePrice) * 100 : 0;
  const pricePerUnit = i.units > 0 ? i.purchasePrice / i.units : 0;

  const loanAmount = i.purchasePrice * (i.ltvPct / 100);
  const r = i.interestPct / 100 / 12;
  const n = i.amortYears * 12;
  const monthlyPmt = r > 0 && n > 0
    ? loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
    : n > 0 ? loanAmount / n : 0;
  const annualDebtService = monthlyPmt * 12;
  const dscr = annualDebtService > 0 ? noi / annualDebtService : 0;

  const equity      = i.purchasePrice - loanAmount + i.purchasePrice * (i.closingCostPct / 100);
  const cashFlowYr1 = noi - annualDebtService;
  const cashOnCash  = equity > 0 ? (cashFlowYr1 / equity) * 100 : 0;

  const exitNoi   = noi * Math.pow(1 + i.rentGrowthPct / 100, Math.max(0, i.holdYears));
  const exitValue = i.exitCapPct > 0 ? exitNoi / (i.exitCapPct / 100) : 0;

  return { gpr, egi, opex, noi, capRate, pricePerUnit, loanAmount,
           annualDebtService, dscr, equity, cashFlowYr1, cashOnCash, exitNoi, exitValue };
}

/* ── Sensitivity: financing rate ±1% × exit cap ±0.5% ─────────────────────── */

export interface ScreenerSensCell {
  ratePct: number; capPct: number;
  cashOnCash: number; exitValue: number; isBase: boolean;
}

export function screenerSensitivity(i: ScreenerInputs): ScreenerSensCell[][] {
  const rates = [i.interestPct - 1, i.interestPct, i.interestPct + 1];
  const caps  = [i.exitCapPct - 0.5, i.exitCapPct, i.exitCapPct + 0.5];
  return rates.map((ratePct) => caps.map((capPct) => {
    const out = computeScreener({ ...i, interestPct: ratePct, exitCapPct: capPct });
    return { ratePct, capPct, cashOnCash: out.cashOnCash, exitValue: out.exitValue,
             isBase: ratePct === i.interestPct && capPct === i.exitCapPct };
  }));
}

/* ── Scorecard: criteria-match deltas, never verdicts ─────────────────────── */

export interface Criteria {
  target_cap_pct: number | null;
  min_dscr: number | null;
  max_price_per_unit: number | null;
  target_coc_pct: number | null;
  hold_years: number | null;
}

export interface ScorecardLine {
  metric: string;
  target: string;
  actual: string;
  pass: boolean;
  delta: string;             // human-readable shortfall/surplus
}

export const SCORECARD_DISCLAIMER =
  "This is a calculation against your inputs, not investment advice.";

export function buildScorecard(c: Criteria, o: ScreenerOutputs, sym = "$"): ScorecardLine[] {
  const lines: ScorecardLine[] = [];
  const money = (n: number) =>
    n >= 1_000_000 ? `${sym}${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000   ? `${sym}${Math.round(n / 1_000)}K`
    :                `${sym}${Math.round(n)}`;

  if (c.target_cap_pct != null) {
    const pass = o.capRate >= c.target_cap_pct;
    const d = o.capRate - c.target_cap_pct;
    lines.push({
      metric: "Cap rate", target: `≥ ${c.target_cap_pct.toFixed(2)}%`,
      actual: `${o.capRate.toFixed(2)}%`, pass,
      delta: pass ? `+${d.toFixed(2)} pts above target`
                  : `short by ${Math.abs(d).toFixed(2)} pts at current assumptions`,
    });
  }
  if (c.min_dscr != null) {
    const pass = o.dscr >= c.min_dscr;
    const d = o.dscr - c.min_dscr;
    lines.push({
      metric: "DSCR", target: `≥ ${c.min_dscr.toFixed(2)}x`,
      actual: `${o.dscr.toFixed(2)}x`, pass,
      delta: pass ? `+${d.toFixed(2)}x headroom`
                  : `short by ${Math.abs(d).toFixed(2)}x at current rate assumption`,
    });
  }
  if (c.max_price_per_unit != null) {
    const pass = o.pricePerUnit <= c.max_price_per_unit;
    const d = o.pricePerUnit - c.max_price_per_unit;
    lines.push({
      metric: "Price / unit", target: `≤ ${money(c.max_price_per_unit)}`,
      actual: money(o.pricePerUnit), pass,
      delta: pass ? `${money(Math.abs(d))} under ceiling`
                  : `${money(d)} over ceiling`,
    });
  }
  if (c.target_coc_pct != null) {
    const pass = o.cashOnCash >= c.target_coc_pct;
    const d = o.cashOnCash - c.target_coc_pct;
    lines.push({
      metric: "Cash-on-cash", target: `≥ ${c.target_coc_pct.toFixed(1)}%`,
      actual: `${o.cashOnCash.toFixed(1)}%`, pass,
      delta: pass ? `+${d.toFixed(1)} pts above target`
                  : `short by ${Math.abs(d).toFixed(1)} pts at current assumptions`,
    });
  }
  return lines;
}

export const US_DEFAULT_INPUTS: ScreenerInputs = {
  purchasePrice: 2_450_000, units: 12, avgRentMo: 1_850, otherIncomeYr: 6_000,
  vacancyPct: 5, expenseRatioPct: 40, ltvPct: 70, interestPct: 6.5,
  amortYears: 30, closingCostPct: 2, exitCapPct: 5.5, holdYears: 5, rentGrowthPct: 3,
};
