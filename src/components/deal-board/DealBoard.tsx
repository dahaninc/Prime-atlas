"use client";

/**
 * PRIME ATLAS — conviction terminal
 * Pre-screened pipeline · Preliminary underwrite · One-click Investment Analysis Report
 */

import { useState, useMemo, useEffect, useTransition } from "react";
import { type PF, computePF, sensitivityGrid, DILIGENCE_BY_COUNTRY, localizedPpsm } from "@/lib/proforma";
import { buildMarketReport, type DemandSignal } from "@/lib/marketReport";
import { fmt, symFor } from "@/lib/money";
import { toast } from "@/components/ui/Toaster";
import Link from "next/link";
import { createDealAlert, setChecklistItem } from "@/app/deal-board/actions";
import { AllMarketsExplorer, type ExplorerDeal } from "@/components/deal-board/AllMarketsExplorer";
import { WaitlistCta } from "@/components/deal-board/WaitlistCta";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DealRow {
  id: string;
  name: string;
  region: string;
  country: string;
  currency_code: string;
  opportunity_score: number;
  growth_score: number;
  infrastructure_score: number;
  development_score: number;
  liquidity_score: number;
  risk_score: number;
  population: number;
  retrieved_at: string | null;
  source_name: string;
  data_confidence: number;
  slug: string;
}

export interface LiveOpportunity {
  id: string;
  municipality_id: string;
  title: string;
  investment_thesis: string;
  category: string;
  opportunity_score: number;
  risk_level: string;
  source_name: string | null;
  source_url: string | null;
}

export interface MarketStats {
  municipality_id: string;
  sale_count: number;
  rent_count: number;
  median_price: number | null;   // minor units
  median_ppsqm: number | null;   // minor units per sqm
  underpriced_count: number;
}

export interface EvidenceInfra {
  municipality_id: string | null;
  project_name: string;
  type: string;
  budget: number;
  status: string;
  expected_completion: string | null;
}

export interface EvidencePlanning {
  municipality_id: string | null;
  project_type: string;
  status: string;
  application_date: string;
  description: string | null;
}

export interface EvidenceSignal {
  municipality_id: string | null;
  title: string;
  signal_type: string;
  opportunity_impact: number;
  detected_at: string;
}

interface DealBoardProps {
  rows: DealRow[];
  tier: "free" | "explorer" | "professional" | "institutional";
  freshnessMap: Record<string, string>;
  userEmail?: string;
  opportunitiesMap?: Record<string, LiveOpportunity[]>;
  statsMap?: Record<string, MarketStats>;
  prevScoreMap?: Record<string, number>;
  evidence?: {
    infra: Record<string, EvidenceInfra[]>;
    planning: Record<string, EvidencePlanning[]>;
    signals: Record<string, EvidenceSignal[]>;
  };
  checklistMap?: Record<string, string[]>;
  /** ZIP-comp mispricing count per market (src/lib/comps.ts basis) — row chips, same screen as the detail panel. */
  zipMispricingMap?: Record<string, number>;

  /**
   * All-Markets view (merged 2026-07-09 from the standalone /underpriced
   * page — see the surface-consolidation audit). Same screenByZipComps
   * engine, same pool, just relocated: search/filter/sort/multi-select and
   * the Deal Brochure export are unchanged, in AllMarketsExplorer.
   */
  initialViewMode?: "market" | "all";
  allMarketsDeals?: ExplorerDeal[];
  allMarketsAggregate?: { id: string; name: string; mispricingCount: number; coveredCount: number; totalCount: number }[];
  allMarketsTotalFlagged?: number;
  allMarketsCoveredCount?: number;
  allMarketsIsTeaser?: boolean;
  allMarketsLockedCount?: number;
  allMarketsCanBrochure?: boolean;
  /** free tier: aggregate counts + waitlist only, no real listing data — matches /underpriced's prior free-tier behavior exactly. */
  allMarketsIsFreeTier?: boolean;
  waitlistJoined?: boolean;
  userIsAuthed?: boolean;
}

// Country defaults for pro-forma
const COUNTRY_DEFAULTS: Record<string, { hardCost: number; avgPrice: number; sym: string }> = {
  "United Kingdom": { hardCost: 195, avgPrice: 350_000, sym: "£" },
  "United States":  { hardCost: 185, avgPrice: 415_000, sym: "$" },
};

// Conviction checklist — country-localized (US: zoning/FAR, tax abatements,
// energy compliance; UK: planning, S106/CIL, EPC). See src/lib/proforma.ts.
// Pro-forma engine (computePF, sensitivityGrid) also lives there so the
// terminal and the exported memo can never disagree.
//
// fmt/symFor live in src/lib/money.ts — a single source of truth so a
// review artifact can never hand-roll its own (and diverge from) the real
// formatter (see money.ts docstring for why this matters).

/**
 * Data-only per-deal line — deltas and calculations, never a verdict.
 * A missing metric is spelled out explicitly ("insufficient ... data"),
 * never silently dropped and never rendered as zero. A discount beyond the
 * implausible threshold reads as a likely data artifact, not a bargain —
 * same "too good to be true" logic as the display sanity clamp.
 */
function dealVerdictLine(d: {
  discountPct: number | null; grossYieldPct: number | null; yieldStatus: "ok" | "insufficient_data";
  unrankedReason?: "insufficient_data" | "implausible" | null; rentCompCount?: number;
  comps?: { address: string | null; price: number; ppsqm: number }[]; compBasisLabel?: string | null;
}): string {
  const discountPart = d.discountPct != null
    ? `${Math.abs(d.discountPct).toFixed(1)}% below ${d.comps?.length ?? "?"} ZIP-level comps${d.compBasisLabel ? ` (${d.compBasisLabel})` : ""}`
    : d.unrankedReason === "implausible"
      ? "discount: flagged as likely data error (beyond ±60% of ZIP comps)"
      : "discount: insufficient comparable data (needs ≥5 same-ZIP/type/bedroom comps)";
  // Basis is market-wide median rent across N real comps, not adjusted for
  // this specific listing's size/postcode — labelled explicitly rather
  // than implying a property-specific comp that doesn't exist yet.
  const yieldPart = d.yieldStatus === "ok" && d.grossYieldPct != null
    ? `${d.grossYieldPct.toFixed(1)}% gross yield (market rent basis, ${d.rentCompCount ?? "?"} comps)`
    : "yield: insufficient rent data";
  return `${discountPart} · ${yieldPart}`;
}

// ─── Score badge ──────────────────────────────────────────────────────────────

