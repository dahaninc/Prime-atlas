import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { DealBoard } from "@/components/deal-board/DealBoard";
import type {
  DealRow, LiveOpportunity, MarketStats,
  EvidenceInfra, EvidencePlanning, EvidenceSignal,
} from "@/components/deal-board/DealBoard";
import type { ExplorerDeal } from "@/components/deal-board/AllMarketsExplorer";
import { fetchZipCompScreens } from "@/lib/server/compScreens";
import { normalizeTier, underpricedListingLimit, canExportDealBrochure } from "@/lib/entitlements";

export const metadata: Metadata = {
  title: "Deal Board | prime-atlas",
  description: "Site-acquisition terminal. Ranked markets by ROI, zoning momentum, and demand pressure.",
};

export const dynamic = "force-dynamic";

export default async function DealBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  /*
   * ── Anonymous visitors: the public teaser, not a login wall ─────────────
   * Preserves exactly what /underpriced showed logged-out visitors before
   * the 2026-07-09 merge — aggregate mispricing counts per market + a
   * waitlist CTA, zero listing data, zero per-market screening. Locked into
   * All-Markets/free-tier view (DealBoard.tsx enforces this client-side
   * too); every authed feature (This Market screening, financing, memo and
   * brochure export) is unreachable from here and independently 401s at
   * the API layer regardless (/api/deal-board/listings,
   * /api/export/ic-memo, /api/export/deal-brochure). This is why
   * /deal-board was removed from middleware's PROTECTED_ROUTES — the page
   * itself is the gate, and it only ever hands anonymous requests this
   * deliberately thin dataset.
   */
  if (!user) {
    const { data: muniRows } = await supabase
      .from("municipalities").select("id, name, country").eq("country", "United States");
    const usIds = (muniRows ?? []).map((m) => m.id);
    const zipScreens = await fetchZipCompScreens(supabase, usIds);
    const muniById = new Map((muniRows ?? []).map((m) => [m.id, m]));
    const rankedAllMarkets = usIds
      .map((id) => ({ id, ...zipScreens.get(id)! }))
      .filter((s) => s.screen.mispricingCount > 0)
      .sort((a, b) => b.screen.mispricingCount - a.screen.mispricingCount)
      .slice(0, 8);
    const allMarketsAggregate = rankedAllMarkets.map((s) => ({
      id: s.id, name: muniById.get(s.id)?.name ?? "",
      mispricingCount: s.screen.mispricingCount, coveredCount: s.screen.coveredCount, totalCount: s.screen.totalCount,
    }));
    const allMarketsTotalFlagged = rankedAllMarkets.reduce((n, s) => n + s.screen.mispricingCount, 0);
    const allMarketsCoveredCount = usIds.filter((id) => (zipScreens.get(id)?.screen.coveredCount ?? 0) > 0).length;

    return (
      <div className="min-h-screen bg-background">
        <DealBoard
          rows={[]}
          tier="free"
          freshnessMap={{}}
          opportunitiesMap={{}}
          statsMap={{}}
          prevScoreMap={{}}
          evidence={{ infra: {}, planning: {}, signals: {} }}
          checklistMap={{}}
          zipMispricingMap={{}}
          initialViewMode="all"
          allMarketsDeals={[]}
          allMarketsAggregate={allMarketsAggregate}
          allMarketsTotalFlagged={allMarketsTotalFlagged}
          allMarketsCoveredCount={allMarketsCoveredCount}
          allMarketsIsTeaser={false}
          allMarketsLockedCount={0}
          allMarketsCanBrochure={false}
          allMarketsIsFreeTier
          waitlistJoined={false}
          userIsAuthed={false}
        />
      </div>
    );
  }

  const [profileRes, municipalitiesRes, freshnessRes, opportunitiesRes, statsRes, historyRes, infraRes, signalsRes, checklistRes, rentStatsRes, waitlistRes] = await Promise.all([
    supabase.from("profiles").select("subscription_tier").eq("id", user.id).single(),
    supabase.from("municipalities").select(
      `id, name, region, country, currency_code,
       opportunity_score, growth_score, infrastructure_score,
       development_score, liquidity_score, risk_score,
       population, retrieved_at, source_name, data_confidence, slug`
    ).in("country", ["United Kingdom", "United States"])
     .order("opportunity_score", { ascending: false }).limit(120),
    supabase.from("data_freshness").select("market_iso2, last_updated"),
    supabase.from("opportunities")
      .select("id, municipality_id, title, investment_thesis, category, opportunity_score, risk_level, source_name, source_url")
      .eq("status", "active")
      .order("opportunity_score", { ascending: false }),
    supabase.from("market_listing_stats").select("*"),
    supabase.from("market_score_history")
      .select("municipality_id, captured_on, opportunity_score")
      .lt("captured_on", new Date().toISOString().slice(0, 10))
      .order("captured_on", { ascending: false }),
    supabase.from("infrastructure_projects")
      .select("municipality_id, project_name, type, budget, status, expected_completion")
      .order("impact_score", { ascending: false }),
    supabase.from("signals")
      .select("municipality_id, title, signal_type, opportunity_impact, detected_at")
      .order("detected_at", { ascending: false })
      .limit(200),
    supabase.from("deal_checklist_items")
      .select("municipality_id, checklist_key")
      .eq("user_id", user.id),
    // All-Markets view (merged 2026-07-09 from /underpriced) needs real
    // yield per deal — same >=10-comp gate as everywhere else.
    supabase.from("market_rent_stats").select("municipality_id, rent_comp_count, median_rent_price"),
    supabase.from("underpriced_waitlist").select("id").eq("user_id", user.id).limit(1).maybeSingle(),
  ]);

  const tier = (profileRes.data?.subscription_tier ?? "free") as
    "free" | "explorer" | "professional" | "institutional";

  const isoToCountry: Record<string, string> = {
    GB: "United Kingdom", US: "United States",
  };
  const freshnessMap: Record<string, string> = {};
  for (const f of (freshnessRes.data ?? []) as Array<{ market_iso2: string; last_updated: string | null }>) {
    const country = isoToCountry[f.market_iso2];
    if (country && f.last_updated) freshnessMap[country] = f.last_updated;
  }

  const rows = (municipalitiesRes.data ?? []).map((m) => ({
    ...m,
    currency_code:   m.currency_code   ?? "USD",
    source_name:     m.source_name     ?? "manual",
    data_confidence: m.data_confidence ?? 0.5,
    retrieved_at:    m.retrieved_at    ?? null,
  })) as DealRow[];

  // ZIP-comp mispricing count per US market (src/lib/comps.ts basis) for the
  // per-row chips — same screen the detail panel and memo use, so the row
  // list can never advertise blended-median "underpriced" counts the panel
  // below would contradict. UK is structurally uncovered (no chip).
  const usIds = rows.filter((r) => r.country === "United States").map((r) => r.id);
  const zipScreens = await fetchZipCompScreens(supabase, usIds);
  const zipMispricingMap: Record<string, number> = {};
  zipScreens.forEach((s, id) => { zipMispricingMap[id] = s.screen.mispricingCount; });

  /*
   * ── All-Markets view data (merged 2026-07-09 from the standalone
   * /underpriced page — same screenByZipComps engine, same pool, just
   * reusing the zipScreens map already fetched above for the row chips
   * instead of a second fetchZipCompScreens call). Identical construction
   * to what /underpriced did: top 8 covered markets by mispricing count,
   * flat deal list capped at 200, real yield gated on real rent comps.
   */
  const rentBasisMap = new Map(
    (rentStatsRes.data ?? []).map((r) => [r.municipality_id as string, {
      rentCompCount: r.rent_comp_count ?? 0,
      medianRentPriceMinor: r.median_rent_price != null ? Number(r.median_rent_price) : null,
    }]),
  );
  const muniById = new Map(rows.map((r) => [r.id, r]));
  const rankedAllMarkets = usIds
    .map((id) => ({ id, ...zipScreens.get(id)! }))
    .filter((s) => s.screen.mispricingCount > 0)
    .sort((a, b) => b.screen.mispricingCount - a.screen.mispricingCount)
    .slice(0, 8);

  const allMarketsAggregate = rankedAllMarkets.map((s) => ({
    id: s.id,
    name: muniById.get(s.id)?.name ?? "",
    mispricingCount: s.screen.mispricingCount,
    coveredCount: s.screen.coveredCount,
    totalCount: s.screen.totalCount,
  }));
  const allMarketsTotalFlagged = rankedAllMarkets.reduce((n, s) => n + s.screen.mispricingCount, 0);
  const allMarketsCoveredCount = usIds.filter((id) => (zipScreens.get(id)?.screen.coveredCount ?? 0) > 0).length;

  const allMarketsDealsFull: ExplorerDeal[] = rankedAllMarkets.flatMap((s) => {
    const muni = muniById.get(s.id);
    const rent = rentBasisMap.get(s.id);
    const rentEligible = (rent?.rentCompCount ?? 0) >= 10 && rent?.medianRentPriceMinor != null;
    return s.listings
      .map((l) => ({ l, c: s.screen.byId.get(l.id)! }))
      .filter(({ c }) => c.status === "mispriced")
      .map(({ l, c }) => ({
        id: l.id, address: l.address, price: l.price!, ppsqm: l.price! / (l.size_sqm as number),
        bedrooms: l.bedrooms, property_type: l.property_type, size_sqm: l.size_sqm,
        image: l.images?.[0] ?? null,
        marketId: s.id, marketName: muni?.name ?? "", currency: muni?.currency_code ?? "USD",
        discountPct: c.discountPct!, compCount: c.comps.length, basisLabel: c.basisLabel,
        grossYieldPct: rentEligible ? ((Number(rent!.medianRentPriceMinor) * 12) / l.price!) * 100 : null,
      }));
  }).sort((a, b) => b.discountPct - a.discountPct).slice(0, 200);

  const allMarketsLimit = underpricedListingLimit(tier); // 0 = free (aggregate only), N = Explorer teaser, null = full feed
  const allMarketsIsTeaser = allMarketsLimit !== null && allMarketsLimit !== 0;
  const allMarketsDeals = allMarketsLimit === 0
    ? []
    : allMarketsIsTeaser ? allMarketsDealsFull.slice(0, allMarketsLimit!) : allMarketsDealsFull;
  const allMarketsLockedCount = Math.max(0, allMarketsDealsFull.length - allMarketsDeals.length);
  const allMarketsCanBrochure = canExportDealBrochure(tier);

  // Build opportunities map keyed by municipality_id
  const opportunitiesMap: Record<string, LiveOpportunity[]> = {};
  for (const opp of (opportunitiesRes.data ?? []) as LiveOpportunity[]) {
    if (opp.municipality_id) {
      if (!opportunitiesMap[opp.municipality_id]) opportunitiesMap[opp.municipality_id] = [];
      opportunitiesMap[opp.municipality_id].push(opp);
    }
  }

  // Live listing stats per market
  const statsMap: Record<string, MarketStats> = {};
  for (const st of (statsRes.data ?? []) as MarketStats[]) {
    if (st.municipality_id) statsMap[st.municipality_id] = st;
  }

  // Previous opportunity score per market (most recent snapshot before today)
  const prevScoreMap: Record<string, number> = {};
  for (const h of (historyRes.data ?? []) as Array<{ municipality_id: string; opportunity_score: number }>) {
    if (!(h.municipality_id in prevScoreMap)) prevScoreMap[h.municipality_id] = h.opportunity_score;
  }

  const groupBy = <T extends { municipality_id: string | null }>(items: T[], cap: number) => {
    const map: Record<string, T[]> = {};
    for (const it of items) {
      if (!it.municipality_id) continue;
      (map[it.municipality_id] ??= []);
      if (map[it.municipality_id].length < cap) map[it.municipality_id].push(it);
    }
    return map;
  };

  const evidence = {
    infra:    groupBy((infraRes.data ?? []) as EvidenceInfra[], 5),
    // planning_applications is 0 rows, every market, confirmed 2026-07-09 —
    // not queried at all rather than running a fetch that can never return
    // anything; every consumer (memo template) already hides this section
    // cleanly when empty.
    planning: {} as Record<string, EvidencePlanning[]>,
    signals:  groupBy((signalsRes.data ?? []) as EvidenceSignal[], 5),
  };

  // Persisted conviction-checklist ticks, keyed by market
  const checklistMap: Record<string, string[]> = {};
  for (const c of (checklistRes.data ?? []) as Array<{ municipality_id: string; checklist_key: string }>) {
    (checklistMap[c.municipality_id] ??= []).push(c.checklist_key);
  }

  return (
    <div className="min-h-screen bg-background">
      <DealBoard
        rows={rows}
        tier={tier}
        freshnessMap={freshnessMap}
        userEmail={user.email}
        opportunitiesMap={opportunitiesMap}
        statsMap={statsMap}
        prevScoreMap={prevScoreMap}
        evidence={evidence}
        checklistMap={checklistMap}
        zipMispricingMap={zipMispricingMap}
        initialViewMode={view === "all" ? "all" : "market"}
        allMarketsDeals={allMarketsDeals}
        allMarketsAggregate={allMarketsAggregate}
        allMarketsTotalFlagged={allMarketsTotalFlagged}
        allMarketsCoveredCount={allMarketsCoveredCount}
        allMarketsIsTeaser={allMarketsIsTeaser}
        allMarketsLockedCount={allMarketsLockedCount}
        allMarketsCanBrochure={allMarketsCanBrochure}
        allMarketsIsFreeTier={allMarketsLimit === 0}
        waitlistJoined={!!waitlistRes.data}
        userIsAuthed={!!user}
      />
    </div>
  );
}
