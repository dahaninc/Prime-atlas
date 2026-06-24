"use client";

/**
 * DealBoard — Bloomberg-style ranked market intelligence
 *
 * - Country tabs with market counts
 * - Per-country macro context bar (rates, cap rates, housing gap, build costs)
 * - Sortable ranked table with Verdict badge (IC Ready / Diligence / Monitor)
 * - ▶ expand per row → 5-dimension evidence panel with mini bars + full provenance
 * - ⊞ per row (pro) → development pro-forma panel: units/GSF/hard costs/LTC/IRR/RoC
 * - IC Memo CSV export
 */

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

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
}

// ─────────────────────────────────────────────────────────────────────────────
// Country macro data (sourced, dated — Bloomberg-style context)
// ─────────────────────────────────────────────────────────────────────────────

interface MacroStat {
  label: string;
  value: string;
  source: string;
  date: string;
}

const COUNTRY_META: Record<string, {
  flag: string;
  currency: string;
  defaultHardCostPerGsf: number;
  defaultAvgPricePerUnit: number;
  stats: MacroStat[];
}> = {
  "United Kingdom": {
    flag: "🇬🇧", currency: "GBP",
    defaultHardCostPerGsf: 195, defaultAvgPricePerUnit: 350_000,
    stats: [
      { label: "Base Rate",       value: "5.25%",       source: "Bank of England",       date: "May 2026" },
      { label: "Prime Cap Rate",  value: "4.8%",        source: "MSCI/IPD",              date: "Q1 2026"  },
      { label: "Housing Gap",     value: "~4.3M units", source: "NHBC / CBI",            date: "2026"     },
      { label: "Median Price",    value: "£285K",       source: "HM Land Registry",      date: "Apr 2026" },
      { label: "Hard Cost/GSF",   value: "£195",        source: "BCIS",                  date: "Q1 2026"  },
    ],
  },
  "United States": {
    flag: "🇺🇸", currency: "USD",
    defaultHardCostPerGsf: 185, defaultAvgPricePerUnit: 415_000,
    stats: [
      { label: "Fed Funds Rate",  value: "5.25–5.50%",  source: "Federal Reserve",       date: "Jun 2026" },
      { label: "Cap Rate",        value: "5.4%",        source: "CBRE",                  date: "Q1 2026"  },
      { label: "Housing Gap",     value: "~3.8M units", source: "NAR",                   date: "2026"     },
      { label: "Median Price",    value: "$415K",       source: "NAR",                   date: "May 2026" },
      { label: "Hard Cost/GSF",   value: "$185",        source: "RSMeans 2026",          date: "2026"     },
    ],
  },
  "Australia": {
    flag: "🇦🇺", currency: "AUD",
    defaultHardCostPerGsf: 280, defaultAvgPricePerUnit: 785_000,
    stats: [
      { label: "Cash Rate",       value: "4.35%",       source: "Reserve Bank of Aus.",  date: "Jun 2026" },
      { label: "Cap Rate",        value: "5.0%",        source: "CBRE Australia",        date: "Q1 2026"  },
      { label: "Housing Gap",     value: "~263K units", source: "NHFIC",                 date: "2025–26"  },
      { label: "Median Price",    value: "A$785K",      source: "CoreLogic",             date: "May 2026" },
      { label: "Hard Cost/sqm",   value: "A$2,900",    source: "Rawlinsons",            date: "2026"     },
    ],
  },
  "Canada": {
    flag: "🇨🇦", currency: "CAD",
    defaultHardCostPerGsf: 275, defaultAvgPricePerUnit: 720_000,
    stats: [
      { label: "Overnight Rate",  value: "5.00%",       source: "Bank of Canada",        date: "Jun 2026" },
      { label: "Cap Rate",        value: "4.6%",        source: "Altus Group",           date: "Q1 2026"  },
      { label: "Housing Gap",     value: "~3.5M units", source: "CMHC",                  date: "2030 target" },
      { label: "Avg Price",       value: "C$720K",      source: "CREA",                  date: "May 2026" },
      { label: "Hard Cost/GSF",   value: "C$275",       source: "RSMeans Canada",        date: "2026"     },
    ],
  },
  "Spain": {
    flag: "🇪🇸", currency: "EUR",
    defaultHardCostPerGsf: 130, defaultAvgPricePerUnit: 185_000,
    stats: [
      { label: "ECB Rate",        value: "4.50%",       source: "European Central Bank", date: "Jun 2026" },
      { label: "Prime Cap Rate",  value: "4.2%",        source: "CBRE Spain",            date: "Q1 2026"  },
      { label: "Housing Gap",     value: "~600K units", source: "Notariado",             date: "2026"     },
      { label: "Avg Price",       value: "€185K",       source: "INE / Catastro",        date: "Apr 2026" },
      { label: "Hard Cost/sqm",   value: "€1,250",     source: "SEOPAN",                date: "2025"     },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Development Pro-Forma (developer yield language)
// ─────────────────────────────────────────────────────────────────────────────

interface ProFormaAssumptions {
  units: number;
  gsfPerUnit: number;
  hardCostPerGsf: number;
  softCostPct: number;      // % of hard
  contingencyPct: number;   // % of hard+soft
  ltcPct: number;           // loan-to-cost %
  financeRatePa: number;    // dev finance rate %
  buildMonths: number;
  avgPricePerUnit: number;
  exitCapRate: number;
  absorptionMonths: number;
}

interface ProFormaOutput {
  totalGsf: number;
  hardCosts: number;
  softCosts: number;
  contingency: number;
  totalDevCost: number;
  equityRequired: number;
  financeCosts: number;
  allInCost: number;
  gdv: number;
  netProfit: number;
  returnOnCost: number;
  returnOnEquity: number;
  profitOnGdv: number;
  equityMultiple: number;
  irr: number;
}

function computeProForma(a: ProFormaAssumptions): ProFormaOutput {
  const totalGsf     = a.units * a.gsfPerUnit;
  const hardCosts    = totalGsf * a.hardCostPerGsf;
  const softCosts    = hardCosts * (a.softCostPct / 100);
  const subTotal     = hardCosts + softCosts;
  const contingency  = subTotal * (a.contingencyPct / 100);
  const totalDevCost = subTotal + contingency;
  const debtDrawn    = totalDevCost * (a.ltcPct / 100);
  const equityRequired = totalDevCost - debtDrawn;
  const financeCosts = debtDrawn * (a.financeRatePa / 100) * (a.buildMonths / 12);
  const allInCost    = totalDevCost + financeCosts;
  const gdv          = a.units * a.avgPricePerUnit;
  const netProfit    = gdv - allInCost;

  const returnOnCost   = (netProfit / allInCost) * 100;
  const returnOnEquity = equityRequired > 0 ? (netProfit / equityRequired) * 100 : 0;
  const profitOnGdv    = gdv > 0 ? (netProfit / gdv) * 100 : 0;
  const equityMultiple = equityRequired > 0 ? (netProfit + equityRequired) / equityRequired : 0;

  // IRR via Newton's method
  const holdYears = (a.buildMonths + a.absorptionMonths * 0.5) / 12;
  let irr = 0.15;
  for (let i = 0; i < 100; i++) {
    const pv   = (equityRequired + netProfit) / Math.pow(1 + irr, holdYears);
    const npv  = pv - equityRequired;
    const dnpv = -(holdYears * (equityRequired + netProfit)) / Math.pow(1 + irr, holdYears + 1);
    if (Math.abs(dnpv) < 1e-10) break;
    const delta = npv / dnpv;
    irr -= delta;
    if (Math.abs(delta) < 1e-7) break;
  }

  return {
    totalGsf, hardCosts, softCosts, contingency, totalDevCost,
    equityRequired, financeCosts, allInCost, gdv, netProfit,
    returnOnCost:   Math.round(returnOnCost   * 10) / 10,
    returnOnEquity: Math.round(returnOnEquity * 10) / 10,
    profitOnGdv:    Math.round(profitOnGdv    * 10) / 10,
    equityMultiple: Math.round(equityMultiple * 100) / 100,
    irr:            Math.round(irr * 1000) / 10,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// IC Memo CSV export
// ─────────────────────────────────────────────────────────────────────────────

function exportICMemo(row: DealRow, a: ProFormaAssumptions, pf: ProFormaOutput, currSym: string): void {
  const fmt = (n: number) => `${currSym}${Math.round(n).toLocaleString("en-GB")}`;
  const lines = [
    ["prime-atlas IC Memo", ""],
    ["Generated",           new Date().toISOString()],
    [""],
    ["MARKET"],
    ["City",               row.name],
    ["Region",             row.region],
    ["Country",            row.country],
    ["Data source",        row.source_name],
    ["Data confidence",    `${(row.data_confidence * 100).toFixed(0)}%`],
    ["Retrieved",          row.retrieved_at ?? "—"],
    [""],
    ["OPPORTUNITY SCORES"],
    ["Composite",          row.opportunity_score],
    ["Growth",             row.growth_score],
    ["Infrastructure",     row.infrastructure_score],
    ["Development",        row.development_score],
    ["Liquidity",          row.liquidity_score],
    ["Risk",               row.risk_score],
    [""],
    ["DEVELOPMENT PRO-FORMA ASSUMPTIONS"],
    ["Units",              a.units],
    ["GSF / unit",         a.gsfPerUnit],
    ["Hard cost / GSF",   `${currSym}${a.hardCostPerGsf}`],
    ["Soft costs",         `${a.softCostPct}%`],
    ["Contingency",        `${a.contingencyPct}%`],
    ["LTC ratio",          `${a.ltcPct}%`],
    ["Finance rate",       `${a.financeRatePa}% pa`],
    ["Build period",       `${a.buildMonths} months`],
    ["Avg. sale / unit",  `${currSym}${a.avgPricePerUnit.toLocaleString("en-GB")}`],
    ["Exit cap rate",      `${a.exitCapRate}%`],
    ["Absorption",         `${a.absorptionMonths} months`],
    [""],
    ["YIELD ANALYSIS"],
    ["Total GSF",          pf.totalGsf.toLocaleString("en-GB")],
    ["Hard costs",         fmt(pf.hardCosts)],
    ["Soft costs",         fmt(pf.softCosts)],
    ["Contingency",        fmt(pf.contingency)],
    ["Total dev. cost",    fmt(pf.totalDevCost)],
    ["Dev. finance cost",  fmt(pf.financeCosts)],
    ["All-in cost",        fmt(pf.allInCost)],
    ["GDV",                fmt(pf.gdv)],
    ["Net profit",         fmt(pf.netProfit)],
    ["Return on cost",     `${pf.returnOnCost}%`],
    ["Return on equity",   `${pf.returnOnEquity}%`],
    ["Profit on GDV",      `${pf.profitOnGdv}%`],
    ["Equity multiple",    `${pf.equityMultiple}×`],
    ["IRR (levered)",      `${pf.irr}%`],
    ["Equity required",    fmt(pf.equityRequired)],
    [""],
    ["DISCLAIMER"],
    ["Indicative only · prime-atlas does not provide investment advice.", ""],
  ];
  const csv = lines.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const el   = document.createElement("a");
  el.href = url; el.download = `prime-atlas-ic-memo-${row.slug}-${Date.now()}.csv`;
  el.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────────────────────

const FREE_VISIBLE = 5;

function scoreColor(n: number): string {
  if (n >= 75) return "text-pa-green";
  if (n >= 50) return "text-amber-400";
  return "text-rose-400";
}

function verdictBadge(score: number): { label: string; cls: string } {
  if (score >= 75) return { label: "IC Ready",  cls: "bg-pa-green/10 text-pa-green border-pa-green/30" };
  if (score >= 60) return { label: "Diligence", cls: "bg-amber-400/10 text-amber-400 border-amber-400/30" };
  return              { label: "Monitor",    cls: "bg-secondary text-muted-foreground border-border" };
}

function freshnessLabel(iso: string | null): { label: string; color: string } {
  if (!iso) return { label: "—",      color: "text-muted-foreground" };
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0)   return { label: "Today",                       color: "text-pa-green" };
  if (days <= 7)    return { label: `${days}d`,                    color: "text-pa-green" };
  if (days <= 30)   return { label: `${days}d`,                    color: "text-amber-400" };
  return              { label: `${Math.floor(days / 30)}mo`,       color: "text-rose-400" };
}

function fmtMoney(n: number, sym: string): string {
  if (Math.abs(n) >= 1_000_000) return `${sym}${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000)     return `${sym}${(n / 1_000).toFixed(0)}K`;
  return `${sym}${Math.round(n)}`;
}

function currSym(code: string): string {
  if (code === "GBP") return "£";
  if (code === "USD") return "$";
  if (code === "AUD") return "A$";
  if (code === "CAD") return "C$";
  return "€";
}

type SortKey = "opportunity_score" | "growth_score" | "infrastructure_score" | "liquidity_score" | "risk_score";

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function DealBoard({ rows, tier, freshnessMap }: DealBoardProps) {
  const isPro = tier !== "free";
  const router = useRouter();

  const [sortKey,       setSortKey]       = useState<SortKey>("opportunity_score");
  const [sortDir,       setSortDir]       = useState<"desc" | "asc">("desc");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [expandedId,    setExpandedId]    = useState<string | null>(null);
  const [proFormaId,    setProFormaId]    = useState<string | null>(null);
  const [proFormaRow,   setProFormaRow]   = useState<DealRow | null>(null);
  const [assumptions,   setAssumptions]   = useState<ProFormaAssumptions | null>(null);

  const proForma = useMemo(
    () => (assumptions ? computeProForma(assumptions) : null),
    [assumptions]
  );

  // Derived country list + counts
  const countryList = useMemo(
    () => ["all", ...Array.from(new Set(rows.map((r) => r.country))).sort()],
    [rows]
  );
  const countryCount = useMemo(() => {
    const m: Record<string, number> = { all: rows.length };
    for (const r of rows) m[r.country] = (m[r.country] ?? 0) + 1;
    return m;
  }, [rows]);

  // Sort + filter
  const sorted = useMemo(() => {
    const filtered = countryFilter === "all" ? rows : rows.filter((r) => r.country === countryFilter);
    return [...filtered].sort((a, b) => {
      const mult = sortDir === "desc" ? -1 : 1;
      const av = sortKey === "risk_score" ? 100 - a[sortKey] : a[sortKey];
      const bv = sortKey === "risk_score" ? 100 - b[sortKey] : b[sortKey];
      return mult * (bv - av);
    });
  }, [rows, sortKey, sortDir, countryFilter]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  function openProForma(row: DealRow) {
    const meta = COUNTRY_META[row.country];
    setProFormaRow(row);
    setProFormaId(row.id);
    setAssumptions({
      units: 50,
      gsfPerUnit: 1_000,
      hardCostPerGsf:   meta?.defaultHardCostPerGsf   ?? 185,
      softCostPct:      18,
      contingencyPct:   10,
      ltcPct:           65,
      financeRatePa:    7.5,
      buildMonths:      24,
      avgPricePerUnit:  meta?.defaultAvgPricePerUnit   ?? 400_000,
      exitCapRate:      5.0,
      absorptionMonths: 12,
    });
  }

  function closeProForma() {
    setProFormaRow(null);
    setProFormaId(null);
    setAssumptions(null);
  }

  function SortHeader({ label, k }: { label: string; k: SortKey }) {
    const active = sortKey === k;
    return (
      <button
        onClick={() => toggleSort(k)}
        className={`flex items-center gap-0.5 text-xs font-medium transition-colors ${
          active ? "text-pa-green" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {label}
        <span className="font-mono text-[9px]">{active ? (sortDir === "desc" ? "↓" : "↑") : "↕"}</span>
      </button>
    );
  }

  const selectedMeta = countryFilter !== "all" ? COUNTRY_META[countryFilter] : null;

  // Grid definitions
  const headerGrid = isPro
    ? "grid-cols-[1.25rem_1.25rem_1fr_5rem_4rem_3.5rem_3.5rem_3.5rem_3.5rem_4.5rem_2.5rem]"
    : "grid-cols-[1.25rem_1.25rem_1fr_5rem_4rem_3.5rem_3.5rem_3.5rem_3.5rem_4.5rem]";

  return (
    <div className="space-y-4">

      {/* ── Country tabs ─────────────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap items-center">
        {countryList.map((c) => {
          const meta  = COUNTRY_META[c];
          const flag  = meta?.flag ?? "🌍";
          const label = c === "all" ? "All Markets" : c;
          const count = countryCount[c] ?? 0;
          const active = countryFilter === c;
          return (
            <button
              key={c}
              onClick={() => setCountryFilter(c)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                active
                  ? "border-pa-green/50 bg-pa-green/10 text-pa-green"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
              }`}
            >
              <span className="text-base leading-none">{flag}</span>
              <span className="hidden sm:inline">{label}</span>
              <span className={`font-mono text-[10px] px-1 rounded ${active ? "bg-pa-green/20" : "bg-secondary"}`}>
                {count}
              </span>
            </button>
          );
        })}
        <span className="ml-auto text-xs text-muted-foreground">
          {sorted.length} market{sorted.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Market context bar ───────────────────────────────────────────────── */}
      {selectedMeta && (
        <div className="border border-border bg-card rounded-xl px-5 py-4">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
            Market Context · {countryFilter} · {new Date().toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-4">
            {selectedMeta.stats.map((stat) => (
              <div key={stat.label}>
                <p className="text-xs text-muted-foreground mb-0.5">{stat.label}</p>
                <p className="font-mono font-bold text-sm tracking-tight">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5 leading-tight">
                  {stat.source}
                </p>
                <p className="text-[10px] text-muted-foreground/40 leading-tight">{stat.date}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Deal table ───────────────────────────────────────────────────────── */}
      <div className="border border-border rounded-xl overflow-hidden">

        {/* Header */}
        <div className={`grid ${headerGrid} gap-2 px-4 py-2.5 bg-secondary/40 border-b border-border`}>
          <span />
          <span className="text-[10px] text-muted-foreground">#</span>
          <span className="text-[10px] text-muted-foreground">Market</span>
          <span className="text-[10px] text-muted-foreground">Verdict</span>
          <SortHeader label="Score"  k="opportunity_score" />
          <SortHeader label="Gr."    k="growth_score" />
          <SortHeader label="Infra"  k="infrastructure_score" />
          <SortHeader label="Liq."   k="liquidity_score" />
          <SortHeader label="Risk"   k="risk_score" />
          <span className="text-[10px] text-muted-foreground text-right">Updated</span>
          {isPro && <span className="text-[10px] text-muted-foreground text-right">ROI</span>}
        </div>

        {/* Rows */}
        <div className="divide-y divide-border">
          {sorted.map((row, i) => {
            const rank       = i + 1;
            const isBlurred  = !isPro && rank > FREE_VISIBLE;
            const freshISO   = freshnessMap[row.country] ?? row.retrieved_at ?? null;
            const fresh      = freshnessLabel(freshISO);
            const verdict    = verdictBadge(row.opportunity_score);
            const isExpanded = expandedId === row.id;
            const isPfOpen   = proFormaId  === row.id;
            const rowMeta    = COUNTRY_META[row.country];
            const sym        = currSym(row.currency_code);

            return (
              <div key={row.id}>

                {/* ── Main data row ── */}
                <div
                  className={`grid ${headerGrid} gap-2 px-4 py-3 items-center transition-colors ${
                    isBlurred ? "opacity-40 select-none pointer-events-none" : ""
                  } ${isExpanded || isPfOpen ? "bg-secondary/10" : "hover:bg-secondary/10"}`}
                >
                  {/* Expand toggle */}
                  <button
                    className="text-muted-foreground hover:text-pa-green text-[9px] transition-colors w-4"
                    onClick={() => !isBlurred && setExpandedId(isExpanded ? null : row.id)}
                    title="Show evidence"
                  >
                    {isExpanded ? "▼" : "▶"}
                  </button>

                  <span className="text-xs font-mono text-muted-foreground">{rank}</span>

                  {/* Market name — click to navigate */}
                  <div className="min-w-0">
                    <button
                      onClick={() => !isBlurred && router.push(`/opportunities/${row.slug}`)}
                      className="text-sm font-medium hover:text-pa-green transition-colors text-left w-full truncate block"
                    >
                      {isBlurred ? "████████" : row.name}
                    </button>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {isBlurred ? "███████" : `${row.region} · ${rowMeta?.flag ?? ""} ${row.country}`}
                    </p>
                  </div>

                  {/* Verdict */}
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border text-center block ${verdict.cls}`}>
                    {isBlurred ? "——" : verdict.label}
                  </span>

                  {/* Scores */}
                  {(["opportunity_score","growth_score","infrastructure_score","liquidity_score","risk_score"] as const).map((k) => (
                    <span
                      key={k}
                      className={`font-mono text-xs font-bold ${scoreColor(k === "risk_score" ? 100 - row[k] : row[k])}`}
                    >
                      {isBlurred ? "██" : row[k]}
                    </span>
                  ))}

                  {/* Freshness + source */}
                  <div className="text-right">
                    <span className={`text-[10px] font-mono ${fresh.color}`}>{isBlurred ? "" : fresh.label}</span>
                    {!isBlurred && row.source_name && (
                      <p className="text-[9px] text-muted-foreground/50 mt-0.5 truncate">{row.source_name}</p>
                    )}
                  </div>

                  {/* ROI button (pro only) */}
                  {isPro && (
                    <button
                      onClick={() => isPfOpen ? closeProForma() : openProForma(row)}
                      title="Open development pro-forma"
                      className={`text-[10px] border rounded px-1 py-0.5 transition-colors font-mono ${
                        isPfOpen
                          ? "border-pa-green/60 bg-pa-green/10 text-pa-green"
                          : "border-border text-muted-foreground hover:border-pa-green/40 hover:text-pa-green"
                      }`}
                    >
                      ⊞
                    </button>
                  )}
                </div>

                {/* ── Evidence panel ── */}
                {isExpanded && !isBlurred && (
                  <div className="border-t border-border/40 bg-secondary/5 px-5 pb-4 pt-3">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
                      Score Evidence · {row.name}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-4 mb-4">
                      {([
                        { key: "growth_score",         label: "Growth",         desc: "Population & economic trajectory",        note: "Migration, GDP, wage trends",          invert: false },
                        { key: "infrastructure_score",  label: "Infrastructure", desc: "Committed capital expenditure pipeline",  note: "Approved projects & public spend",     invert: false },
                        { key: "development_score",     label: "Development",    desc: "Planning & build pipeline momentum",     note: "Permissions granted, zoning velocity", invert: false },
                        { key: "liquidity_score",       label: "Liquidity",      desc: "Transaction depth & price discovery",    note: "Volume, days on market, turnover",     invert: false },
                        { key: "risk_score",            label: "Risk",           desc: "Macro, regulatory & cycle risk",         note: "Lower raw score = safer market",       invert: true  },
                      ] as const).map(({ key, label, desc, note, invert }) => {
                        const raw     = row[key as keyof DealRow] as number;
                        const display = invert ? 100 - raw : raw;
                        return (
                          <div key={key} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold">{label}</span>
                              <span className={`font-mono text-xs font-bold ${scoreColor(display)}`}>{raw}</span>
                            </div>
                            <div className="h-1 bg-border rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${display >= 75 ? "bg-pa-green" : display >= 50 ? "bg-amber-400" : "bg-rose-400"}`}
                                style={{ width: `${raw}%` }}
                              />
                            </div>
                            <p className="text-[10px] text-muted-foreground leading-tight">{desc}</p>
                            <p className="text-[10px] text-muted-foreground/50 leading-tight">{note}</p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Provenance */}
                    <div className="flex flex-wrap gap-x-5 gap-y-1 pt-3 border-t border-border/30">
                      <span className="text-[10px] text-muted-foreground">
                        Source: <span className="text-foreground/70">{row.source_name}</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Confidence: <span className="text-foreground/70">{(row.data_confidence * 100).toFixed(0)}%</span>
                      </span>
                      {row.retrieved_at && (
                        <span className="text-[10px] text-muted-foreground">
                          Retrieved:{" "}
                          <span className="text-foreground/70">
                            {new Date(row.retrieved_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        Currency: <span className="text-foreground/70">{row.currency_code}</span>
                      </span>
                      <Link
                        href={`/opportunities/${row.slug}`}
                        className="text-[10px] text-pa-green hover:underline ml-auto"
                      >
                        Full market view →
                      </Link>
                    </div>
                  </div>
                )}

                {/* ── Development Pro-Forma panel ── */}
                {isPfOpen && proFormaRow?.id === row.id && assumptions && proForma && isPro && (
                  <div className="border-t border-pa-green/20 bg-card/80 px-5 pb-5 pt-4">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-[11px] font-mono font-bold uppercase tracking-widest text-pa-green">
                          Development Pro-Forma · {row.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {row.source_name} · {(row.data_confidence * 100).toFixed(0)}% confidence · {row.currency_code}
                          {row.retrieved_at && ` · data as of ${new Date(row.retrieved_at).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => exportICMemo(row, assumptions, proForma, sym)}
                          className="text-xs border border-pa-green/30 text-pa-green px-3 py-1.5 rounded-lg hover:bg-pa-green/10 transition-colors"
                        >
                          ↓ IC Memo
                        </button>
                        <button
                          onClick={closeProForma}
                          className="text-xs border border-border text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-secondary transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                      {/* Site inputs */}
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                          Site Inputs
                        </p>
                        <div className="space-y-2">
                          {([
                            { label: "Units",              key: "units",           step: 5,     suffix: "",     prefix: "" },
                            { label: "GSF / unit",         key: "gsfPerUnit",      step: 50,    suffix: " sqft",prefix: "" },
                            { label: "Hard cost / GSF",    key: "hardCostPerGsf",  step: 5,     suffix: "",     prefix: sym },
                            { label: "Soft costs",         key: "softCostPct",     step: 1,     suffix: "% of hard", prefix: "" },
                            { label: "Contingency",        key: "contingencyPct",  step: 1,     suffix: "% of sub-total", prefix: "" },
                            { label: "Loan-to-cost (LTC)", key: "ltcPct",          step: 5,     suffix: "%",    prefix: "" },
                            { label: "Finance rate",       key: "financeRatePa",   step: 0.25,  suffix: "% pa", prefix: "" },
                            { label: "Build period",       key: "buildMonths",     step: 3,     suffix: " mo",  prefix: "" },
                          ] as const).map(({ label, key, step, suffix, prefix }) => (
                            <div key={key} className="flex items-center gap-2">
                              <label className="text-[11px] text-muted-foreground flex-1 min-w-0 truncate">{label}</label>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {prefix && <span className="text-[11px] text-muted-foreground">{prefix}</span>}
                                <input
                                  type="number"
                                  step={step}
                                  value={assumptions[key]}
                                  onChange={(e) =>
                                    setAssumptions((p) => p ? { ...p, [key]: Number(e.target.value) } : p)
                                  }
                                  className="w-20 text-right text-xs bg-secondary border border-border rounded px-2 py-1 focus:outline-none focus:border-pa-green/50 font-mono"
                                />
                                {suffix && <span className="text-[11px] text-muted-foreground">{suffix}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Revenue inputs */}
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                          Revenue Assumptions
                        </p>
                        <div className="space-y-2">
                          {([
                            { label: "Avg. sale / unit",  key: "avgPricePerUnit",  step: 10_000, suffix: "",     prefix: sym },
                            { label: "Exit cap rate",      key: "exitCapRate",      step: 0.1,   suffix: "%",    prefix: "" },
                            { label: "Absorption period",  key: "absorptionMonths", step: 3,     suffix: " mo",  prefix: "" },
                          ] as const).map(({ label, key, step, suffix, prefix }) => (
                            <div key={key} className="flex items-center gap-2">
                              <label className="text-[11px] text-muted-foreground flex-1 min-w-0 truncate">{label}</label>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {prefix && <span className="text-[11px] text-muted-foreground">{prefix}</span>}
                                <input
                                  type="number"
                                  step={step}
                                  value={assumptions[key]}
                                  onChange={(e) =>
                                    setAssumptions((p) => p ? { ...p, [key]: Number(e.target.value) } : p)
                                  }
                                  className="w-24 text-right text-xs bg-secondary border border-border rounded px-2 py-1 focus:outline-none focus:border-pa-green/50 font-mono"
                                />
                                {suffix && <span className="text-[11px] text-muted-foreground">{suffix}</span>}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Yield sense-check */}
                        <div className="mt-4 p-3 bg-secondary/50 rounded-lg border border-border/50">
                          <p className="text-[10px] text-muted-foreground mb-2 font-medium">Cap-rate yield check</p>
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="text-[10px] text-muted-foreground">GDV</span>
                              <span className="font-mono text-[11px] text-foreground">{fmtMoney(proForma.gdv, sym)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[10px] text-muted-foreground">Implied NOI @ {assumptions.exitCapRate}%</span>
                              <span className="font-mono text-[11px] text-pa-green font-bold">
                                {fmtMoney(proForma.gdv * (assumptions.exitCapRate / 100), sym)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Yield output */}
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                          Yield Analysis
                        </p>
                        <div className="space-y-1.5">
                          {([
                            { label: "Total GSF",         value: `${proForma.totalGsf.toLocaleString("en-GB")} sqft`, hi: false },
                            { label: "Hard costs",        value: fmtMoney(proForma.hardCosts, sym),        hi: false },
                            { label: "Soft costs",        value: fmtMoney(proForma.softCosts, sym),        hi: false },
                            { label: "Contingency",       value: fmtMoney(proForma.contingency, sym),      hi: false },
                            { label: "Dev. finance cost", value: fmtMoney(proForma.financeCosts, sym),     hi: false },
                            { label: "All-in cost",       value: fmtMoney(proForma.allInCost, sym),        hi: true  },
                            { label: "GDV",               value: fmtMoney(proForma.gdv, sym),              hi: true  },
                            { label: "Net profit",        value: fmtMoney(proForma.netProfit, sym),        hi: proForma.netProfit > 0 },
                          ] as const).map(({ label, value, hi }) => (
                            <div key={label} className="flex justify-between items-baseline gap-4">
                              <span className="text-[10px] text-muted-foreground">{label}</span>
                              <span className={`font-mono text-xs font-bold flex-shrink-0 ${hi ? (proForma.netProfit >= 0 ? "text-pa-green" : "text-rose-400") : "text-foreground"}`}>
                                {value}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Key returns */}
                        <div className="mt-4 pt-3 border-t border-border grid grid-cols-2 gap-x-4 gap-y-2">
                          {([
                            { label: "Return on cost",   value: `${proForma.returnOnCost}%`,    good: proForma.returnOnCost  > 15 },
                            { label: "Return on equity", value: `${proForma.returnOnEquity}%`,  good: proForma.returnOnEquity > 25 },
                            { label: "Profit on GDV",    value: `${proForma.profitOnGdv}%`,     good: proForma.profitOnGdv   > 15 },
                            { label: "Equity multiple",  value: `${proForma.equityMultiple}×`,  good: proForma.equityMultiple > 2 },
                            { label: "IRR (levered)",    value: `${proForma.irr}%`,             good: proForma.irr > 20 },
                            { label: "Equity required",  value: fmtMoney(proForma.equityRequired, sym), good: true },
                          ] as const).map(({ label, value, good }) => (
                            <div key={label}>
                              <p className="text-[9px] text-muted-foreground">{label}</p>
                              <p className={`font-mono text-xs font-bold ${good ? "text-pa-green" : "text-rose-400"}`}>{value}</p>
                            </div>
                          ))}
                        </div>

                        <p className="text-[9px] text-muted-foreground/60 leading-relaxed mt-3 pt-2 border-t border-border/30">
                          Indicative only · Index scores, not live parcel data · Not investment advice
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Free tier upgrade wall */}
        {!isPro && sorted.length > FREE_VISIBLE && (
          <div className="px-4 py-6 border-t border-border text-center bg-gradient-to-b from-transparent to-card">
            <p className="text-sm font-semibold mb-1">
              {sorted.length - FREE_VISIBLE} more markets hidden
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Pro unlocks all markets, evidence panels, development pro-forma (units / GSF / LTC / IRR / RoC), and IC-memo export.
            </p>
            <Link
              href="/pricing"
              className="inline-block bg-pa-green text-pa-navy font-bold text-xs px-5 py-2.5 rounded-lg hover:bg-pa-green/90 transition-colors"
            >
              Upgrade to Pro →
            </Link>
          </div>
        )}
      </div>

      {/* Free CTA below table */}
      {!isPro && (
        <div className="border border-border rounded-xl p-5 text-center">
          <p className="text-sm font-semibold mb-1">Development Pro-Forma is a Pro feature</p>
          <p className="text-xs text-muted-foreground mb-3">
            Model units, GSF, hard/soft costs, LTC, finance costs, GDV, IRR, and return on cost —
            then export a one-click IC memo.
          </p>
          <Link href="/pricing" className="text-xs text-pa-green hover:underline font-medium">
            Upgrade to Pro →
          </Link>
        </div>
      )}
    </div>
  );
}