function Badge({ score }: { score: number }) {
  const cls = score >= 75
    ? "bg-emerald-950 text-emerald-400 border-emerald-800"
    : score >= 60
    ? "bg-amber-950 text-amber-400 border-amber-800"
    : "bg-red-950 text-red-400 border-red-900";
  return (
    <span className={`inline-flex items-center justify-center w-10 h-7 rounded border font-mono font-bold text-sm ${cls}`}>
      {score}
    </span>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FREE_LIMIT = 5;
const COUNTRY_TABS = [
  { label: "US", name: "United States",  sub: "United States"  },
  { label: "UK", name: "United Kingdom", sub: "United Kingdom" },
];

function gdvEst(row: DealRow): string {
  const def = COUNTRY_DEFAULTS[row.country];
  const sym = symFor(row.currency_code);
  const units = Math.round(20 + (row.opportunity_score / 100) * 30);
  const gdv   = units * (def?.avgPrice ?? 400_000);
  return fmt(gdv, sym);
}

type SortMode = "roi" | "zoning" | "demand";

// ─── Main component ───────────────────────────────────────────────────────────

export function DealBoard({
  rows, tier, freshnessMap, userEmail, opportunitiesMap = {},
  statsMap = {}, prevScoreMap = {},
  evidence = { infra: {}, planning: {}, signals: {} },
  checklistMap = {},
  zipMispricingMap = {},
  initialViewMode = "market",
  allMarketsDeals = [],
  allMarketsAggregate = [],
  allMarketsTotalFlagged = 0,
  allMarketsCoveredCount = 0,
  allMarketsIsTeaser = false,
  allMarketsLockedCount = 0,
  allMarketsCanBrochure = false,
  allMarketsIsFreeTier = false,
  waitlistJoined = false,
  userIsAuthed = true,
}: DealBoardProps) {
  const [viewModeState, setViewMode] = useState<"market" | "all">(initialViewMode);
  // Defense in depth: This Market is a real link (not a state-setter) for
  // anonymous visitors, so viewModeState can't reach "market" through the
  // UI — but this guarantees it even if initialViewMode were ever wrong.
  const viewMode = userIsAuthed ? viewModeState : "all";
  const isPro = tier !== "free";
  // Bulk/data export (the Investment Analysis Report) is Institutional-only —
  // see src/lib/entitlements.ts. Explorer/Professional keep the preliminary
  // underwrite but lose the export button itself.
  const isInstitutional = tier === "institutional";
  const [alertState, setAlertState] = useState<"idle" | "done" | "error">("idle");
  const [alertPending, startAlert] = useTransition();

  const [country,     setCountry]     = useState("United States");
  const [sortMode,    setSortMode]    = useState<SortMode>("roi");
  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  // Conviction-checklist ticks, keyed by market id — seeded from the DB,
  // persisted per-toggle via setChecklistItem (src/app/deal-board/actions.ts).
  const [checkedByMarket, setCheckedByMarket] = useState<Record<string, Set<string>>>(
    () => Object.fromEntries(Object.entries(checklistMap).map(([id, keys]) => [id, new Set(keys)]))
  );
  const checkedLayers = (selectedId && checkedByMarket[selectedId]) || new Set<string>();
  const [time, setTime] = useState("");

  // Screening rail
  const [query,      setQuery]      = useState("");
  const [minScore,   setMinScore]   = useState(0);           // conviction floor
  const [withOpps,   setWithOpps]   = useState(false);       // live opportunities only
  const [momentumUp, setMomentumUp] = useState(false);       // score rising vs last snapshot
  const [lowRisk,    setLowRisk]    = useState(false);       // risk score ≤ 40
  const hasActiveFilters = query !== "" || minScore > 0 || withOpps || momentumUp || lowRisk;
  function resetFilters() {
    setQuery(""); setMinScore(0); setWithOpps(false); setMomentumUp(false); setLowRisk(false);
  }

  // Live clock
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Filtered + sorted rows
  const sorted = useMemo(() => {
    const key: keyof DealRow = sortMode === "roi" ? "opportunity_score" : sortMode === "zoning" ? "development_score" : "growth_score";
    const q = query.trim().toLowerCase();
    return [...rows]
      .filter((r) => r.country === country)
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.region.toLowerCase().includes(q))
      .filter((r) => r.opportunity_score >= minScore)
      .filter((r) => !withOpps || (opportunitiesMap[r.id]?.length ?? 0) > 0)
      .filter((r) => !momentumUp || r.opportunity_score > (prevScoreMap[r.id] ?? r.opportunity_score))
      .filter((r) => !lowRisk || r.risk_score <= 40)
      .sort((a, b) => (b[key] as number) - (a[key] as number));
  }, [rows, country, sortMode, query, minScore, withOpps, momentumUp, lowRisk, opportunitiesMap, prevScoreMap]);

  const selectedRow = sorted.find((r) => r.id === selectedId) ?? null;
  useEffect(() => { setAlertState("idle"); }, [selectedId]);

  // Pro-forma state — reset when selected row changes
  const [pf, setPf] = useState<PF | null>(null);
  useEffect(() => {
    if (!selectedRow) { setPf(null); return; }
    const def = COUNTRY_DEFAULTS[selectedRow.country] ?? { hardCost: 185, avgPrice: 400_000 };
    setPf({
      units:          240,
      gsfPerUnit:     860,
      hardCostPerGsf: def.hardCost,
      landCost:       def.avgPrice * 30,
      rentPerUnitMo:  Math.round(def.avgPrice * 0.004),
      exitCapPct:     5,
      contingencyPct: 8,
      interestPct:    6.5,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset on row id change only, not on every selectedRow re-derivation
  }, [selectedRow?.id]);

  const pfOut = useMemo(() => pf ? computePF(pf) : null, [pf]);
  const sens  = useMemo(() => pf ? sensitivityGrid(pf) : null, [pf]);
  const diligence = DILIGENCE_BY_COUNTRY[country] ?? DILIGENCE_BY_COUNTRY["United Kingdom"];

  // Macro read — deterministic demand-signal narrative from the same engine
  // that powers /reports/market. No new AI calls: this is template-interpreted
  // arithmetic over data already on the page, so it's free and instant.
  const report = useMemo(() => {
    if (!selectedRow) return null;
    const st = statsMap[selectedRow.id];
    const prev = prevScoreMap[selectedRow.id];
    return buildMarketReport({
      muni: {
        id: selectedRow.id, name: selectedRow.name, region: selectedRow.region, country: selectedRow.country,
        currency_code: selectedRow.currency_code, population: selectedRow.population,
        opportunity_score: selectedRow.opportunity_score, growth_score: selectedRow.growth_score,
        risk_score: selectedRow.risk_score, development_score: selectedRow.development_score,
        infrastructure_score: selectedRow.infrastructure_score, liquidity_score: selectedRow.liquidity_score,
      },
      stats: st ? {
        sale_count: st.sale_count, rent_count: st.rent_count, median_price: st.median_price,
        median_ppsqm: st.median_ppsqm, underpriced_count: st.underpriced_count,
      } : null,
      history: prev !== undefined ? [
        { captured_on: "previous", opportunity_score: prev, growth_score: selectedRow.growth_score, risk_score: selectedRow.risk_score },
        { captured_on: "current",  opportunity_score: selectedRow.opportunity_score, growth_score: selectedRow.growth_score, risk_score: selectedRow.risk_score },
      ] : [],
    });
  }, [selectedRow, statsMap, prevScoreMap]);

  // Micro read — the market's own AI-written investment thesis (already
  // generated by /api/cron/generate-opportunities; just wasn't surfaced
  // here). Carries its source attribution too — some theses cite an
  // external source (source_url), others are self-sourced
  // ("Prime Atlas Intelligence", source_url null) — a hard factual claim
  // with no external citation must read as internal analysis, not fact.
  const microThesis = selectedRow && opportunitiesMap[selectedRow.id]?.[0]
    ? {
        text: opportunitiesMap[selectedRow.id][0].investment_thesis,
        sourceName: opportunitiesMap[selectedRow.id][0].source_name,
        sourceUrl: opportunitiesMap[selectedRow.id][0].source_url,
      }
    : null;

  // Real live deals for the selected market — fetched on selection, not
  // prefetched for every row. Distinct from "Live Opportunities" below,
  // which are curated theses, not property listings.
  //
  // `ranked` only ever contains deals with a computable, plausible
  // discountPct — a deal missing that metric, or with an implausibly large
  // one (likely a data artifact, not a bargain), goes in `unranked` instead
  // of being sorted to the bottom of the same list, which would visually
  // read as "worse" when it's actually just "unmeasured" or "flagged" (see
  // /api/deal-board/listings).
  interface DealPreview {
    id: string; address: string | null; price: number | null; currency_code: string;
    bedrooms: number | null; property_type: string | null; size_sqm: number | null;
    images: string[] | null; listing_type: string;
    discountPct: number | null; grossYieldPct: number | null;
    yieldStatus: "ok" | "insufficient_data"; rentCompCount: number;
    unrankedReason: "insufficient_data" | "implausible" | null;
    // ZIP-level comp evidence (src/lib/comps.ts) — the actual comparables
    // the discount was measured against, so the claim is auditable.
    comps: { address: string | null; price: number; ppsqm: number }[];
    compBasisLabel: string | null;
    compStatus: "mispriced" | "below_floor" | "implausible" | "insufficient_comps";
  }
  const [rankedDeals, setRankedDeals] = useState<DealPreview[] | null>(null);
  const [unrankedDeals, setUnrankedDeals] = useState<DealPreview[] | null>(null);
  const [liveDealsLoading, setLiveDealsLoading] = useState(false);
  // Same snapshot the /api/deal-board/listings response used to compute
  // ranked/unranked's discountPct — reused for Section 1 (pulse) and
  // Section 2 (macro narrative) of the memo instead of the page-load-time
  // statsMap, so every section of one exported report reads from one
  // query instant. A market_listing_stats row queried separately (e.g. at
  // page load) can disagree with this one if a scrape wrote to
  // `properties` in between — the view is unmaterialized and recomputes
  // live on every query.
  const [reportStats, setReportStats] = useState<{
    sale_count: number | null; rent_count: number | null;
    median_price: number | null; median_ppsqm: number | null;
    // ZIP-comp mispricing count (src/lib/comps.ts basis), NOT the blended
    // metro-median underpriced_count from market_listing_stats — Section 1
    // and Section 3 of the export must count the same thing.
    zip_mispricing_count: number | null;
    comp_covered: number | null; comp_total: number | null;
  } | null>(null);
  useEffect(() => {
    if (!selectedRow) { setRankedDeals(null); setUnrankedDeals(null); setReportStats(null); return; }
    setLiveDealsLoading(true);
    setRankedDeals(null);
    setUnrankedDeals(null);
    setReportStats(null);
    fetch(`/api/deal-board/listings?municipality_id=${selectedRow.id}`)
      .then((r) => (r.ok ? r.json() : { ranked: [], unranked: [] }))
      .then((d) => {
        setRankedDeals((d.ranked ?? []) as DealPreview[]);
        setUnrankedDeals((d.unranked ?? []) as DealPreview[]);
        setReportStats({
          sale_count: d.saleCount ?? null, rent_count: d.rentCount ?? null,
          median_price: d.medianPrice ?? null, median_ppsqm: d.marketMedianPpsqm ?? null,
          zip_mispricing_count: d.zipMispricingCount ?? null,
          comp_covered: d.compCoverage?.covered ?? null, comp_total: d.compCoverage?.total ?? null,
        });
      })
      .catch(() => { setRankedDeals([]); setUnrankedDeals([]); setReportStats(null); })
      .finally(() => setLiveDealsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch on row id change only, not on every selectedRow re-derivation
  }, [selectedRow?.id]);

  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const sym   = selectedRow ? symFor(selectedRow.currency_code) : "$";

  function toggleLayer(key: string) {
    if (!selectedRow) return;
    const marketId = selectedRow.id;
    const wasChecked = checkedLayers.has(key);
    setCheckedByMarket((prev) => {
      const next = new Set(prev[marketId] ?? []);
      wasChecked ? next.delete(key) : next.add(key);
      return { ...prev, [marketId]: next };
    });
    setChecklistItem(marketId, key, !wasChecked).then((res) => {
      if (!res.ok) {
        // Revert on write failure so the UI never claims a save that didn't happen
        setCheckedByMarket((prev) => {
          const next = new Set(prev[marketId] ?? []);
          wasChecked ? next.add(key) : next.delete(key);
          return { ...prev, [marketId]: next };
        });
        toast("Could not save checklist item — try again", "error");
      }
    });
  }

  const [memoPending, setMemoPending] = useState(false);

  async function generateMemo() {
    if (!selectedRow || memoPending) return;
    if (liveDealsLoading) {
      toast("Still loading this market's live data — try again in a moment", "error");
      return;
    }
    const s  = symFor(selectedRow.currency_code);
    // reportStats, not statsMap: the same market_listing_stats snapshot
    // /api/deal-board/listings already used to compute rankedDeals'
    // discountPct — every section of this export must read one snapshot,
    // not re-query the live view per section (see reportStats docstring
    // above).
    const st = reportStats;
    const prev = prevScoreMap[selectedRow.id];
    // Macro narrative recomputed from the same snapshot, not the on-screen
    // `report` memo (which is intentionally fast/page-load-fresh for
    // on-screen display and may reflect a different query instant).
    const memoReport = buildMarketReport({
      muni: {
        id: selectedRow.id, name: selectedRow.name, region: selectedRow.region, country: selectedRow.country,
        currency_code: selectedRow.currency_code, population: selectedRow.population,
        opportunity_score: selectedRow.opportunity_score, growth_score: selectedRow.growth_score,
        risk_score: selectedRow.risk_score, development_score: selectedRow.development_score,
        infrastructure_score: selectedRow.infrastructure_score, liquidity_score: selectedRow.liquidity_score,
      },
      stats: st ? {
        sale_count: st.sale_count ?? 0, rent_count: st.rent_count ?? 0, median_price: st.median_price,
        // ZIP-comp mispricing count — same basis as the ranked deals below,
        // never the blended metro-median underpriced_count.
        median_ppsqm: st.median_ppsqm, underpriced_count: st.zip_mispricing_count ?? 0,
      } : null,
      history: prev !== undefined ? [
        { captured_on: "previous", opportunity_score: prev, growth_score: selectedRow.growth_score, risk_score: selectedRow.risk_score },
        { captured_on: "current",  opportunity_score: selectedRow.opportunity_score, growth_score: selectedRow.growth_score, risk_score: selectedRow.risk_score },
      ] : [],
      mispricingBasis: "zip_comps",
    });

    const payload = {
      market: {
        name: selectedRow.name, region: selectedRow.region, country: selectedRow.country,
        slug: selectedRow.slug, population: selectedRow.population,
      },
      scores: {
        opportunity: selectedRow.opportunity_score, growth: selectedRow.growth_score,
        development: selectedRow.development_score, infrastructure: selectedRow.infrastructure_score,
        liquidity: selectedRow.liquidity_score, risk: selectedRow.risk_score,
      },
      momentum: prev !== undefined ? { previous: prev, current: selectedRow.opportunity_score } : null,
      pulse: st ? {
        sale_count: st.sale_count ?? 0, rent_count: st.rent_count ?? 0,
        median_price: st.median_price ? fmt(st.median_price / 100, s) : "n/a",
        median_ppsm_local: st.median_ppsqm ? localizedPpsm(Number(st.median_ppsqm), selectedRow.country, s) : "n/a",
        underpriced_count: st.zip_mispricing_count ?? 0,
        comp_coverage: st.comp_covered != null && st.comp_total != null
          ? { covered: st.comp_covered, total: st.comp_total }
          : null,
      } : null,
      narrative: {
        thesis: microThesis?.text ?? null,
        sourceName: microThesis?.sourceName ?? null,
        sourceUrl: microThesis?.sourceUrl ?? null,
        demandSignals: (memoReport?.demandSignals ?? []).map((sig) => ({
          label: sig.label, value: sig.value, reading: sig.reading, note: sig.note,
        })),
      },
      deals: [...(rankedDeals ?? []), ...(unrankedDeals ?? [])].slice(0, 9).map((d) => ({
        address: d.address ?? "Address on file",
        price: d.price != null ? fmt(d.price / 100, symFor(d.currency_code)) : "n/a",
        detail: `${d.bedrooms ? `${d.bedrooms} bed · ` : ""}${d.property_type ?? "Residential"}${d.size_sqm ? ` · ${Math.round(d.size_sqm)} sqm` : ""}`,
        discountPct: d.discountPct,
        grossYieldPct: d.yieldStatus === "ok" ? d.grossYieldPct : null,
        ranked: d.discountPct !== null,
        unrankedReason: d.unrankedReason,
        verdict: dealVerdictLine(d),
        compBasisLabel: d.compBasisLabel,
        // The evidence behind the discount — real formatters only (money.ts
        // / localizedPpsm), never hand-rolled division (see CLAUDE.md).
        comps: (d.comps ?? []).map((cp) => ({
          address: cp.address ?? "Address on file",
          price: fmt(cp.price / 100, symFor(d.currency_code)),
          ppsm: localizedPpsm(cp.ppsqm, selectedRow.country, symFor(d.currency_code)),
        })),
      })),
      // Deliberately no development pro-forma here — see icMemoTemplate.ts
      // module docstring. This is a market-screening memo; a ground-up
      // development scenario is a different investment strategy that
      // doesn't connect to the resale listings in Section 3.
      diligence: diligence.map((d) => ({ label: d.label, desc: d.desc })),
      evidence: {
        infra: (evidence.infra[selectedRow.id] ?? []).map((pr) =>
          `${pr.project_name} — ${pr.type} · ${pr.status} · budget ${fmt(pr.budget / 100, s)}${pr.expected_completion ? ` · ETA ${pr.expected_completion}` : ""}`),
        planning: (evidence.planning[selectedRow.id] ?? []).map((pl) =>
          `${pl.project_type} · ${pl.status} · ${pl.application_date}${pl.description ? ` — ${pl.description.slice(0, 80)}` : ""}`),
        signals: (evidence.signals[selectedRow.id] ?? []).map((sg) =>
          `${sg.title} — ${sg.signal_type} · impact ${sg.opportunity_impact}/100 · ${new Date(sg.detected_at).toLocaleDateString("en-GB")}`),
      },
      provenance: {
        source: selectedRow.source_name,
        confidence: `${Math.round(selectedRow.data_confidence * 100)}%`,
        retrieved: selectedRow.retrieved_at ?? "n/a",
        freshness: freshnessMap[selectedRow.country] ?? "n/a",
        listingBasis: st
          ? `Market baseline computed from ${(st.sale_count ?? 0) + (st.rent_count ?? 0)} live ${selectedRow.name} listings scraped ${today}`
          : "No live listing baseline for this market",
      },
      analyst: userEmail ?? "—",
    };

    setMemoPending(true);
    try {
      const res = await fetch("/api/export/ic-memo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 403) {
        toast("Investment Analysis Report export is an Institutional feature — upgrade to unlock", "error");
        return;
      }
      if (!res.ok) {
        toast("Memo export failed — try again", "error");
        return;
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `investment-analysis-${selectedRow.slug}.doc`;
      a.click(); URL.revokeObjectURL(url);
      toast("Investment Analysis Report exported — Word-editable .doc");
    } finally {
      setMemoPending(false);
    }
  }

  return (
    <div className="font-mono text-sm text-white min-h-screen bg-background">

      {/* ── Terminal header ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#1E2D40] bg-[#0D1221]">
        <div className="flex items-center gap-3">
          <span className="text-white font-bold tracking-widest text-base">PRIME ATLAS</span>
          <span className="text-[#4A6080] text-xs">conviction terminal · go/no-go in 10 minutes</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-400 text-xs">live</span>
          <span className="text-[#4A6080] text-xs ml-2 tabular-nums">{time}</span>
          {tier === "institutional" && (
            <Link href="/portfolio" className="ml-4 text-[#7BBFFF] hover:text-white text-xs transition-colors">portfolio →</Link>
          )}
          <Link href="/" className="ml-4 text-[#4A6080] hover:text-white text-xs transition-colors">← exit</Link>
        </div>
      </div>

      <div className="px-4 sm:px-6 py-4 space-y-4 max-w-[1400px] mx-auto">

        {/* ── View mode ── */}
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode("all")}
            className={`px-4 py-2 border transition-all text-left ${
              viewMode === "all"
                ? "bg-[#163559] border-[#1E4A7A] text-white"
                : "bg-[#111827] border-[#1E2D40] text-[#4A6080] hover:text-white hover:border-[#2A3D54]"
            }`}
          >
            <div className="font-bold text-xs leading-none">All Markets</div>
            <div className="text-[9px] mt-0.5 opacity-70">{allMarketsTotalFlagged} flagged deals</div>
          </button>
          {userIsAuthed ? (
            <button
              onClick={() => setViewMode("market")}
              className={`px-4 py-2 border transition-all text-left ${
                viewMode === "market"
                  ? "bg-[#163559] border-[#1E4A7A] text-white"
                  : "bg-[#111827] border-[#1E2D40] text-[#4A6080] hover:text-white hover:border-[#2A3D54]"
              }`}
            >
              <div className="font-bold text-xs leading-none">This Market</div>
              <div className="text-[9px] mt-0.5 opacity-70">Score, drill down, export</div>
            </button>
          ) : (
            <Link
              href="/auth/login?redirect=%2Fdeal-board"
              className="px-4 py-2 border border-dashed border-[#1E2D40] text-[#2A4060] hover:text-amber-400 hover:border-amber-800 transition-all text-left"
            >
              <div className="font-bold text-xs leading-none">This Market</div>
              <div className="text-[9px] mt-0.5 opacity-70">Sign in to screen individual markets →</div>
            </Link>
          )}
        </div>

        {viewMode === "market" && (
        <>
        {/* ── Country tabs ── */}
        <div className="flex gap-1">
          {COUNTRY_TABS.map((tab) => {
            const count = rows.filter((r) => r.country === tab.name).length;
            const active = country === tab.name;
            return (
              <button
                key={tab.name}
                onClick={() => { setCountry(tab.name); setSelectedId(null); }}
                className={`flex-1 sm:flex-none px-4 py-2.5 border transition-all text-center ${
                  active
                    ? "bg-[#163559] border-[#1E4A7A] text-white"
                    : "bg-[#111827] border-[#1E2D40] text-[#4A6080] hover:text-white hover:border-[#2A3D54]"
                }`}
              >
                <div className="font-bold text-sm leading-none">{tab.label}</div>
                <div className={`text-[10px] mt-0.5 ${active ? "text-[#8AABCC]" : "text-[#3A5068]"}`}>{tab.sub}</div>
                <div className={`text-[9px] mt-0.5 ${active ? "text-emerald-400" : "text-[#2A4060]"}`}>{count} mkts</div>
              </button>
            );
          })}
          {!isPro && (
            <Link
              href="/pricing"
              className="flex-none px-4 py-2.5 border border-dashed border-[#1E2D40] text-[#2A4060] hover:text-amber-400 hover:border-amber-800 transition-all text-center"
            >
              <div className="text-[10px]">Unlock</div>
              <div className="text-[9px] text-[#2A4060]">pro</div>
            </Link>
          )}
        </div>

        {/* ── Screening rail + deal board table ── */}
        <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-4 lg:items-start">
          <aside className="mb-4 lg:mb-0 lg:sticky lg:top-4">
            <div className="bg-[#0E1E32] border border-[#1E3050]">
              <div className="px-4 py-3 border-b border-[#1E2D40] flex items-baseline justify-between">
                <span className="text-[10px] font-bold tracking-[0.2em] text-[#4A7090] uppercase">Screen</span>
                {hasActiveFilters && (
                  <button onClick={resetFilters} className="text-[9px] text-[#4A6080] hover:text-white uppercase tracking-wider transition-colors">
                    Reset
                  </button>
                )}
              </div>
              <div className="p-4 space-y-5">
                {/* Market search */}
                <div>
                  <label className="block text-[9px] tracking-[0.15em] text-[#3A5068] uppercase mb-1.5">Market</label>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Name or region…"
                    className="w-full bg-[#0A1420] border border-[#1E2D40] px-3 py-2 text-xs text-white placeholder-[#3A5068] focus:outline-none focus:border-[#2A5C96] transition-colors"
                  />
                </div>

                {/* Conviction floor */}
                <div>
                  <label className="block text-[9px] tracking-[0.15em] text-[#3A5068] uppercase mb-1.5">Conviction floor</label>
                  <div className="grid grid-cols-4 gap-1">
                    {[0, 60, 70, 80].map((v) => (
                      <button
                        key={v}
                        onClick={() => setMinScore(v)}
                        className={`py-1.5 text-[10px] border transition-all ${
                          minScore === v
                            ? "bg-[#163559] border-[#1E4A7A] text-white"
                            : "border-[#1E2D40] text-[#4A6080] hover:text-white"
                        }`}
                      >
                        {v === 0 ? "All" : `≥${v}`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Signal toggles */}
                <div>
                  <label className="block text-[9px] tracking-[0.15em] text-[#3A5068] uppercase mb-1.5">Signals</label>
                  <div className="space-y-1">
                    {([
                      ["Live opportunities only", withOpps, () => setWithOpps((v) => !v)],
                      ["Momentum rising ▲", momentumUp, () => setMomentumUp((v) => !v)],
                      ["Risk score ≤ 40", lowRisk, () => setLowRisk((v) => !v)],
                    ] as [string, boolean, () => void][]).map(([label, on, toggle]) => (
                      <button
                        key={label}
                        onClick={toggle}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] border transition-all text-left ${
                          on
                            ? "bg-[#0F2A44] border-[#1E4A7A] text-white"
                            : "border-[#1A2535] text-[#4A6080] hover:text-white"
                        }`}
                      >
                        <span className={`text-[10px] ${on ? "text-emerald-400" : "text-[#3A5068]"}`}>{on ? "◉" : "○"}</span>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-[9px] text-[#2E4560] border-t border-[#1A2535] pt-3">
                  <span className="text-[#4A7090] font-bold">{sorted.length}</span> of{" "}
                  {rows.filter((r) => r.country === country).length} markets pass the screen
                </div>
              </div>
            </div>
          </aside>

          {/* ── Deal board table ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-white">
              Pre-screened pipeline
              <span className="text-[#4A6080] font-normal ml-2">· {sorted.length} markets · click row to underwrite</span>
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[#3A5068] mr-1">sort</span>
              {(["roi", "zoning", "demand"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setSortMode(m)}
                  className={`px-2.5 py-1 text-[10px] uppercase tracking-wider border transition-all ${
                    sortMode === m
                      ? "bg-[#163559] border-[#1E4A7A] text-white"
                      : "border-[#1E2D40] text-[#4A6080] hover:text-white"
                  }`}
                >
                  {m === "roi" ? "ROI" : m === "zoning" ? "Zoning" : "Demand"}
                </button>
              ))}
            </div>
          </div>

          <div className="border border-[#1E2D40]">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_5rem_5rem_5rem_6rem] gap-2 px-4 py-2 bg-[#0D1624] border-b border-[#1E2D40]">
              <span className="text-[10px] tracking-[0.15em] text-[#3A5068] uppercase">Opportunity</span>
              <span className="text-[10px] tracking-[0.15em] text-[#3A5068] uppercase text-center">ROI</span>
              <span className="text-[10px] tracking-[0.15em] text-[#3A5068] uppercase text-center">Zone</span>
              <span className="text-[10px] tracking-[0.15em] text-[#3A5068] uppercase text-center">Dem</span>
              <span className="text-[10px] tracking-[0.15em] text-[#3A5068] uppercase text-right">GDV est.*</span>
            </div>

            {/* Empty screen state */}
            {sorted.length === 0 && (
              <div className="px-4 py-10 text-center">
                <div className="text-xs text-[#4A6080] mb-2">No markets pass the current screen.</div>
                <button onClick={resetFilters} className="text-[10px] text-[#7BBFFF] hover:text-white uppercase tracking-wider transition-colors">
                  Reset filters
                </button>
              </div>
            )}

            {/* Rows */}
            {sorted.map((row, i) => {
              const locked   = !isPro && i >= FREE_LIMIT;
              const selected = selectedId === row.id;
              const oppCount = (opportunitiesMap[row.id] ?? []).length;
              if (locked) {
                return (
                  <div
                    key={row.id}
                    className="grid grid-cols-[1fr_5rem_5rem_5rem_6rem] gap-2 px-4 py-3 border-b border-[#1A2535] opacity-30 select-none"
                  >
                    <div>
                      <div className="text-sm font-semibold leading-snug">████████████</div>
                      <div className="text-[11px] text-[#4A6080] mt-0.5">████████</div>
                    </div>
                    <div className="flex items-center justify-center"><span className="text-[#1A2535]">██</span></div>
                    <div className="flex items-center justify-center"><span className="text-[#1A2535]">██</span></div>
                    <div className="flex items-center justify-center"><span className="text-[#1A2535]">██</span></div>
                    <div className="flex items-center justify-end text-sm font-bold">——</div>
                  </div>
                );
              }
              return (
                <div key={row.id} className="border-b border-[#1A2535]">
                  {/* Main clickable row — click opens detail panel */}
                  <div
                    onClick={() => setSelectedId(selected ? null : row.id)}
                    className={`grid grid-cols-[1fr_5rem_5rem_5rem_7rem] gap-2 px-4 py-3 transition-colors cursor-pointer ${
                      selected ? "bg-[#0D2040]" : "hover:bg-[#111827]"
                    }`}
                  >
                    <div>
                      <div className="text-sm font-semibold leading-snug text-white flex items-center gap-2">
                        {row.name}
                        {oppCount > 0 && (
                          <span className="text-[9px] text-emerald-400 border border-emerald-800 rounded px-1 py-0.5 font-mono">
                            {oppCount} live
                          </span>
                        )}
                        {(zipMispricingMap[row.id] ?? 0) > 0 && (
                          <span className="text-[9px] text-amber-300 border border-amber-800 bg-amber-950/40 rounded px-1 py-0.5 font-mono" title="Listings ≥15% below their own ZIP-level comparables (min 5 comps)">
                            {zipMispricingMap[row.id]} underpriced
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#4A6080] mt-0.5">
                        {row.region}, {row.country}
                        {statsMap[row.id] && (
                          <span className="text-[#3A6080]">
                            {" "}· {statsMap[row.id].sale_count + statsMap[row.id].rent_count} live listings
                            {statsMap[row.id].median_price ? ` · median ${fmt(statsMap[row.id].median_price! / 100, symFor(row.currency_code))}` : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <Badge score={row.opportunity_score} />
                      {(() => {
                        const prev = prevScoreMap[row.id];
                        if (prev === undefined || prev === row.opportunity_score) return null;
                        const up = row.opportunity_score > prev;
                        return (
                          <span className={`text-[10px] font-bold ${up ? "text-emerald-400" : "text-red-400"}`} title={`was ${prev}`}>
                            {up ? "▲" : "▼"}
                          </span>
                        );
                      })()}
                    </div>
                    <div className="flex items-center justify-center"><Badge score={row.development_score} /></div>
                    <div className="flex items-center justify-center"><Badge score={row.growth_score} /></div>
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-sm font-bold text-white">{gdvEst(row)}</span>
                      <Link
                        href={`/opportunities/${row.slug}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[10px] text-[#4A7090] hover:text-emerald-400 transition-colors"
                        title="View live opportunities"
                      >
                        ↗
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Upgrade wall */}
            {!isPro && sorted.length > FREE_LIMIT && (
              <div className="px-4 py-5 text-center bg-[#0D1624]">
                <div className="text-[#4A6080] text-xs mb-3">
                  {sorted.length - FREE_LIMIT} markets locked — Pro unlocks all rows, evidence layers, and live pro-forma
                </div>
                <Link href="/pricing" className="inline-block bg-[#163559] border border-[#1E4A7A] text-white text-xs px-5 py-2 hover:bg-[#1A4070] transition-colors">
                  Upgrade to Pro →
                </Link>
              </div>
            )}
          </div>
          <div className="text-[9px] text-[#2E4560] mt-1 px-1">
            * GDV estimate based on notional 20–50 unit scheme × country median sale price. Illustrative only.
          </div>
        </div>
        </div>

        {/* ── Selected row detail ── */}
        {selectedRow && isPro && (
          <div className="border border-[#1E3050] bg-[#0D1828]">

            {/* Panel header */}
            <div className="flex items-start justify-between px-5 py-4 border-b border-[#1E2D40]">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[9px] tracking-widest text-[#4A6080] uppercase">Preliminary underwrite</span>
                </div>
                <div className="text-lg font-bold text-white">{selectedRow.name}</div>
                <div className="text-xs text-[#4A6080]">
                  {selectedRow.region} · {selectedRow.country} · Prime Atlas Intelligence
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <Badge score={selectedRow.opportunity_score} />
                  <div className="text-[9px] text-[#3A5068] mt-1">ROI</div>
                </div>
                <div className="text-center">
                  <Badge score={selectedRow.development_score} />
                  <div className="text-[9px] text-[#3A5068] mt-1">ZONE</div>
                </div>
                <div className="text-center">
                  <Badge score={selectedRow.growth_score} />
                  <div className="text-[9px] text-[#3A5068] mt-1">DEM</div>
                </div>
                <Link
                  href={`/opportunities/${selectedRow.slug}`}
                  className="ml-2 px-3 py-1.5 border border-[#1E4A7A] bg-[#163559] text-[#7BBFFF] hover:text-white text-[10px] tracking-wider transition-colors whitespace-nowrap"
                >
                  View deals ↗
                </Link>
                <button
                  onClick={() => setSelectedId(null)}
                  className="text-[#3A5068] hover:text-white text-lg leading-none"
                >×</button>
              </div>
            </div>

            {/* Macro & Micro Analysis */}
            {(microThesis || (report && report.demandSignals.length > 0)) && (
              <div className="px-5 pt-4 pb-4 border-b border-[#1E2D40]">
                <div className="text-[10px] tracking-[0.15em] text-[#4A6080] uppercase mb-3">Macro &amp; Micro Analysis</div>

                {microThesis && (
                  <div className="mb-4">
                    <p className="text-xs text-[#8AABCC] leading-relaxed">{microThesis.text}</p>
                    <p className="text-[9px] text-[#3A5068] mt-1.5">
                      Source: {microThesis.sourceName ?? "unknown"}
                      {microThesis.sourceUrl
                        ? <> — <a href={microThesis.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[#4A7090] hover:text-emerald-400 transition-colors">{microThesis.sourceUrl}</a></>
                        : " (internal analysis, not an external citation)"}
                    </p>
                  </div>
                )}

                {report && report.demandSignals.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {report.demandSignals.map((sig: DemandSignal) => (
                      <div
                        key={sig.label}
                        className={`px-3 py-2.5 border ${
                          sig.reading === "strong" ? "border-emerald-900 bg-emerald-950/20"
                          : sig.reading === "soft" ? "border-red-900 bg-red-950/20"
                          : "border-[#1E2D40] bg-[#0D1624]"
                        }`}
                      >
                        <div className="flex items-baseline justify-between gap-2 mb-1">
                          <span className="text-[10px] font-semibold text-white">{sig.label}</span>
                          <span className={`text-[10px] font-mono ${
                            sig.reading === "strong" ? "text-emerald-400" : sig.reading === "soft" ? "text-red-400" : "text-amber-300"
                          }`}>{sig.value}</span>
                        </div>
                        <p className="text-[10px] text-[#4A6080] leading-relaxed">{sig.note}</p>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[9px] text-[#2E4560] mt-2">
                  Demand-signal narrative is a deterministic reading of live market data — not AI-generated, not investment advice.
                </p>
              </div>
            )}

            {/* Live Opportunities */}
            {(() => {
              const opps = opportunitiesMap[selectedRow.id] ?? [];
              return opps.length > 0 ? (
                <div className="px-5 pt-4 pb-4 border-b border-[#1E2D40]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] tracking-[0.15em] text-[#4A6080] uppercase">
                      Live Opportunities <span className="text-emerald-400">· {opps.length}</span>
                    </span>
                    <Link
                      href={`/opportunities/${selectedRow.slug}`}
                      className="text-[10px] text-[#4A7090] hover:text-emerald-400 transition-colors"
                    >
                      View all ↗
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {opps.slice(0, 3).map((opp) => (
                      <div key={opp.id} className="bg-[#0D1624] border border-[#1E2D40] px-3 py-2.5 flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-white leading-snug mb-1">{opp.title}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[9px] border border-[#2A3D54] rounded px-1.5 py-0.5 text-[#4A6080]">{opp.category}</span>
                            <span className={`text-[9px] font-medium ${
                              opp.risk_level === "low" ? "text-emerald-400" :
                              opp.risk_level === "medium" ? "text-amber-400" : "text-red-400"
                            }`}>{opp.risk_level} risk</span>
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <Badge score={opp.opportunity_score} />
                        </div>
                      </div>
                    ))}
                  </div>
                  {opps.length > 3 && (
                    <Link
                      href={`/opportunities/${selectedRow.slug}`}
                      className="mt-2 block text-center text-[10px] text-[#3A5068] hover:text-emerald-400 transition-colors py-1"
                    >
                      +{opps.length - 3} more opportunities →
                    </Link>
                  )}
                </div>
              ) : (
                <div className="px-5 py-3 border-b border-[#1E2D40]">
                  <Link
                    href={`/opportunities/${selectedRow.slug}`}
                    className="block text-center py-3 border border-dashed border-[#1E3050] text-[10px] text-[#4A6080] hover:text-emerald-400 hover:border-emerald-900 transition-colors"
                  >
                    View opportunities & market data for {selectedRow.name} ↗
                  </Link>
                </div>
              );
            })()}

            {/* Live market pulse — real scraped listings for this market */}
            {(() => {
              const st = statsMap[selectedRow.id];
              if (!st) return null;
              const s2 = symFor(selectedRow.currency_code);
              return (
                <div className="px-5 pt-4 pb-4 border-b border-[#1E2D40]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] tracking-[0.15em] text-[#4A6080] uppercase">
                      Live market pulse <span className="text-emerald-400">· scraped today</span>
                    </span>
                    <Link href={`/market-feed?q=${encodeURIComponent(selectedRow.name)}`}
                          className="text-[10px] text-[#4A7090] hover:text-emerald-400 transition-colors">
                      Open live deals ↗
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-[#111827] border border-[#1E2D40] px-4 py-3">
                      <div className="text-[10px] text-[#4A6080] mb-1">Active listings</div>
                      <div className="text-lg font-bold text-white">{st.sale_count + st.rent_count}
                        <span className="text-[10px] text-[#4A6080] ml-1">({st.sale_count} sale)</span>
                      </div>
                    </div>
                    <div className="bg-[#111827] border border-[#1E2D40] px-4 py-3">
                      <div className="text-[10px] text-[#4A6080] mb-1">Median asking</div>
                      <div className="text-lg font-bold text-white">{st.median_price ? fmt(st.median_price / 100, s2) : "—"}</div>
                    </div>
                    <div className="bg-[#111827] border border-[#1E2D40] px-4 py-3">
                      <div className="text-[10px] text-[#4A6080] mb-1">
                        Median {selectedRow.country === "United States" ? `${s2}/SF` : `${s2}/sqm`}
                      </div>
                      <div className="text-lg font-bold text-white">
                        {st.median_ppsqm ? localizedPpsm(Number(st.median_ppsqm), selectedRow.country, s2).replace(/\/(SF|sqm)$/, "") : "—"}
                      </div>
                    </div>
                    <div className="bg-[#111827] border border-amber-900/50 px-4 py-3">
                      <div className="text-[10px] text-amber-500/80 mb-1">≥15% below ZIP comps</div>
                      {/* ZIP-comp basis (same screen as the ranked deals below), not the
                          blended-median view count — "—" while the screen is loading. */}
                      <div className="text-lg font-bold text-amber-300">{reportStats?.zip_mispricing_count ?? "—"}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {st.median_price && (
                      <button
                        onClick={() => setPf((prev) => prev ? {
                          ...prev,
                          landCost:      Math.round((st.median_price! / 100) * 30),
                          rentPerUnitMo: Math.round((st.median_price! / 100) * 0.004),
                        } : prev)}
                        className="px-3 py-1.5 border border-emerald-900 bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900/40 text-[10px] tracking-wider transition-colors"
                      >
                        ⚡ Seed underwrite from live median ({fmt(st.median_price / 100, s2)} × {st.sale_count} listings)
                      </button>
                    )}
                    <button
                      disabled={alertPending || alertState === "done"}
                      onClick={() => startAlert(async () => {
                        const res = await createDealAlert(selectedRow.id);
                        setAlertState(res.ok ? "done" : "error");
                      })}
                      className={`px-3 py-1.5 border text-[10px] tracking-wider transition-colors ${
                        alertState === "done"
                          ? "border-emerald-900 text-emerald-400 bg-emerald-950/40"
                          : "border-[#1E4A7A] bg-[#163559] text-[#7BBFFF] hover:text-white"
                      }`}
                    >
                      {alertState === "done" ? "✓ Alert active — email on underpriced deals"
                        : alertState === "error" ? "Could not create alert — retry"
                        : alertPending ? "Creating…"
                        : `🔔 Alert me: new ${selectedRow.name} deals ≥15% below ZIP comps`}
                    </button>
                    <Link
                      href={`/capital?market=${selectedRow.slug}`}
                      className="px-3 py-1.5 border border-[#2A3D54] text-[#6A8098] hover:text-white text-[10px] tracking-wider transition-colors"
                    >
                      Raise capital for this deal →
                    </Link>
                  </div>
                </div>
              );
            })()}

            {/* Live deals — the market's real mispricing pool (≥15% below comp
                basis, matching Section 1's headline count), not an arbitrary
                or recency-ordered sample. */}
            {(liveDealsLoading || (rankedDeals && rankedDeals.length > 0) || (unrankedDeals && unrankedDeals.length > 0)) && (
              <div className="px-5 pt-4 pb-4 border-b border-[#1E2D40]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] tracking-[0.15em] text-[#4A6080] uppercase">
                    Live deals {rankedDeals && (
                      <span className="text-emerald-400">
                        · top {rankedDeals.length}{(reportStats?.zip_mispricing_count ?? 0) > 0
                          ? ` of ${reportStats!.zip_mispricing_count} mispriced vs ZIP comps` : ""}
                      </span>
                    )}
                  </span>
                  <Link href={`/market-feed?q=${encodeURIComponent(selectedRow.name)}`}
                        className="text-[10px] text-[#4A7090] hover:text-emerald-400 transition-colors">
                    View all in market feed ↗
                  </Link>
                </div>
                <p className="text-[9px] text-[#2E4560] mb-3">
                  Ranked by discount vs. each listing&apos;s own ZIP-level comparables (same ZIP, property type, and bedroom
                  count; minimum 5 comps) — never a blended metro median, and never padded with weaker listings to hit a
                  round number. ≥15% and ≤60% below basis only, the same band the mispricing count above uses. A listing
                  without enough true comparables shows &quot;insufficient comparable data&quot; rather than a discount
                  measured against the wrong basis. Gross yield uses this market&apos;s real rent comps only; deals missing
                  either metric are listed separately, not ranked against fuller data.
                </p>

                {liveDealsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-16 bg-[#111827] border border-[#1E2D40] animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <>
                    {(rankedDeals ?? []).length > 0 && (
                      <div className="space-y-2">
                        {(rankedDeals ?? []).map((d, i) => (
                          <Link
                            key={d.id}
                            href={`/market-feed/${d.id}`}
                            className="flex items-center gap-3 border border-[#1E2D40] bg-[#111827] hover:border-[#2A5C96] transition-colors px-3 py-2.5"
                          >
                            <span className="text-[10px] font-mono text-[#3A5068] w-4 shrink-0">#{i + 1}</span>
                            <div className="w-12 h-12 shrink-0 bg-[#0D1624] overflow-hidden">
                              {d.images?.[0] && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={d.images[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="text-xs font-bold text-white">{d.price != null ? fmt(d.price / 100, symFor(d.currency_code)) : "—"}</span>
                                <span className="text-[9px] text-[#4A6080] font-mono shrink-0">
                                  {d.discountPct != null ? `${d.discountPct >= 0 ? "−" : "+"}${Math.abs(d.discountPct).toFixed(1)}%` : ""}
                                  {d.yieldStatus === "ok" && d.grossYieldPct != null ? ` · ${d.grossYieldPct.toFixed(1)}% yield` : ""}
                                </span>
                              </div>
                              <div className="text-[9px] text-[#4A6080] truncate mt-0.5">{d.address ?? "Address on file"}</div>
                              <div className="text-[9px] text-[#3A5068] mt-0.5">{dealVerdictLine(d)}</div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}

                    {(unrankedDeals ?? []).length > 0 && (
                      <div className="mt-3">
                        <div className="text-[9px] text-[#4A6080] uppercase tracking-wider mb-2">
                          Additional deals — not ranked (see reason per deal below)
                        </div>
                        <div className="space-y-2 opacity-70">
                          {(unrankedDeals ?? []).map((d) => (
                            <Link
                              key={d.id}
                              href={`/market-feed/${d.id}`}
                              className="flex items-center gap-3 border border-[#1E2D40] bg-[#0D1624] hover:border-[#2A3D54] transition-colors px-3 py-2.5"
                            >
                              <div className="w-12 h-12 shrink-0 bg-[#111827] overflow-hidden">
                                {d.images?.[0] && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={d.images[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-white">{d.price != null ? fmt(d.price / 100, symFor(d.currency_code)) : "—"}</div>
                                <div className="text-[9px] text-[#4A6080] truncate mt-0.5">{d.address ?? "Address on file"}</div>
                                <div className="text-[9px] text-[#3A5068] mt-0.5">{dealVerdictLine(d)}</div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Conviction checklist */}
            <div className="px-5 pt-4 pb-3 border-b border-[#1E2D40]">
              <div className="text-[10px] tracking-[0.15em] text-[#4A6080] uppercase mb-1">Conviction Checklist</div>
              <div className="text-[10px] text-[#2E4560] mb-3">Tick each dimension you have reviewed — checked layers are included in the Investment Analysis Report export</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {diligence.map((layer) => {
                  const checked = checkedLayers.has(layer.key);
                  return (
                    <button
                      key={layer.key}
                      onClick={() => toggleLayer(layer.key)}
                      className={`flex items-start gap-3 px-3 py-2.5 border text-left transition-all ${
                        checked
                          ? "border-[#1E4A7A] bg-[#0E2040]"
                          : "border-[#1E2D40] bg-[#0D1624] hover:border-[#2A3D54]"
                      }`}
                    >
                      <span className={`mt-0.5 text-xs flex-shrink-0 ${checked ? "text-emerald-400" : "text-[#2E4560]"}`}>
                        {checked ? "☑" : "☐"}
                      </span>
                      <div>
                        <div className={`text-xs font-semibold ${checked ? "text-white" : "text-[#6A8098]"}`}>
                          {layer.label}
                        </div>
                        <div className="text-[10px] text-[#3A5068] mt-0.5">{layer.desc}</div>
                        <div className="text-[9px] text-[#2E4560] mt-0.5">
                          Prime Atlas Intelligence · {
                            selectedRow.retrieved_at
                              ? new Date(selectedRow.retrieved_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                              : today
                          }
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Investment Analysis Report — primary CTA, Institutional-only export.
                Market-screening data only (macro read + live deals + diligence
                roadmap + provenance) — not gated on the preliminary underwrite
                below, which is a separate, optional on-screen tool and is
                deliberately not part of the exported document. */}
            <div className="px-5 pt-4 pb-5 border-b border-[#1E2D40]">
              {isInstitutional ? (
                <button
                  onClick={generateMemo}
                  disabled={memoPending}
                  className="w-full border border-[#1E4A7A] bg-[#0E1E32] hover:bg-[#12294A] hover:border-[#2A5C96] transition-all disabled:opacity-60 text-left"
                >
                  <div className="px-5 py-4 flex items-center justify-between gap-6">
                    <div>
                      <div className="text-[9px] tracking-[0.3em] text-[#4A7090] uppercase mb-1">
                        Investment Analysis
                      </div>
                      <div className="text-sm font-bold text-white tracking-tight">
                        {memoPending ? "Preparing report…" : "Prepare Investment Analysis Report"}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[9px] text-[#4A6080] uppercase tracking-[0.15em]">Word · .doc</div>
                      <div className={`text-[10px] font-mono mt-0.5 ${checkedLayers.size > 0 ? "text-emerald-400" : "text-[#3A5068]"}`}>
                        {checkedLayers.size > 0
                          ? `${checkedLayers.size} conviction dimension${checkedLayers.size > 1 ? "s" : ""}`
                          : "base report"}
                      </div>
                    </div>
                  </div>
                </button>
              ) : (
                <Link
                  href="/pricing"
                  className="w-full border border-[#1E2D40] bg-[#0D1624] hover:border-[#2A5C96] transition-all text-left block"
                >
                  <div className="px-5 py-4 flex items-center justify-between gap-6">
                    <div>
                      <div className="text-[9px] tracking-[0.3em] text-[#4A7090] uppercase mb-1">
                        Investment Analysis
                      </div>
                      <div className="text-sm font-bold text-white tracking-tight">
                        Investment Analysis Report export — Institutional feature
                      </div>
                      <div className="text-[10px] text-[#4A6080] mt-1">
                        Upgrade to export this market as a Word-editable report →
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[9px] text-[#4A6080] uppercase tracking-[0.15em]">Word · .doc</div>
                    </div>
                  </div>
                </Link>
              )}
              <div className="text-[9px] text-[#2E4560] mt-2 text-center">
                {checkedLayers.size > 0
                  ? "Compiled from live market data, screened deals, and selected conviction dimensions — with scores and sources."
                  : "Select conviction checklist dimensions above to annex them to the report."}
              </div>

              {/* Link to full city deal page */}
              <Link
                href={`/opportunities/${selectedRow.slug}`}
                className="mt-3 w-full py-2.5 border border-[#1E2D40] text-[#4A7090] hover:text-white hover:border-[#1E3A60] text-[11px] font-semibold transition-all flex items-center justify-center gap-2"
              >
                View all opportunities, signals &amp; planning data for {selectedRow.name} ↗
              </Link>
            </div>

            {/* Preliminary underwrite — a separate, optional on-screen ground-up
                development calculator. Deliberately NOT part of the Investment
                Analysis Report export above: it's a different investment
                strategy (build-new) from the resale deals screened in this
                market, using generic default assumptions, not the specific
                deals above — including it in the export read as if it were
                their financial model, which it isn't (2026-07-08 rebuild). */}
            {pf && pfOut && (
              <div className="px-5 pt-4 pb-5">
                <div className="text-[10px] tracking-[0.15em] text-[#4A6080] uppercase mb-1">
                  Preliminary Underwrite <span className="text-[#3A5068] normal-case">· on-screen only, not included in the export</span>
                </div>
                <div className="text-[10px] text-[#2E4560] mb-3 normal-case tracking-normal">
                  Editable DCF · recalculates live · opex held at 32% of gross income
                </div>

                {/* Inputs grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
                  {[
                    { label: "Units",              key: "units",           step: 10,    prefix: "",  suffix: "" },
                    { label: "GSF / unit",         key: "gsfPerUnit",      step: 50,    prefix: "",  suffix: "" },
                    { label: `Hard cost / GSF (${sym})`, key: "hardCostPerGsf", step: 5, prefix: "", suffix: "" },
                    { label: `Land cost (${sym})`, key: "landCost",        step: 100000,prefix: "",  suffix: "" },
                    { label: `Rent / unit / mo (${sym})`, key: "rentPerUnitMo", step: 50, prefix: "", suffix: "" },
                    { label: "Exit cap %",         key: "exitCapPct",      step: 0.25,  prefix: "",  suffix: "" },
                    { label: "Contingency %",      key: "contingencyPct",  step: 1,     prefix: "",  suffix: "" },
                    { label: "Financing % (APR)",  key: "interestPct",     step: 0.25,  prefix: "",  suffix: "" },
                  ].map(({ label, key, step }) => (
                    <div key={key}>
                      <label className="block text-[10px] text-[#4A6080] mb-1">{label}</label>
                      <input
                        type="number"
                        step={step}
                        value={pf[key as keyof PF]}
                        onChange={(e) => setPf((p) => p ? { ...p, [key]: Number(e.target.value) } : p)}
                        className="w-full bg-[#0D1624] border border-[#1E2D40] text-white text-sm px-3 py-2 focus:outline-none focus:border-[#1E4A7A] font-mono"
                      />
                    </div>
                  ))}
                </div>

                {/* Output row */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: "Total dev cost",    value: fmt(pfOut.totalDevCost, sym), muted: true  },
                    { label: "Stabilised NOI",    value: fmt(pfOut.annualNOI, sym),    muted: true  },
                    { label: "Value at exit cap", value: fmt(pfOut.exitValue, sym),    muted: true  },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-[#111827] border border-[#1E2D40] px-4 py-3">
                      <div className="text-[10px] text-[#4A6080] mb-1">{label}</div>
                      <div className="text-lg font-bold text-white">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="bg-[#111827] border border-[#1E2D40] px-4 py-3">
                    <div className="text-[10px] text-[#4A6080] mb-1">Yield on cost</div>
                    <div className="text-lg font-bold text-white">{pfOut.yieldOnCost.toFixed(1)}<span className="text-[#4A6080] text-sm">%</span></div>
                  </div>
                  <div className="bg-[#111827] border border-[#1E2D40] px-4 py-3">
                    <div className="text-[10px] text-[#4A6080] mb-1">Profit</div>
                    <div className={`text-lg font-bold ${pfOut.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {fmt(pfOut.profit, sym)}
                    </div>
                  </div>
                  <div className="bg-[#111827] border border-[#1E2D40] px-4 py-3">
                    <div className="text-[10px] text-[#4A6080] mb-1">Margin on cost</div>
                    <div className={`text-lg font-bold ${pfOut.marginOnCost >= 15 ? "text-emerald-400" : pfOut.marginOnCost >= 0 ? "text-amber-400" : "text-red-400"}`}>
                      {pfOut.marginOnCost.toFixed(1)}<span className="text-[#4A6080] text-sm">%</span>
                    </div>
                  </div>
                </div>

                {/* Sensitivity matrix — financing rate × exit cap */}
                {sens && (
                  <div className="mb-5">
                    <div className="text-[10px] tracking-[0.15em] text-[#4A6080] uppercase mb-1">
                      Sensitivity — dev margin on GDV
                    </div>
                    <div className="text-[10px] text-[#2E4560] mb-2">
                      financing rate ±1% × exit cap ±0.5% · committee screen ≥ 18%
                    </div>
                    <table className="w-full border-collapse font-mono text-xs">
                      <thead>
                        <tr>
                          <th className="border border-[#1E2D40] bg-[#0D1624] px-2 py-1.5 text-[#4A6080] text-[10px] font-normal text-left">rate \ cap</th>
                          {sens[0].map((c) => (
                            <th key={c.capPct} className="border border-[#1E2D40] bg-[#0D1624] px-2 py-1.5 text-[#4A6080] text-[10px] font-normal text-right">
                              {c.capPct.toFixed(2)}%
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sens.map((row) => (
                          <tr key={row[0].ratePct}>
                            <td className="border border-[#1E2D40] px-2 py-1.5 text-[#4A6080] text-[10px]">{row[0].ratePct.toFixed(1)}%</td>
                            {row.map((c) => (
                              <td
                                key={`${c.ratePct}-${c.capPct}`}
                                className={`border px-2 py-1.5 text-right tabular-nums ${
                                  c.isBase
                                    ? "border-emerald-800 bg-emerald-950/40 text-emerald-300 font-bold"
                                    : c.marginOnGDV >= 18
                                    ? "border-[#1E2D40] text-emerald-400"
                                    : c.marginOnGDV >= 0
                                    ? "border-[#1E2D40] text-amber-300"
                                    : "border-[#1E2D40] text-red-400"
                                }`}
                              >
                                {c.marginOnGDV.toFixed(1)}%
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Free-tier upgrade wall */}
        {selectedRow && !isPro && (
          <div className="border border-[#1E2D40] bg-[#0D1624] px-5 py-5 text-center">
            <div className="text-sm font-semibold text-white mb-1">Preliminary underwrite &amp; Investment Analysis Report are Pro features</div>
            <div className="text-xs text-[#4A6080] mb-4">
              Pro unlocks all markets, the conviction checklist, and editable preliminary underwrite (yield-on-cost · NOI · margin).
              Institutional adds one-click Investment Analysis Report export.
            </div>
            <Link href="/pricing" className="inline-block bg-[#163559] border border-[#1E4A7A] text-white text-xs px-6 py-2.5 hover:bg-[#1A4070] transition-colors">
              Upgrade to Pro →
            </Link>
          </div>
        )}
        </>
        )}

        {/* ── All Markets view — merged from /underpriced, 2026-07-09 ── */}
        {viewMode === "all" && (
          <div>
            <div className="mb-4">
              <p className="text-[10px] font-bold tracking-[0.2em] text-[#4A7090] uppercase mb-1">
                Underpriced Deals — All Markets
              </p>
              <p className="text-xs text-[#4A6080] max-w-2xl">
                Every listing here sits ≥15% below the median of ≥5 live comps in its own ZIP, property type, and
                bedroom count — never a blended metro median. Real submarket comps currently cover{" "}
                {allMarketsCoveredCount} US markets; UK and uncovered markets don&apos;t appear rather than being
                measured against the wrong basis.
              </p>
            </div>

            {allMarketsIsFreeTier ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
                  {allMarketsAggregate.map((m) => (
                    <div key={m.id} className="bg-[#111827] border border-[#1E2D40] px-4 py-3">
                      <div className="text-sm font-bold text-white">🇺🇸 {m.name}</div>
                      <div className="text-lg font-bold font-mono text-amber-400 mt-2">{m.mispricingCount} flagged</div>
                      <div className="text-[9px] text-[#4A6080] font-mono mt-1">{m.coveredCount} of {m.totalCount} listings have ≥5-comp coverage</div>
                    </div>
                  ))}
                </div>
                <div className="border border-[#1E4A7A] bg-[#0E2040] px-6 py-8 text-center mb-4">
                  <p className="text-sm font-bold text-white mb-2">Deals, addresses &amp; photos — members only</p>
                  <p className="text-xs text-[#4A6080] mb-4 max-w-md mx-auto">
                    Every flagged listing with full address, photos, discount vs. its own ZIP-level comps, and hourly
                    email alerts, from $29.99/mo.
                  </p>
                  <Link href="/pricing" className="inline-block bg-primary text-white font-semibold text-xs px-6 py-2.5 rounded-lg hover:bg-primary/85 transition-colors">
                    Unlock the feed →
                  </Link>
                </div>
                <div className="border border-primary/25 bg-primary/10 rounded-2xl p-6 text-center">
                  <p className="text-xs font-bold text-white mb-2">Be first when a mispriced listing hits your markets</p>
                  <WaitlistCta isAuthed={userIsAuthed} initialJoined={waitlistJoined} />
                </div>
              </>
            ) : (
              <AllMarketsExplorer
                deals={allMarketsDeals}
                markets={allMarketsAggregate.map((m) => ({ id: m.id, name: m.name }))}
                canBrochure={allMarketsCanBrochure}
                isTeaser={allMarketsIsTeaser}
                lockedCount={allMarketsLockedCount}
              />
            )}
          </div>
        )}

        {/* Footer disclaimer */}
        <div className="text-[9px] text-[#2E4560] pb-6 leading-relaxed">
          Sub-scores (growth, development, infrastructure, liquidity, risk) are manually-researched composite indexes — not generated by machine learning.
          The preliminary underwrite is a standard DCF calculator: all inputs and assumptions are set by you.
          Investment Analysis Report output is illustrative and for internal use only. Nothing here constitutes investment advice.
          Past performance does not guarantee future results.
        </div>

      </div>
    </div>
  );
}
