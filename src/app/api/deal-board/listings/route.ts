/**
 * GET /api/deal-board/listings?municipality_id=...
 *
 * The market-screening mispricing pool for the Deal Board's per-market
 * detail panel and the Investment Analysis Report export. Discounts are
 * computed by src/lib/comps.ts against ZIP-LEVEL COMPARABLE SETS (same
 * ZIP5 × property_type × bedrooms, minimum 5 comps) — NOT against the
 * blended metro-wide median. The 2026-07-08 methodology audit confirmed
 * the old metro-median basis made "discount" a proxy for "smaller/cheaper
 * than the metro's blended property mix" (SF: ordinary condos clustering
 * at ~58% "below market" against a median dragged up by ultra-luxury
 * houses). Each ranked deal now carries its comp evidence — the actual
 * comparables (address, price, ppsqm) its discount was measured against.
 *
 * Data honesty rules (see the 2026-07-08/07-09 data-integrity audits):
 *  - Sanity bounds below are a STOPGAP against known-corrupted scraper
 *    output (onthemarket rent parsing, zillow multi-field parsing — see
 *    supabase/migrations/014/015 and the follow-up task for the real
 *    parser fix). A corrupted row must never reach this response or
 *    anchor another listing's comp basis.
 *  - discountPct requires >= MIN_ZIP_COMPS real same-ZIP/type/bedroom
 *    comparables AND a sane per-listing size_sqm. UK markets have ~0%
 *    usable size_sqm/ZIP today, so discountPct is structurally null there
 *    — not a bug, a real coverage gap. So are most US listings at current
 *    scrape density (~8.5% clear the bar) — rigor over coverage, never a
 *    metro-median fallback, never fabricated, never defaulted to 0.
 *  - zipMispricingCount (returned below) counts listings 15–60% below
 *    their OWN comp basis — the same set `ranked` draws from, so Section
 *    1's headline and Section 3's deals finally agree. It deliberately
 *    does NOT match market_listing_stats.underpriced_count, which still
 *    counts against the blended metro median — that view (and its
 *    consumers /underpriced and deal-alerts) is a known follow-up.
 *  - "Too good to be true" guardrail: a discount beyond ±60% is far more
 *    likely a corrupted/mismatched listing than a genuine bargain (see
 *    the audited $65K 4-bed Austin "house" at an 82% discount) — moved to
 *    `unranked` with unrankedReason: "implausible", never the headline.
 *  - No padding: if fewer than RANKED_DISPLAY_LIMIT listings clear the
 *    mispricing floor, `ranked` is simply shorter.
 *  - grossYieldPct requires >= YIELD_MIN_RENT_COMPS real rent comps for
 *    that market (market_rent_stats, migration 014) — a market-wide median
 *    rent basis, not segmented by this listing's size/postcode (flagged in
 *    copy, not faked). Below the threshold: null + "insufficient_data".
 *  - Ranking guardrail: a deal with a missing metric is never ranked
 *    against — and therefore never silently outranked by — deals with
 *    fuller data. `unranked` is unordered by any score.
 *
 * Follows the same free-tier funnel as every other listings surface
 * (src/lib/access.ts): non-members get locality-only addresses and zero
 * photos — including comp-evidence addresses.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isPaidTier, redactRows, redactStreet } from "@/lib/access";
import { MAX_SANE_PRICE, MAX_SANE_SIZE_SQM, MAX_SANE_BEDROOMS } from "@/lib/listingSanity";
import { screenByZipComps, type CompInput } from "@/lib/comps";

export const dynamic = "force-dynamic";

/**
 * Minimum real rent comps required before a market's median rent is used
 * for yield. percentile_cont on fewer points isn't a defensible market
 * statistic. At n>=10: 17 of 32 in-scope markets qualify (all 14 UK
 * markets; SF, LA, Seattle in the US).
 */
const YIELD_MIN_RENT_COMPS = 10;

// PostgREST caps any single request at 1000 rows; the largest in-scope
// market (London) has ~770 active sale listings, so one request covers
// every market's full inventory — no recency truncation, and the comp
// buckets are built over the FULL inventory, not a sample.
const CANDIDATE_LIMIT = 1000;
const RANKED_DISPLAY_LIMIT = 5;
const UNRANKED_DISPLAY_LIMIT = 3;

interface RawListingRow {
  id: string;
  address: string | null;
  price: number | null;
  currency_code: string;
  bedrooms: number | null;
  property_type: string | null;
  size_sqm: number | null;
  images: string[] | null;
  listing_type: string;
}

