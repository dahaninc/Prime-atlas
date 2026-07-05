"use client";

/**
 * PRIME ATLAS — conviction terminal
 * Pre-screened pipeline · Preliminary underwrite · One-click IC memo
 */

import { useState, useMemo, useEffect, useTransition } from "react";
import { type PF, computePF, sensitivityGrid, DILIGENCE_BY_COUNTRY, localizedPpsm } from "@/lib/proforma";
import { toast } from "@/components/ui/Toaster";
import Link from "next/link";
import { createDealAlert } from "@/app/deal-board/actions";

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
}

// ─── Market Tape Data ─────────────────────────────────────────────────────────

interface TapeStat {
  label: string;
  value: string;
  dir: "up" | "down" | "flat";
}

interface MarketTapeData {
  tape: TapeStat[];
  source: string;
  kpis: Array<{ label: string; value: string }>;
}

const MARKET_TAPE: Record<string, MarketTapeData> = {
  "United States": {
    tape: [
      { label: "Permits YoY",   value: "−3.2%",  dir: "down" },
      { label: "Starts (ann)",  value: "1.35M",  dir: "up"   },
      { label: "Months supply", value: "8.9",    dir: "flat" },
      { label: "30y mortgage",  value: "6.41%",  dir: "down" },
      { label: "Net migration", value: "+1.6M",  dir: "up"   },
    ],
    source: "Prime Atlas USA Intelligence",
    kpis: [
      { label: "Median new home",    value: "$438,200" },
      { label: "Rent growth YoY",    value: "+2.9%"    },
      { label: "Undersupply index",  value: "71 / 100" },
      { label: "Cap rate (MF)",      value: "5.2%"     },
    ],
  },
  "United Kingdom": {
    tape: [
      { label: "Starts YoY",     value: "−8.1%",  dir: "down" },
      { label: "Completions",    value: "230K",   dir: "flat" },
      { label: "Months supply",  value: "4.2",    dir: "flat" },
      { label: "Base rate",      value: "5.25%",  dir: "flat" },
      { label: "Net migration",  value: "+685K",  dir: "up"   },
    ],
    source: "Prime Atlas UK Intelligence",
    kpis: [
      { label: "Median price",       value: "£285K"    },
      { label: "Rent growth YoY",    value: "+3.1%"    },
      { label: "Undersupply index",  value: "68 / 100" },
      { label: "Cap rate (prime)",   value: "4.8%"     },
    ],
  },
};

// Country defaults for pro-forma
const COUNTRY_DEFAULTS: Record<string, { hardCost: number; avgPrice: number; sym: string }> = {
  "United Kingdom": { hardCost: 195, avgPrice: 350_000, sym: "£" },
  "United States":  { hardCost: 185, avgPrice: 415_000, sym: "$" },
};

function symFor(code: string) {
  return code === "GBP" ? "£" : "$";
}

// Conviction checklist — country-localized (US: zoning/FAR, tax abatements,
// energy compliance; UK: planning, S106/CIL, EPC). See src/lib/proforma.ts.
// Pro-forma engine (computePF, sensitivityGrid) also lives there so the
// terminal and the exported memo can never disagree.

