"use server";

import type { MarketReport } from "@/lib/marketReport";

/**
 * In-app report generation disabled for launch (2026-07-09): this action
 * computed its "underpriced" count from the blended metro median
 * (market_listing_stats.underpriced_count), not the ZIP-comp basis every
 * other surface (Deal Board, Market Feed) now uses — for Charlotte that was
 * 45 vs. Deal Board's real 9, a live in-app contradiction. Mirrors the
 * report-sharing disable in src/app/actions/share.ts. Short-circuited here
 * (rather than only removing the UI) so no direct call to this action can
 * produce a contradicting report either. Re-enable once this is migrated
 * onto the ZIP-comp engine (src/lib/comps.ts).
 */
export async function generateMarketReport(): Promise<
  { ok: true; report: MarketReport; remaining: number; id: string } | { ok: false; error: string }
> {
  return { ok: false, error: "generation_disabled" };
}
