/**
 * ZIP-level comparable-set discount engine (pure, no I/O).
 *
 * Replaces the blended metro-median discount basis (2026-07-08 methodology
 * finding): measuring every listing against one market-wide median $/sqm
 * made "discount" a proxy for "smaller/cheaper than the metro's blended
 * property mix," not "underpriced against like-for-like properties" — in
 * San Francisco this clustered ordinary condos at ~58% "below market"
 * because the median was dragged up by ultra-luxury single-family homes.
 *
 * The comparable set for a listing is: other active sale listings in the
 * SAME municipality, SAME ZIP5, SAME property_type, SAME bedroom count,
 * each with a usable price and size. A discount is only computed when at
 * least MIN_ZIP_COMPS such comparables exist (subject excluded) — below
 * that, the honest output is "insufficient comparable data," NEVER a
 * fallback to a metro-wide number. Deliberately rigor-over-coverage: most
 * listings in most markets will not clear this bar at current scrape
 * density (~8.5% of US sale listings at n>=5 as of 2026-07-08), and UK
 * listings never will until the scraper captures size/postcode (0% today).
 *
 * Every computed discount carries its evidence: the actual comps (address,
 * price, $/sqm) it was measured against, so a user can see WHY a listing
 * is called underpriced and judge the claim — a discount an investor can
 * audit, not one they have to take on faith.
 *
 * Units: `price` is minor units (cents/pence) everywhere in this schema;
 * ppsqm is therefore minor units per sqm. Callers format for display via
 * money.ts/localizedPpsm — never hand-rolled division here.
 */

/** Minimum same-ZIP/type/bedroom comparables (excluding the subject) before a discount is computed. */
export const MIN_ZIP_COMPS = 5;
/** A listing must be at least this far below its comp basis to count as a mispricing opportunity. */
export const MISPRICING_MIN_DISCOUNT_PCT = 15;
/** Beyond this magnitude, a discount is treated as a likely data artifact, not a bargain. */
export const DISCOUNT_IMPLAUSIBLE_PCT = 60;

export interface CompInput {
  id: string;
  address: string | null;
  /** minor units; pre-sanitized by the caller (listingSanity bounds) */
  price: number | null;
  /** pre-sanitized by the caller */
  size_sqm: number | null;
  /** pre-sanitized by the caller */
  bedrooms: number | null;
  property_type: string | null;
}

export interface CompEvidence {
  id: string;
  address: string | null;
  /** minor units */
  price: number;
  /** minor units per sqm */
  ppsqm: number;
}

export type CompStatus =
  /** discount computed, within the 15–60% mispricing band — rankable */
  | "mispriced"
  /** discount computed, < 15% below basis — priced near market, not an opportunity */
  | "below_floor"
  /** discount computed but beyond ±60% — presumed data artifact, never a headline deal */
  | "implausible"
  /** fewer than MIN_ZIP_COMPS valid comparables (or subject missing price/size/ZIP/type/bedrooms) */
  | "insufficient_comps";

export interface CompScreenEntry {
  status: CompStatus;
  /** Present only when status is "mispriced" — matches what may be shown/ranked. */
  discountPct: number | null;
  /** The comp set the discount was measured against (empty when insufficient). */
  comps: CompEvidence[];
  /** Median ppsqm of the comp set, minor units/sqm (null when insufficient). */
  compMedianPpsqm: number | null;
  /** Human-readable basis, e.g. "ZIP 28202 · Condo · 2 bed" (null when insufficient). */
  basisLabel: string | null;
}

export interface CompScreenResult {
  /** keyed by listing id */
  byId: Map<string, CompScreenEntry>;
  /** Listings 15–60% below their own comp basis — the honest mispricing count. */
  mispricingCount: number;
  /** Listings with a valid comp basis (>= MIN_ZIP_COMPS), regardless of where they priced. */
  coveredCount: number;
  totalCount: number;
}

/** US ZIP5 from the tail of a scraped address ("..., Charlotte, NC 28202" / "...28202-1234"). */
export function extractZip5(address: string | null): string | null {
  if (!address) return null;
  const m = address.trim().match(/(\d{5})(?:-\d{4})?$/);
  return m ? m[1] : null;
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Screens a municipality's active sale listings against ZIP-level comp sets.
 * Inputs must already be sanity-bounded (listingSanity) — this engine trusts
 * that a non-null price/size is plausible and only reasons about comparability.
 */
export function screenByZipComps(listings: CompInput[]): CompScreenResult {
  // Bucket: ZIP5 × property_type × bedrooms. A listing only enters a bucket
  // (as subject OR comp) with all identity fields plus a computable ppsqm —
  // a comp whose size is corrupted/missing can't anchor anyone's value.
  const buckets = new Map<string, { input: CompInput; zip5: string; ppsqm: number }[]>();
  const keyed = new Map<string, string>(); // listing id -> bucket key

  for (const l of listings) {
    const zip5 = extractZip5(l.address);
    if (zip5 == null || l.property_type == null || l.bedrooms == null) continue;
    if (l.price == null || l.price <= 0 || l.size_sqm == null || l.size_sqm <= 0) continue;
    const key = `${zip5}|${l.property_type}|${l.bedrooms}`;
    const entry = { input: l, zip5, ppsqm: l.price / l.size_sqm };
    const bucket = buckets.get(key);
    if (bucket) bucket.push(entry);
    else buckets.set(key, [entry]);
    keyed.set(l.id, key);
  }

  const byId = new Map<string, CompScreenEntry>();
  let mispricingCount = 0;
  let coveredCount = 0;

  const insufficient: CompScreenEntry = {
    status: "insufficient_comps", discountPct: null, comps: [], compMedianPpsqm: null, basisLabel: null,
  };

  for (const l of listings) {
    const key = keyed.get(l.id);
    const bucket = key ? buckets.get(key) : undefined;
    if (!key || !bucket) { byId.set(l.id, insufficient); continue; }

    const subject = bucket.find((b) => b.input.id === l.id)!;
    const comps = bucket.filter((b) => b.input.id !== l.id);
    if (comps.length < MIN_ZIP_COMPS) { byId.set(l.id, insufficient); continue; }

    coveredCount++;
    const compMedianPpsqm = median(comps.map((c) => c.ppsqm).sort((a, b) => a - b));
    const rawDiscountPct = (1 - subject.ppsqm / compMedianPpsqm) * 100;

    const status: CompStatus = Math.abs(rawDiscountPct) > DISCOUNT_IMPLAUSIBLE_PCT
      ? "implausible"
      : rawDiscountPct < MISPRICING_MIN_DISCOUNT_PCT
        ? "below_floor"
        : "mispriced";
    if (status === "mispriced") mispricingCount++;

    byId.set(l.id, {
      status,
      discountPct: status === "mispriced" ? rawDiscountPct : null,
      // Evidence sorted cheapest-first so the table reads as a price ladder.
      comps: comps
        .map((c) => ({ id: c.input.id, address: c.input.address, price: c.input.price!, ppsqm: c.ppsqm }))
        .sort((a, b) => a.ppsqm - b.ppsqm),
      compMedianPpsqm,
      basisLabel: `ZIP ${subject.zip5} · ${l.property_type} · ${l.bedrooms} bed`,
    });
  }

  return { byId, mispricingCount, coveredCount, totalCount: listings.length };
}
