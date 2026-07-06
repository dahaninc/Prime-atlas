/**
 * Value levers — the strategy annex on shared analyses.
 *
 * For a given deal, quantifies how much each actionable lever moves
 * cash-on-cash and value: renegotiated price, financing rate, rent
 * programme, expense discipline, leverage. Pure recomputation of the
 * screener engine under stated single-variable moves — the reader sees
 * WHICH lever pays the most on THIS deal, ranked. Calculations from the
 * stored inputs, never advice.
 */

import { computeScreener, type ScreenerInputs } from "./screener";

export interface ValueLever {
  lever: string;
  move: string;                 // the stated single-variable change
  cocDeltaPts: number;          // cash-on-cash delta, percentage points
  capDeltaPts: number;          // cap-rate delta, percentage points
  exitValueDelta: number;       // major units
  narrative: string;
}

const LEVER_DEFS: {
  lever: string; move: string;
  apply: (i: ScreenerInputs) => ScreenerInputs;
  narrative: (l: ValueLever) => string;
}[] = [
  {
    lever: "Purchase price",
    move: "negotiate −5%",
    apply: (i) => ({ ...i, purchasePrice: i.purchasePrice * 0.95 }),
    narrative: (l) =>
      `A 5% price reduction moves cash-on-cash by ${fmtPts(l.cocDeltaPts)} — entry basis is ${Math.abs(l.cocDeltaPts) >= 1 ? "a first-order" : "a secondary"} driver on this deal.`,
  },
  {
    lever: "Financing rate",
    move: "−50bp (shop the debt)",
    apply: (i) => ({ ...i, interestPct: i.interestPct - 0.5 }),
    narrative: (l) =>
      `Fifty basis points of rate moves cash-on-cash by ${fmtPts(l.cocDeltaPts)} — ${Math.abs(l.cocDeltaPts) >= 1 ? "debt terms matter as much as price here" : "this deal is relatively rate-insensitive"}.`,
  },
  {
    lever: "Rent programme",
    move: "+5% in-place rents",
    apply: (i) => ({ ...i, avgRentMo: i.avgRentMo * 1.05 }),
    narrative: (l) =>
      `A 5% rent lift is worth ${fmtPts(l.cocDeltaPts)} of cash-on-cash and ${fmtMoneyDelta(l.exitValueDelta)} of exit value at the stated exit cap.`,
  },
  {
    lever: "Expense discipline",
    move: "−3pts expense ratio",
    apply: (i) => ({ ...i, expenseRatioPct: Math.max(0, i.expenseRatioPct - 3) }),
    narrative: (l) =>
      `Three points of opex ratio recovered adds ${fmtPts(l.cocDeltaPts)} to cash-on-cash — every point flows straight to NOI.`,
  },
  {
    lever: "Leverage",
    move: "+5pts LTV",
    apply: (i) => ({ ...i, ltvPct: Math.min(90, i.ltvPct + 5) }),
    narrative: (l) =>
      `Five more points of leverage moves cash-on-cash by ${fmtPts(l.cocDeltaPts)}${l.cocDeltaPts < 0 ? " — negative leverage territory at the current rate/cap spread" : ", with commensurately higher rate exposure"}.`,
  },
];

function fmtPts(n: number): string {
  return `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(2)} pts`;
}
function fmtMoneyDelta(n: number): string {
  const a = Math.abs(n);
  const s = a >= 1_000_000 ? `${(a / 1_000_000).toFixed(2)}M` : a >= 1_000 ? `${Math.round(a / 1_000)}K` : `${Math.round(a)}`;
  return `${n >= 0 ? "+" : "−"}${s}`;
}

/** Ranked by cash-on-cash impact, biggest lever first. */
export function computeValueLevers(inputs: ScreenerInputs): ValueLever[] {
  const base = computeScreener(inputs);
  return LEVER_DEFS
    .map((def) => {
      const out = computeScreener(def.apply(inputs));
      const lever: ValueLever = {
        lever: def.lever,
        move: def.move,
        cocDeltaPts: out.cashOnCash - base.cashOnCash,
        capDeltaPts: out.capRate - base.capRate,
        exitValueDelta: out.exitValue - base.exitValue,
        narrative: "",
      };
      lever.narrative = def.narrative(lever);
      return lever;
    })
    .sort((a, b) => Math.abs(b.cocDeltaPts) - Math.abs(a.cocDeltaPts));
}
