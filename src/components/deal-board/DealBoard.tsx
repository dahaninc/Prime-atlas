"use client";

/**
 * PRIME ATLAS — site-acquisition terminal
 * Bloomberg-style deal board with market tape, evidence layers, live pro-forma
 */

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";

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

interface DealBoardProps {
  rows: DealRow[];
  tier: "free" | "pro" | "investor" | "institutional";
  freshnessMap: Record<string, string>;
  userEmail?: string;
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
    source: "US Census Building Permits Survey · NAR · Freddie Mac · ACS",
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
    source: "NHBC · HM Land Registry · Bank of England · ONS",
    kpis: [
      { label: "Median price",       value: "£285K"    },
      { label: "Rent growth YoY",    value: "+3.1%"    },
      { label: "Undersupply index",  value: "68 / 100" },
      { label: "Cap rate (prime)",   value: "4.8%"     },
    ],
  },
  "Australia": {
    tape: [
      { label: "Approvals YoY",  value: "−12.4%", dir: "down" },
      { label: "Starts (ann)",   value: "162K",   dir: "flat" },
      { label: "Months supply",  value: "3.1",    dir: "flat" },
      { label: "Cash rate",      value: "4.35%",  dir: "flat" },
      { label: "Net migration",  value: "+518K",  dir: "up"   },
    ],
    source: "ABS Building Approvals · CoreLogic · Reserve Bank of Australia",
    kpis: [
      { label: "Median price",       value: "A$785K"   },
      { label: "Rent growth YoY",    value: "+4.2%"    },
      { label: "Undersupply index",  value: "75 / 100" },
      { label: "Cap rate (resi)",    value: "5.0%"     },
    ],
  },
  "Canada": {
    tape: [
      { label: "Starts YoY",     value: "−6.3%",  dir: "down" },
      { label: "Starts (ann)",   value: "237K",   dir: "flat" },
      { label: "Months supply",  value: "5.1",    dir: "flat" },
      { label: "Overnight rate", value: "5.00%",  dir: "flat" },
      { label: "Net migration",  value: "+485K",  dir: "up"   },
    ],
    source: "CMHC Housing Starts · CREA · Bank of Canada · Statistics Canada",
    kpis: [
      { label: "Avg price",          value: "C$720K"   },
      { label: "Rent growth YoY",    value: "+2.8%"    },
      { label: "Undersupply index",  value: "72 / 100" },
      { label: "Cap rate (MF)",      value: "4.6%"     },
    ],
  },
  "Spain": {
    tape: [
      { label: "Visas YoY",      value: "+4.8%",  dir: "up"   },
      { label: "Completions",    value: "89K",    dir: "flat" },
      { label: "Months supply",  value: "6.3",    dir: "flat" },
      { label: "ECB rate",       value: "4.50%",  dir: "flat" },
      { label: "Net migration",  value: "+286K",  dir: "up"   },
    ],
    source: "Ministerio de Fomento · INE · Banco de España · Notariado",
    kpis: [
      { label: "Avg price",          value: "€185K"    },
      { label: "Rent growth YoY",    value: "+5.1%"    },
      { label: "Undersupply index",  value: "62 / 100" },
      { label: "Cap rate (prime)",   value: "4.2%"     },
    ],
  },
};

// Country defaults for pro-forma
const COUNTRY_DEFAULTS: Record<string, { hardCost: number; avgPrice: number; sym: string }> = {
  "United Kingdom": { hardCost: 195,  avgPrice: 350_000,  sym: "£"   },
  "United States":  { hardCost: 185,  avgPrice: 415_000,  sym: "$"   },
  "Australia":      { hardCost: 280,  avgPrice: 785_000,  sym: "A$"  },
  "Canada":         { hardCost: 275,  avgPrice: 720_000,  sym: "C$"  },
  "Spain":          { hardCost: 130,  avgPrice: 185_000,  sym: "€"   },
};

function symFor(code: string) {
  return code === "GBP" ? "£" : code === "USD" ? "$" : code === "AUD" ? "A$" : code === "CAD" ? "C$" : "€";
}

// Evidence layer definitions
const EVIDENCE_LAYERS = [
  { key: "sourcing",    label: "Opportunity sourcing",  desc: "Source identification & data pipeline" },
  { key: "demand",      label: "Regional demand",        desc: "Population growth, migration, employment" },
  { key: "shortfall",   label: "Housing shortfall",      desc: "Supply gap vs household formation rate" },
  { key: "conversion",  label: "Conversion potential",   desc: "Zoning flexibility, permitted uses" },
  { key: "cost",        label: "Cost & timeline",        desc: "Build cost index, programme risk" },
  { key: "zoning",      label: "Zoning & permits",       desc: "Recent approvals, pipeline velocity" },
] as const;

// ─── Pro-Forma ────────────────────────────────────────────────────────────────

interface PF {
  units: number;
  gsfPerUnit: number;
  hardCostPerGsf: number;
  landCost: number;
  rentPerUnitMo: number;
  exitCapPct: number;
  contingencyPct: number;
}

