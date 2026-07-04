/**
 * Heuristic gross-yield estimator for scraped listings.
 * Mirrors the model used in the property report email so members see the
 * same number everywhere. Rents are rough regional baselines (USD/month for
 * US states, GBP/month for UK regions) scaled by bedroom count.
 */

const STATE_RENTS: Record<string, number> = {
  NY: 2800, CA: 2600, WA: 2200, MA: 2800, CO: 2000,
  FL: 2000, MD: 2000, OR: 1800, TX: 1800, AZ: 1600,
  GA: 1600, TN: 1600, NC: 1500, MN: 1500, PA: 1500,
  NV: 1700, IL: 1700, OH: 1200, MI: 1200, WI: 1200,
  KY: 1100, VA: 2000, SC: 1400, IN: 1100, MO: 1200,
};

const BED_MULT: Record<number, number> = { 0: 0.6, 1: 0.75, 2: 1.0, 3: 1.3, 4: 1.55 };

export interface YieldInput {
  price: number | null;          // minor units (cents/pence)
  currency_code: string;
  bedrooms: number | null;
  address: string | null;
}

export function estimateMonthlyRent(p: YieldInput): number | null {
  const beds = p.bedrooms ?? 2;
  const bedMult = BED_MULT[Math.min(beds, 4)] ?? 1.0;

  if (p.currency_code === "GBP") {
    const addr = (p.address ?? "").toLowerCase();
    let base: number;
    if (addr.includes("london")) base = 2500;
    else if (addr.includes("manchester") || addr.includes("birmingham")) base = 1200;
    else if (addr.includes("bristol") || addr.includes("edinburgh") || addr.includes("oxford")) base = 1400;
    else base = 1100;
    return Math.round(base * bedMult);
  }

  const stateCode = p.address?.match(/,\s*([A-Z]{2})\s+\d{5}/)?.[1] ?? "";
  const base = STATE_RENTS[stateCode] ?? 1600;
  return Math.round(base * bedMult);
}

/** Estimated gross yield in %, or null when price is unusable. */
export function estimateGrossYield(p: YieldInput): number | null {
  if (!p.price || p.price <= 0) return null;
  const rent = estimateMonthlyRent(p);
  if (!rent) return null;
  const priceMajor = p.price / 100;
  const grossYield = ((rent * 12) / priceMajor) * 100;
  if (!isFinite(grossYield) || grossYield <= 0 || grossYield > 50) return null;
  return Math.round(grossYield * 10) / 10;
}
