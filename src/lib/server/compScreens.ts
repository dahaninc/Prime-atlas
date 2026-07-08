/**
 * Server-side helper: run the ZIP-comp screen (src/lib/comps.ts) over the
 * FULL active sale inventory of a set of markets, in one place, so every
 * surface that shows a mispricing count or a discount — /underpriced, the
 * Deal Board row chips, the deal-alert cron — computes it from the same
 * engine as /api/deal-board/listings and the Investment Analysis Report.
 * This is what closed the 2026-07-08 inconsistency where the report said
 * "insufficient comparable data" for SF while /underpriced still advertised
 * SF bargains against the blended metro median.
 *
 * Fetches with pagination (.range) because PostgREST hard-caps any single
 * request at 1000 rows regardless of .limit() — a flat .limit(N) over
 * multiple markets silently truncates to a recency-biased sample, which
 * would make comp sets (and therefore discounts) depend on scrape order.
 *
 * Callers pass US market ids only, by convention: UK listings have no
 * usable size_sqm/ZIP, so the screen structurally returns zero coverage
 * there — fetching ~3.6k UK rows per render to prove 0 every time is
 * wasted work. If UK size/postcode coverage ever lands (see
 * KNOWN_ISSUES.md), this convention is the one place to revisit.
 */

import { screenByZipComps, type CompInput, type CompScreenResult } from "@/lib/comps";
import { MAX_SANE_PRICE, MAX_SANE_SIZE_SQM, MAX_SANE_BEDROOMS } from "@/lib/listingSanity";

export interface ScreenedListingRow {
  id: string;
  address: string | null;
  price: number | null;
  currency_code: string;
  bedrooms: number | null;
  property_type: string | null;
  size_sqm: number | null;
  images: string[] | null;
  municipality_id: string;
}

export interface MarketCompScreen {
  listings: ScreenedListingRow[];
  screen: CompScreenResult;
}

/**
 * Deliberately loose client type: both the RLS server client and the
 * service-role client (different generic instantiations of SupabaseClient)
 * must be accepted, and a precise structural type of the query builder
 * sends tsc into excessively-deep instantiation. Only `.from()` is used.
 */
// eslint-disable-next-line -- `any` is required here, see above
type SupabaseLike = { from(table: string): any };

const PAGE_SIZE = 1000; // PostgREST per-request hard cap

export async function fetchZipCompScreens(
  supabase: SupabaseLike,
  municipalityIds: string[],
): Promise<Map<string, MarketCompScreen>> {
  const out = new Map<string, MarketCompScreen>();
  if (municipalityIds.length === 0) return out;

  const all: ScreenedListingRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("properties")
      .select("id, address, price, currency_code, bedrooms, property_type, size_sqm, images, municipality_id")
      .in("municipality_id", municipalityIds)
      .eq("status", "active")
      .eq("listing_type", "sale")
      .not("price", "is", null)
      .lte("price", MAX_SANE_PRICE) // stopgap vs known scraper corruption — same bound as /api/deal-board/listings
      .order("id", { ascending: true }) // stable pagination key, immune to mid-fetch scrape writes reordering scraped_at
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`compScreens fetch failed: ${error.message}`);
    const rows = (data ?? []) as ScreenedListingRow[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }

  // Same sanitization as /api/deal-board/listings: a corrupted size/bedrooms
  // must neither display nor anchor another listing's comp basis.
  const byMarket = new Map<string, ScreenedListingRow[]>();
  for (const raw of all) {
    const l: ScreenedListingRow = {
      ...raw,
      size_sqm: raw.size_sqm != null && Number(raw.size_sqm) > 0 && Number(raw.size_sqm) <= MAX_SANE_SIZE_SQM ? Number(raw.size_sqm) : null,
      bedrooms: raw.bedrooms != null && raw.bedrooms > 0 && raw.bedrooms <= MAX_SANE_BEDROOMS ? raw.bedrooms : null,
    };
    const bucket = byMarket.get(l.municipality_id);
    if (bucket) bucket.push(l);
    else byMarket.set(l.municipality_id, [l]);
  }

  byMarket.forEach((listings, muniId) => {
    out.set(muniId, { listings, screen: screenByZipComps(listings as CompInput[]) });
  });
  // Markets with zero active sale listings still get an (empty, zero-coverage) entry.
  for (const id of municipalityIds) {
    if (!out.has(id)) out.set(id, { listings: [], screen: screenByZipComps([]) });
  }
  return out;
}