function fmt(n: number, sym: string) {
  const abs = Math.abs(n);
  const s   = abs >= 1_000_000 ? `${sym}${(abs / 1_000_000).toFixed(1)}M`
            : abs >= 1_000     ? `${sym}${(abs / 1_000).toFixed(1)}K`
            :                    `${sym}${Math.round(abs)}`;
  return n < 0 ? `−${s}` : s;
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
}: DealBoardProps) {
  const isPro = tier !== "free";
  const [alertState, setAlertState] = useState<"idle" | "done" | "error">("idle");
  const [alertPending, startAlert] = useTransition();

  const [country,     setCountry]     = useState("United States");
  const [sortMode,    setSortMode]    = useState<SortMode>("roi");
  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  const [checkedLayers, setCheckedLayers] = useState<Set<string>>(new Set());
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
  }, [selectedRow?.id]);

  const pfOut = useMemo(() => pf ? computePF(pf) : null, [pf]);
  const sens  = useMemo(() => pf ? sensitivityGrid(pf) : null, [pf]);
  const diligence = DILIGENCE_BY_COUNTRY[country] ?? DILIGENCE_BY_COUNTRY["United Kingdom"];

  const tape  = MARKET_TAPE[country];
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const sym   = selectedRow ? symFor(selectedRow.currency_code) : "$";

  function toggleLayer(key: string) {
    setCheckedLayers((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const [memoPending, setMemoPending] = useState(false);

  async function generateMemo() {
    if (!selectedRow || !pf || !pfOut || !sens || memoPending) return;
    const s  = symFor(selectedRow.currency_code);
    const st = statsMap[selectedRow.id];
    const prev = prevScoreMap[selectedRow.id];

    const payload = {
      market: { name: selectedRow.name, region: selectedRow.region, country: selectedRow.country, slug: selectedRow.slug },
      scores: {
        opportunity: selectedRow.opportunity_score, growth: selectedRow.growth_score,
        development: selectedRow.development_score, infrastructure: selectedRow.infrastructure_score,
        liquidity: selectedRow.liquidity_score, risk: selectedRow.risk_score,
      },
      momentum: prev !== undefined ? { previous: prev, current: selectedRow.opportunity_score } : null,
      pulse: st ? {
        sale_count: st.sale_count, rent_count: st.rent_count,
        median_price: st.median_price ? fmt(st.median_price / 100, s) : "n/a",
        median_ppsm_local: st.median_ppsqm ? localizedPpsm(Number(st.median_ppsqm), selectedRow.country, s) : "n/a",
        underpriced_count: st.underpriced_count,
      } : null,
      pf: {
        units: pf.units, gsfPerUnit: pf.gsfPerUnit, hardCostPerGsf: pf.hardCostPerGsf,
        landCost: pf.landCost, rentPerUnitMo: pf.rentPerUnitMo, exitCapPct: pf.exitCapPct,
        contingencyPct: pf.contingencyPct, interestPct: pf.interestPct,
      },
      pfOut: {
        totalDevCost: fmt(pfOut.totalDevCost, s),
        annualNOI:    fmt(pfOut.annualNOI, s),
        exitValue:    fmt(pfOut.exitValue, s),
        yieldOnCost:  `${pfOut.yieldOnCost.toFixed(2)}%`,
        marginOnCost: `${pfOut.marginOnCost.toFixed(1)}%`,
        marginOnGDV:  `${pfOut.marginOnGDV.toFixed(1)}%`,
      },
      sensitivity: sens.map((row) => row.map(({ ratePct, capPct, marginOnGDV }) => ({ ratePct, capPct, marginOnGDV }))),
      diligence: diligence.map((d) => ({ label: d.label, desc: d.desc, checked: checkedLayers.has(d.key) })),
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
          ? `Market baseline computed from ${st.sale_count + st.rent_count} live ${selectedRow.name} listings scraped ${today}`
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
        toast("IC memo export is a Pro feature — upgrade to unlock", "error");
        return;
      }
      if (!res.ok) {
        toast("Memo export failed — try again", "error");
        return;
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `ic-memo-${selectedRow.slug}.doc`;
      a.click(); URL.revokeObjectURL(url);
      toast("IC memo exported — Word-editable .doc");
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

        {/* ── Market tape ── */}
        {tape && (
          <div className="bg-[#0E1E32] border border-[#1E3050] px-4 py-3">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-[10px] font-bold tracking-[0.2em] text-[#4A7090] uppercase">Market Tape</span>
              <span className="text-[10px] text-[#3A5068]">as of {today}</span>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 mb-2">
              {tape.tape.map((s) => (
                <span key={s.label} className="text-xs">
                  <span className="text-[#4A6080]">{s.label} </span>
                  <span className={
                    s.dir === "up"   ? "text-emerald-400 font-bold" :
                    s.dir === "down" ? "text-red-400 font-bold"     : "text-white font-bold"
                  }>{s.value}</span>
                </span>
              ))}
            </div>
            <div className="text-[9px] text-[#2E4560]">Source: {tape.source}</div>
          </div>
        )}

        {/* ── KPI cards ── */}
        {tape && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {tape.kpis.map((k) => (
              <div key={k.label} className="bg-[#111827] border border-[#1E2D40] px-4 py-3">
                <div className="text-[10px] text-[#4A6080] mb-1">{k.label}</div>
                <div className="text-xl font-bold text-white tracking-tight">{k.value}</div>
              </div>
            ))}
          </div>
        )}

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
                        {(statsMap[row.id]?.underpriced_count ?? 0) > 0 && (
                          <span className="text-[9px] text-amber-300 border border-amber-800 bg-amber-950/40 rounded px-1 py-0.5 font-mono" title="Listings ≥15% below market median £/sqm">
                            {statsMap[row.id].underpriced_count} underpriced
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
                      <div className="text-[10px] text-amber-500/80 mb-1">Underpriced ≥15%</div>
                      <div className="text-lg font-bold text-amber-300">{st.underpriced_count}</div>
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
                        : `🔔 Alert me: new ${selectedRow.name} deals ≥15% below market`}
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

            {/* Conviction checklist */}
            <div className="px-5 pt-4 pb-3 border-b border-[#1E2D40]">
              <div className="text-[10px] tracking-[0.15em] text-[#4A6080] uppercase mb-1">Conviction Checklist</div>
              <div className="text-[10px] text-[#2E4560] mb-3">Tick each dimension you have reviewed — checked layers are included in the IC memo export</div>
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

            {/* Pro-forma */}
            {pf && pfOut && (
              <div className="px-5 pt-4 pb-5">
                <div className="text-[10px] tracking-[0.15em] text-[#4A6080] uppercase mb-1">
                  Preliminary Underwrite
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

                {/* IC Memo — primary CTA */}
                <button
                  onClick={generateMemo}
                  disabled={memoPending}
                  className="w-full border border-[#1E4A7A] bg-[#0E1E32] hover:bg-[#12294A] hover:border-[#2A5C96] transition-all disabled:opacity-60 text-left"
                >
                  <div className="px-5 py-4 flex items-center justify-between gap-6">
                    <div>
                      <div className="text-[9px] tracking-[0.3em] text-[#4A7090] uppercase mb-1">
                        Investment Committee
                      </div>
                      <div className="text-sm font-bold text-white tracking-tight">
                        {memoPending ? "Preparing memorandum…" : "Prepare Committee Memorandum"}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[9px] text-[#4A6080] uppercase tracking-[0.15em]">Word · .doc</div>
                      <div className={`text-[10px] font-mono mt-0.5 ${checkedLayers.size > 0 ? "text-emerald-400" : "text-[#3A5068]"}`}>
                        {checkedLayers.size > 0
                          ? `${checkedLayers.size} conviction dimension${checkedLayers.size > 1 ? "s" : ""}`
                          : "base memorandum"}
                      </div>
                    </div>
                  </div>
                </button>
                <div className="text-[9px] text-[#2E4560] mt-2 text-center">
                  {checkedLayers.size > 0
                    ? "Compiled from live market data, preliminary underwrite, and selected conviction dimensions — with scores and sources."
                    : "Select conviction checklist dimensions above to annex them to the memorandum."}
                </div>

                {/* Link to full city deal page */}
                <Link
                  href={`/opportunities/${selectedRow.slug}`}
                  className="mt-3 w-full py-2.5 border border-[#1E2D40] text-[#4A7090] hover:text-white hover:border-[#1E3A60] text-[11px] font-semibold transition-all flex items-center justify-center gap-2"
                >
                  View all opportunities, signals & planning data for {selectedRow.name} ↗
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Free-tier upgrade wall */}
        {selectedRow && !isPro && (
          <div className="border border-[#1E2D40] bg-[#0D1624] px-5 py-5 text-center">
            <div className="text-sm font-semibold text-white mb-1">Preliminary underwrite &amp; IC memo are Pro features</div>
            <div className="text-xs text-[#4A6080] mb-4">
              Pro unlocks all markets, the conviction checklist, editable preliminary underwrite (yield-on-cost · NOI · margin), and one-click IC memo export — the output you bring to committee.
            </div>
            <Link href="/pricing" className="inline-block bg-[#163559] border border-[#1E4A7A] text-white text-xs px-6 py-2.5 hover:bg-[#1A4070] transition-colors">
              Upgrade to Pro →
            </Link>
          </div>
        )}

        {/* Footer disclaimer */}
        <div className="text-[9px] text-[#2E4560] pb-6 leading-relaxed">
          Sub-scores (growth, development, infrastructure, liquidity, risk) are manually-researched composite indexes compiled from the public data sources shown on each market tape — not generated by machine learning.
          The preliminary underwrite is a standard DCF calculator: all inputs and assumptions are set by you.
          IC memo output is illustrative and for internal use only. Nothing here constitutes investment advice.
          Past performance does not guarantee future results.
        </div>

      </div>
    </div>
  );
}