function computePF(a: PF) {
  const totalGsf    = a.units * a.gsfPerUnit;
  const hardCosts   = totalGsf * a.hardCostPerGsf;
  const softCosts   = hardCosts * 0.18;
  const contingency = (hardCosts + softCosts) * (a.contingencyPct / 100);
  const totalDevCost = hardCosts + softCosts + contingency + a.landCost;
  const annualNOI    = a.units * a.rentPerUnitMo * 12 * (1 - 0.32); // opex 32%
  const exitValue    = annualNOI / (a.exitCapPct / 100);
  const profit       = exitValue - totalDevCost;
  const yieldOnCost  = (annualNOI / totalDevCost) * 100;
  const marginOnCost = (profit / totalDevCost) * 100;
  return { totalGsf, totalDevCost, annualNOI, exitValue, profit, yieldOnCost, marginOnCost };
}

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
  { label: "US",  name: "United States",  sub: "United States"  },
  { label: "UK",  name: "United Kingdom", sub: "United Kingdom" },
  { label: "AU",  name: "Australia",      sub: "Australia"      },
  { label: "CA",  name: "Canada",         sub: "Canada"         },
  { label: "ES",  name: "Spain",          sub: "Spain"          },
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

export function DealBoard({ rows, tier, freshnessMap, userEmail }: DealBoardProps) {
  const isPro = tier !== "free";

  const [country,     setCountry]     = useState("United States");
  const [sortMode,    setSortMode]    = useState<SortMode>("roi");
  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  const [checkedLayers, setCheckedLayers] = useState<Set<string>>(new Set());
  const [time, setTime] = useState("");

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
    return [...rows]
      .filter((r) => r.country === country)
      .sort((a, b) => (b[key] as number) - (a[key] as number));
  }, [rows, country, sortMode]);

  const selectedRow = sorted.find((r) => r.id === selectedId) ?? null;

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
    });
  }, [selectedRow?.id]);

  const pfOut = useMemo(() => pf ? computePF(pf) : null, [pf]);

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

  function generateMemo() {
    if (!selectedRow || !pf || !pfOut) return;
    const s = symFor(selectedRow.currency_code);
    const lines = [
      ["PRIME ATLAS — IC MEMO", ""],
      ["Generated", new Date().toISOString()],
      ["Analyst", userEmail ?? "—"],
      [""],
      ["MARKET"],
      ["City",         selectedRow.name],
      ["Region",       selectedRow.region],
      ["Country",      selectedRow.country],
      ["Data source",  selectedRow.source_name],
      ["Confidence",   `${(selectedRow.data_confidence * 100).toFixed(0)}%`],
      [""],
      ["SCORES"],
      ["ROI (Composite)", selectedRow.opportunity_score],
      ["Zoning (Dev.)",   selectedRow.development_score],
      ["Demand (Growth)", selectedRow.growth_score],
      ["Infrastructure",  selectedRow.infrastructure_score],
      ["Liquidity",       selectedRow.liquidity_score],
      ["Risk",            selectedRow.risk_score],
      [""],
      ["PRO-FORMA INPUTS"],
      ["Units",           pf.units],
      ["GSF / unit",      pf.gsfPerUnit],
      ["Hard cost / GSF", `${s}${pf.hardCostPerGsf}`],
      ["Land cost",       fmt(pf.landCost, s)],
      ["Rent / unit / mo", fmt(pf.rentPerUnitMo, s)],
      ["Exit cap",        `${pf.exitCapPct}%`],
      ["Contingency",     `${pf.contingencyPct}%`],
      [""],
      ["YIELD ANALYSIS"],
      ["Total dev cost",   fmt(pfOut.totalDevCost, s)],
      ["Stabilised NOI",   fmt(pfOut.annualNOI, s)],
      ["Value at exit cap",fmt(pfOut.exitValue, s)],
      ["Profit",           fmt(pfOut.profit, s)],
      ["Yield on cost",    `${pfOut.yieldOnCost.toFixed(1)}%`],
      ["Margin on cost",   `${pfOut.marginOnCost.toFixed(1)}%`],
      [""],
      ["Evidence layers included:", Array.from(checkedLayers).join(", ") || "None selected"],
      [""],
      ["DISCLAIMER: Illustrative only. Scores are index-based. Not investment advice.", ""],
    ];
    const csv  = lines.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `prime-atlas-ic-memo-${selectedRow.slug}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="font-mono text-sm text-white min-h-screen bg-[#0B0F1A]">

      {/* ── Terminal header ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#1E2D40] bg-[#0D1221]">
        <div className="flex items-center gap-3">
          <span className="text-white font-bold tracking-widest text-base">PRIME ATLAS</span>
          <span className="text-[#4A6080] text-xs">site-acquisition terminal</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-400 text-xs">live</span>
          <span className="text-[#4A6080] text-xs ml-2 tabular-nums">{time}</span>
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

        {/* ── Deal board table ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-white">
              Deal board
              <span className="text-[#4A6080] font-normal ml-2">· {sorted.length} ranked</span>
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

            {/* Rows */}
            {sorted.map((row, i) => {
              const locked   = !isPro && i >= FREE_LIMIT;
              const selected = selectedId === row.id;
              return (
                <div
                  key={row.id}
                  onClick={() => !locked && setSelectedId(selected ? null : row.id)}
                  className={`grid grid-cols-[1fr_5rem_5rem_5rem_6rem] gap-2 px-4 py-3 border-b border-[#1A2535] transition-colors ${
                    locked   ? "opacity-30 pointer-events-none select-none" :
                    selected ? "bg-[#0D2040] cursor-pointer" :
                               "hover:bg-[#111827] cursor-pointer"
                  }`}
                >
                  <div>
                    <div className={`text-sm font-semibold leading-snug ${locked ? "" : "text-white"}`}>
                      {locked ? "████████████" : row.name}
                    </div>
                    <div className="text-[11px] text-[#4A6080] mt-0.5">
                      {locked ? "████████" : `${row.region}, ${row.country}`}
                    </div>
                  </div>
                  <div className="flex items-center justify-center">
                    {locked ? <span className="text-[#1A2535]">██</span> : <Badge score={row.opportunity_score} />}
                  </div>
                  <div className="flex items-center justify-center">
                    {locked ? <span className="text-[#1A2535]">██</span> : <Badge score={row.development_score} />}
                  </div>
                  <div className="flex items-center justify-center">
                    {locked ? <span className="text-[#1A2535]">██</span> : <Badge score={row.growth_score} />}
                  </div>
                  <div className="flex items-center justify-end text-sm font-bold text-white">
                    {locked ? "——" : gdvEst(row)}
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

        {/* ── Selected row detail ── */}
        {selectedRow && isPro && (
          <div className="border border-[#1E3050] bg-[#0D1828]">

            {/* Panel header */}
            <div className="flex items-start justify-between px-5 py-4 border-b border-[#1E2D40]">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[9px] tracking-widest text-[#4A6080] uppercase">Selected market</span>
                </div>
                <div className="text-lg font-bold text-white">{selectedRow.name}</div>
                <div className="text-xs text-[#4A6080]">
                  {selectedRow.region} · {selectedRow.country} · {selectedRow.source_name}
                  {selectedRow.retrieved_at && ` · data ${new Date(selectedRow.retrieved_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`}
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
                <button
                  onClick={() => setSelectedId(null)}
                  className="ml-2 text-[#3A5068] hover:text-white text-lg leading-none"
                >×</button>
              </div>
            </div>

            {/* Evidence layers */}
            <div className="px-5 pt-4 pb-3 border-b border-[#1E2D40]">
              <div className="text-[10px] tracking-[0.15em] text-[#4A6080] uppercase mb-3">Evidence Layers</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {EVIDENCE_LAYERS.map((layer) => {
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
                          {selectedRow.source_name} · {
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
                <div className="text-[10px] tracking-[0.15em] text-[#4A6080] uppercase mb-3">
                  Pro-Forma — editable, recalculates live{" "}
                  <span className="text-[#2E4560] normal-case tracking-normal">(opex held at 32% of gross)</span>
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

                {/* Generate IC memo button */}
                <button
                  onClick={generateMemo}
                  className="w-full py-3.5 bg-gradient-to-r from-[#163559] to-[#0E3070] border border-[#1E4A7A] text-white text-sm font-semibold hover:from-[#1A4070] hover:to-[#1248A0] transition-all flex items-center justify-center gap-2"
                >
                  <span className={checkedLayers.size > 0 ? "text-emerald-400" : "text-[#4A6080]"}>
                    {checkedLayers.size > 0 ? "☑" : "☐"}
                  </span>
                  Generate IC memo ↗
                </button>
                <div className="text-[9px] text-[#2E4560] mt-2 text-center">
                  {checkedLayers.size > 0
                    ? `${checkedLayers.size} evidence layer${checkedLayers.size > 1 ? "s" : ""} will be included in the memo`
                    : "Select evidence layers above to include in IC memo"}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Free-tier pro-forma CTA */}
        {selectedRow && !isPro && (
          <div className="border border-[#1E2D40] bg-[#0D1624] px-5 py-5 text-center">
            <div className="text-sm font-semibold text-white mb-1">Evidence layers & pro-forma are Pro features</div>
            <div className="text-xs text-[#4A6080] mb-4">
              Pro unlocks full evidence layers, editable yield pro-forma (units / GSF / NOI / margin on cost), and one-click IC memo export.
            </div>
            <Link href="/pricing" className="inline-block bg-[#163559] border border-[#1E4A7A] text-white text-xs px-6 py-2.5 hover:bg-[#1A4070] transition-colors">
              Upgrade to Pro →
            </Link>
          </div>
        )}

        {/* Footer disclaimer */}
        <div className="text-[9px] text-[#2E4560] pb-6 leading-relaxed">
          Illustrative demo data for prototype purposes. Scores and pro-forma are computed client-side;
          live build wires these to the source feeds shown on each chip.
          Nothing here constitutes investment advice. prime-atlas does not guarantee accuracy or completeness.
        </div>

      </div>
    </div>
  );
}