export async function GET(req: NextRequest) {
  const municipalityId = req.nextUrl.searchParams.get("municipality_id");
  if (!municipalityId) {
    return NextResponse.json({ error: "municipality_id required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "authentication_required" }, { status: 401 });

  const [{ data: profile }, { data: saleStats }, { data: rentStats }, { data: rawListings }] = await Promise.all([
    supabase.from("profiles").select("subscription_tier").eq("id", user.id).single(),
    supabase.from("market_listing_stats").select("median_ppsqm, median_price, sale_count, underpriced_count, rent_count").eq("municipality_id", municipalityId).maybeSingle(),
    supabase.from("market_rent_stats").select("rent_comp_count, median_rent_price").eq("municipality_id", municipalityId).maybeSingle(),
    supabase
      .from("properties")
      .select("id, address, price, currency_code, bedrooms, property_type, size_sqm, images, listing_type")
      .eq("municipality_id", municipalityId)
      .eq("status", "active")
      .eq("listing_type", "sale") // "deals" means for-sale — yield/discount analysis doesn't apply to rentals
      .not("price", "is", null)
      .lte("price", MAX_SANE_PRICE) // stopgap against known scraper corruption — see module docstring
      .order("scraped_at", { ascending: false })
      .limit(CANDIDATE_LIMIT),
  ]);

  const isMember = isPaidTier(profile?.subscription_tier);
  const medianPpsqm = saleStats?.median_ppsqm != null ? Number(saleStats.median_ppsqm) : null;
  const rentCompCount = rentStats?.rent_comp_count ?? 0;
  const medianRentPrice = rentStats?.median_rent_price != null ? Number(rentStats.median_rent_price) : null;
  const yieldEligible = rentCompCount >= YIELD_MIN_RENT_COMPS && medianRentPrice != null;

  // Stopgap sanity: a corrupted size_sqm/bedrooms must not reach display,
  // enter a discount, or anchor another listing's comp basis.
  const sanitized = ((rawListings ?? []) as RawListingRow[]).map((l) => ({
    ...l,
    size_sqm: l.size_sqm != null && l.size_sqm > 0 && l.size_sqm <= MAX_SANE_SIZE_SQM ? l.size_sqm : null,
    bedrooms: l.bedrooms != null && l.bedrooms > 0 && l.bedrooms <= MAX_SANE_BEDROOMS ? l.bedrooms : null,
  }));

  // ZIP-level comp screen over the market's full sane inventory.
  const screen = screenByZipComps(sanitized as CompInput[]);

  const enriched = sanitized.map((l) => {
    const c = screen.byId.get(l.id)!;
    const grossYieldPct = yieldEligible && l.price != null && l.price > 0
      ? ((medianRentPrice! * 12) / l.price) * 100
      : null;

    return {
      ...l,
      discountPct: c.discountPct,
      compBasisLabel: c.basisLabel,
      compMedianPpsqm: c.compMedianPpsqm,
      // Evidence travels with the deal so the claim is auditable. Address
      // redaction for non-members mirrors the top-level listing rows.
      comps: c.status === "mispriced"
        ? c.comps.map((cp) => ({
            address: isMember ? cp.address : redactStreet(cp.address),
            price: cp.price,
            ppsqm: cp.ppsqm,
          }))
        : [],
      grossYieldPct,
      yieldStatus: yieldEligible ? "ok" as const : "insufficient_data" as const,
      rentCompCount,
      compStatus: c.status,
      unrankedReason: c.status === "implausible"
        ? "implausible" as const
        : c.status === "insufficient_comps"
          ? "insufficient_data" as const
          : null,
    };
  });

  // `ranked` = the same set zipMispricingCount counts, sorted by discount,
  // top N — never padded with sub-threshold listings. A listing priced
  // within 15% of its comp basis is simply not a mispricing opportunity —
  // dropped entirely, not shown as "unranked" (that bucket is for genuine
  // data-coverage gaps and artifacts, not correctly-priced listings).
  const ranked = enriched
    .filter((l) => l.compStatus === "mispriced")
    .sort((a, b) => (b.discountPct as number) - (a.discountPct as number))
    .slice(0, RANKED_DISPLAY_LIMIT);
  const unranked = enriched
    .filter((l) => l.compStatus === "insufficient_comps" || l.compStatus === "implausible")
    .slice(0, UNRANKED_DISPLAY_LIMIT);

  return NextResponse.json({
    ranked: redactRows(ranked, isMember),
    unranked: redactRows(unranked, isMember),
    marketMedianPpsqm: medianPpsqm,
    yieldCompCount: rentCompCount,
    // ZIP-comp mispricing basis — Section 1's headline count and Section
    // 3's ranked deals come from this same screen, computed in this same
    // request. NOT market_listing_stats.underpriced_count (blended metro
    // median — see module docstring).
    zipMispricingCount: screen.mispricingCount,
    compCoverage: { covered: screen.coveredCount, total: screen.totalCount },
    // Same market_listing_stats row this request read, so a multi-section
    // report uses ONE snapshot instead of separately-timed queries to an
    // unmaterialized view that mutates under scraping (previously produced
    // "Median $/SF: n/a" in Section 1 beside real medians in Section 3).
    saleCount: saleStats?.sale_count ?? null,
    medianPrice: saleStats?.median_price != null ? Number(saleStats.median_price) : null,
    underpricedCount: saleStats?.underpriced_count ?? null,
    rentCount: saleStats?.rent_count ?? null,
  });
}
