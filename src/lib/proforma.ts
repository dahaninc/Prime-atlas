/**
 * Shared pro-forma engine — used by the Deal Board terminal (client) and the
 * IC memo export API (server) so the numbers in the UI and the exported
 * document can never drift apart.
 */

export interface PF {
  units: number;
  gsfPerUnit: number;
  hardCostPerGsf: number;
  landCost: number;
  rentPerUnitMo: number;
  exitCapPct: number;
  contingencyPct: number;
  /** Construction financing rate (annual %). */
  interestPct: number;
}

export interface PFOut {
  totalGsf: number;
  hardCosts: number;
  softCosts: number;
  contingency: number;
  financingCost: number;
  totalDevCost: number;
  annualNOI: number;
  exitValue: number;      // GDV / stabilized exit value
  profit: number;
  yieldOnCost: number;    // % — stabilized NOI / all-in cost (unlevered)
  marginOnCost: number;   // % — profit / all-in cost
  marginOnGDV: number;    // % — profit / GDV (US committees screen >= 18%)
}

export function computePF(a: PF): PFOut {
  const totalGsf    = a.units * a.gsfPerUnit;
  const hardCosts   = totalGsf * a.hardCostPerGsf;
  const softCosts   = hardCosts * 0.18;
  const contingency = (hardCosts + softCosts) * (a.contingencyPct / 100);
  // Construction loan carry: 55% LTC facility, ~50% average draw across an
  // 18-month build => 0.55 * rate * 0.75 applied to build cost.
  const financingCost = (hardCosts + softCosts + contingency) * 0.55 * (a.interestPct / 100) * 0.75;
  const totalDevCost  = hardCosts + softCosts + contingency + financingCost + a.landCost;
  const annualNOI     = a.units * a.rentPerUnitMo * 12 * (1 - 0.32); // opex 32%
  const exitValue     = annualNOI / (a.exitCapPct / 100);
  const profit        = exitValue - totalDevCost;
  const yieldOnCost   = (annualNOI / totalDevCost) * 100;
  const marginOnCost  = (profit / totalDevCost) * 100;
  const marginOnGDV   = exitValue > 0 ? (profit / exitValue) * 100 : 0;
  return { totalGsf, hardCosts, softCosts, contingency, financingCost, totalDevCost,
           annualNOI, exitValue, profit, yieldOnCost, marginOnCost, marginOnGDV };
}

/* ── Sensitivity grid ─────────────────────────────────────────────────────────
   3x3 matrix: financing rate −1% / base / +1% (rows) against exit cap
   −0.5% / base / +0.5% (columns). Cell metric is development margin on GDV —
   the one number that moves with BOTH levers (yield-on-cost is insensitive to
   exit cap by construction, so a YoC-only grid would show identical columns). */

export interface SensitivityCell {
  ratePct: number;
  capPct: number;
  marginOnGDV: number;
  yieldOnCost: number;
  isBase: boolean;
}

export function sensitivityGrid(a: PF): SensitivityCell[][] {
  const rates = [a.interestPct - 1, a.interestPct, a.interestPct + 1];
  const caps  = [a.exitCapPct - 0.5, a.exitCapPct, a.exitCapPct + 0.5];
  return rates.map((ratePct) =>
    caps.map((capPct) => {
      const out = computePF({ ...a, interestPct: ratePct, exitCapPct: capPct });
      return {
        ratePct, capPct,
        marginOnGDV: out.marginOnGDV,
        yieldOnCost: out.yieldOnCost,
        isBase: ratePct === a.interestPct && capPct === a.exitCapPct,
      };
    }),
  );
}

/* ── Country localization ──────────────────────────────────────────────────── */

export const SQFT_PER_SQM = 10.7639;

/** US audiences read $/SF; UK reads £/sqm. `minorPerSqm` is minor units/sqm. */
export function localizedPpsm(minorPerSqm: number, country: string, sym: string): string {
  if (country === "United States") {
    const perSqft = minorPerSqm / 100 / SQFT_PER_SQM;
    return `${sym}${Math.round(perSqft).toLocaleString()}/SF`;
  }
  return `${sym}${Math.round(minorPerSqm / 100).toLocaleString()}/sqm`;
}

export interface DiligenceItem { key: string; label: string; desc: string }

/** Country-specific conviction checklists. These are analyst attestations —
 *  the platform records what was reviewed; it does not fabricate the data. */
export const DILIGENCE_BY_COUNTRY: Record<string, readonly DiligenceItem[]> = {
  "United States": [
    { key: "sourcing",   label: "Source & pipeline",        desc: "Listing/OM cross-checked against county records" },
    { key: "demand",     label: "Demand fundamentals",      desc: "Population, employment hubs, median income growth" },
    { key: "zoning_far", label: "Zoning & FAR",             desc: "As-of-right envelope, unused air rights, variances" },
    { key: "tax_abate",  label: "Tax abatement status",     desc: "421-a / ICAP / J-51 class exemptions & expirations" },
    { key: "energy",     label: "Energy compliance",        desc: "Carbon caps & penalty exposure (e.g. NYC Local Law 97)" },
    { key: "transit",    label: "Transit & infrastructure", desc: "Subway/commuter proximity, committed public works" },
  ],
  "United Kingdom": [
    { key: "sourcing",   label: "Source & pipeline",        desc: "Official planning portal cross-checked" },
    { key: "demand",     label: "Demand fundamentals",      desc: "Population growth, migration, employment" },
    { key: "planning",   label: "Planning status",          desc: "Permission in place / allocated / windfall risk" },
    { key: "s106_cil",   label: "S106 & CIL exposure",      desc: "Affordable quota, levy liability priced in" },
    { key: "epc_mees",   label: "EPC / MEES compliance",    desc: "Minimum energy standard trajectory to 2030" },
    { key: "transport",  label: "Transport & infrastructure", desc: "Rail/tram links, committed public investment" },
  ],
} as const;

export function moneyFmt(n: number, sym: string): string {
  const abs = Math.abs(n);
  const s = abs >= 1_000_000 ? `${sym}${(abs / 1_000_000).toFixed(1)}M`
          : abs >= 1_000     ? `${sym}${(abs / 1_000).toFixed(1)}K`
          :                    `${sym}${Math.round(abs)}`;
  return n < 0 ? `−${s}` : s;
}
