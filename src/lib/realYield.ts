/**
 * Real gross-yield gate — replaces the deleted src/lib/yield.ts heuristic
 * (hardcoded US-state / UK-city rent lookup table, zero real data input).
 *
 * A gross yield is computed ONLY when the market has real rent-comp
 * coverage (>= YIELD_MIN_RENT_COMPS live rent listings, market_rent_stats)
 * — the same gate the Deal Board, the Investment Analysis Report, and the
 * Deal Brochure already use. Below the gate: null, always — never a
 * fallback estimate, national average, or interpolation.
 */

export const YIELD_MIN_RENT_COMPS = 10;

export interface RentBasis {
  /** market_rent_stats.rent_comp_count for this municipality */
  rentCompCount: number;
  /** market_rent_stats.median_rent_price for this municipality, minor units, or null if no comps */
  medianRentPriceMinor: number | null;
}

export function isYieldEligible(rent: RentBasis | null | undefined): boolean {
  return !!rent && rent.rentCompCount >= YIELD_MIN_RENT_COMPS && rent.medianRentPriceMinor != null;
}

/** Gross yield %, or null when the market lacks real rent-comp coverage or price is unusable. */
export function computeRealGrossYieldPct(priceMinor: number | null | undefined, rent: RentBasis | null | undefined): number | null {
  if (!priceMinor || priceMinor <= 0) return null;
  if (!isYieldEligible(rent)) return null;
  return ((rent!.medianRentPriceMinor! * 12) / priceMinor) * 100;
}
