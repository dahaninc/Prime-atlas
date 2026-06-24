"use client";

/**
 * DealBoard — Phase 2 UI
 *
 * Ranked, sortable table of municipalities/markets.
 * - Free users: top 5 unblurred, rank 6+ blurred with upgrade CTA
 * - Pro+: all rows, pro-forma panel, IC-memo export
 * - Freshness chips on every score cell
 */

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ── Types ────────────────────────────────────────────────────────────────────

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

interface ProFormaAssumptions {
  investmentGbp: number;
  holdYears: number;
  annualRentYield: number;   // %
  capitalGrowthPa: number;   // %
  acquisitionCosts: number;  // %
  exitCosts: number;         // %
}

interface DealBoardProps {
  rows: DealRow[];
  tier: "free" | "pro" | "investor" | "institutional";
  freshnessMap: Record<string, string>; // market_iso2 → last_updated ISO
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const FREE_VISIBLE = 5;

function scoreColor(n: number): string {
  if (n >= 75) return "text-pa-green";
  if (n >= 50) return "text-amber-400";
  return "text-rose-400";
}

function freshnessLabel(iso: string | null): { label: string; color: string } {
  if (!iso) return { label: "No data", color: "text-muted-foreground" };
  const days = Math.floor(
    (Date.now() - new Date(iso).getTime()) / 86400000
  );
  if (days === 0) return { label: "Today",    color: "text-pa-green" };
  if (days <= 7)  return { label: `${days}d`,  color: "text-pa-green" };
  if (days <= 30) return { label: `${days}d`,  color: "text-amber-400" };
  return { label: `${Math.floor(days / 30)}mo`, color: "text-rose-400" };
}

function computeROI(a: ProFormaAssumptions): {
  totalReturn: number;
  irr: number;
  exitValue: number;
  totalRent: number;
} {
  const principal = a.investmentGbp;
  const acqCost = principal * (a.acquisitionCosts / 100);
  const deployed = principal + acqCost;

  const exitValue =
    deployed * Math.pow(1 + a.capitalGrowthPa / 100, a.holdYears);
  const totalRent =
    deployed * (a.annualRentYield / 100) * a.holdYears;
  const exitCost = exitValue * (a.exitCosts / 100);
  const proceeds = exitValue - exitCost + totalRent;
  const totalReturn = ((proceeds - deployed) / deployed) * 100;

  // Simplified IRR via Newton's method
  let irr = 0.1;
  for (let i = 0; i < 100; i++) {
    const npv =
      -deployed +
      totalRent / ((1 + irr) * a.holdYears) + // approx rent as lump
      proceeds / Math.pow(1 + irr, a.holdYears);
    const dnpv =
      -(totalRent * a.holdYears) / Math.pow(1 + irr, a.holdYears + 1) -
      (a.holdYears * proceeds) / Math.pow(1 + irr, a.holdYears + 1);
    const delta = npv / dnpv;
    irr -= delta;
    if (Math.abs(delta) < 1e-7) break;
  }

  return {
    totalReturn: Math.round(totalReturn * 10) / 10,
    irr: Math.round(irr * 1000) / 10,
    exitValue: Math.round(exitValue),
    totalRent: Math.round(totalRent),
  };
}

// ── IC Memo export ────────────────────────────────────────────────────────────

function exportICMemo(
  row: DealRow,
  assumptions: ProFormaAssumptions,
  roi: ReturnType<typeof computeROI>
): void {
  const symbol =
    row.currency_code === "GBP" ? "£" :
    row.currency_code === "USD" ? "$" : "€";

  const csv = [
    ["prime-atlas IC Memo", ""],
    ["Generated", new Date().toISOString()],
    [""],
    ["Market",   row.name],
    ["Region",   row.region],
    ["Country",  row.country],
    ["Data source", row.source_name],
    ["Data freshness", row.retrieved_at ?? "—"],
    ["Data confidence", `${(row.data_confidence * 100).toFixed(0)}%`],
    [""],
    ["SCORES"],
    ["Opportunity Score", row.opportunity_score],
    ["Growth Score",      row.growth_score],
    ["Infrastructure",   row.infrastructure_score],
    ["Development",      row.development_score],
    ["Liquidity",        row.liquidity_score],
    ["Risk Score",       row.risk_score],
    [""],
    ["PRO-FORMA ASSUMPTIONS"],
    ["Investment",       `${symbol}${assumptions.investmentGbp.toLocaleString()}`],
    ["Hold period",      `${assumptions.holdYears} years`],
    ["Annual rent yield",`${assumptions.annualRentYield}%`],
    ["Capital growth pa",`${assumptions.capitalGrowthPa}%`],
    ["Acquisition costs",`${assumptions.acquisitionCosts}%`],
    ["Exit costs",       `${assumptions.exitCosts}%`],
    [""],
    ["ROI ANALYSIS"],
    ["Total return",     `${roi.totalReturn}%`],
    ["Estimated IRR",    `${roi.irr}%`],
    ["Exit value",       `${symbol}${roi.exitValue.toLocaleString()}`],
    ["Total rent income",`${symbol}${roi.totalRent.toLocaleString()}`],
    [""],
    ["DISCLAIMER"],
    ["This analysis is indicative only.", ""],
    ["Scores are derived from publicly available data.", ""],
    ["prime-atlas does not provide investment advice.", ""],
  ]
    .map((r) => r.map((c) => `"${c}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `prime-atlas-ic-memo-${row.slug}-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Sort control ──────────────────────────────────────────────────────────────

type SortKey =
  | "opportunity_score"
  | "growth_score"
  | "infrastructure_score"
  | "liquidity_score"
  | "risk_score";

// ── Main component ────────────────────────────────────────────────────────────

export function DealBoard({ rows, tier, freshnessMap }: DealBoardProps) {
  const isPro = tier !== "free";
  const router = useRouter();

  const [sortKey, setSortKey]           = useState<SortKey>("opportunity_score");
  const [sortDir, setSortDir]           = useState<"desc" | "asc">("desc");
  const [marketFilter, setMarketFilter] = useState<string>("all");
  const [selectedRow, setSelectedRow]   = useState<DealRow | null>(null);

  const [assumptions, setAssumptions] = useState<ProFormaAssumptions>({
    investmentGbp:  500_000,
    holdYears:      5,
    annualRentYield: 5,
    capitalGrowthPa: 4,
    acquisitionCosts: 4,
    exitCosts: 2,
  });

  const roi = useMemo(
    () => (selectedRow ? computeROI(assumptions) : null),
    [selectedRow, assumptions]
  );

  const markets = useMemo(
    () => ["all", ...Array.from(new Set(rows.map((r) => r.country)))],
    [rows]
  );

  const sorted = useMemo(() => {
    const filtered =
      marketFilter === "all"
        ? rows
        : rows.filter((r) => r.country === marketFilter);

    return [...filtered].sort((a, b) => {
      const mult = sortDir === "desc" ? -1 : 1;
      // For risk: lower = better, so invert
      const av = sortKey === "risk_score" ? 100 - a[sortKey] : a[sortKey];
      const bv = sortKey === "risk_score" ? 100 - b[sortKey] : b[sortKey];
      return mult * (bv - av);
    });
  }, [rows, sortKey, sortDir, marketFilter]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function SortHeader({
    label,
    k,
  }: {
    label: string;
    k: SortKey;
  }) {
    const active = sortKey === k;
    return (
      <button
        onClick={() => toggleSort(k)}
        className={`flex items-center gap-1 text-xs font-medium transition-colors ${
          active ? "text-pa-green" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {label}
        <span className="font-mono text-[10px]">
          {active ? (sortDir === "desc" ? "↓" : "↑") : "↕"}
        </span>
      </button>
    );
  }

  const symbolFor = (c: string) =>
    c === "GBP" ? "£" : c === "USD" ? "$" : "€";

  return (
    <div className="space-y-4">
      {/* ── Controls ── */}
      <div className="flex flex-wrap items-center gap-3">
        {markets.map((m) => (
          <button
            key={m}
            onClick={() => setMarketFilter(m)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors capitalize ${
              marketFilter === m
                ? "border-pa-green/40 bg-pa-green/10 text-pa-green"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {m === "all" ? "All markets" : m}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {sorted.length} market{sorted.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Table ── */}
      <div className="border border-border rounded-xl overflow-hidden">
        {/* Header */}
        <div className={`grid gap-2 px-4 py-3 bg-secondary/40 border-b border-border ${isPro ? "grid-cols-[2rem_1fr_4rem_4rem_4rem_4rem_4rem_5rem_3rem]" : "grid-cols-[2rem_1fr_4rem_4rem_4rem_4rem_4rem_5rem]"}`}>
          <span className="text-xs text-muted-foreground">#</span>
          <span className="text-xs text-muted-foreground">Market</span>
          <SortHeader label="Score"  k="opportunity_score" />
          <SortHeader label="Growth" k="growth_score" />
          <SortHeader label="Infra"  k="infrastructure_score" />
          <SortHeader label="Liq."   k="liquidity_score" />
          <SortHeader label="Risk"   k="risk_score" />
          <span className="text-xs text-muted-foreground text-right">Freshness</span>
          {isPro && <span className="text-xs text-muted-foreground text-right">ROI</span>}
        </div>

        {/* Rows */}
        <div className="divide-y divide-border">
          {sorted.map((row, i) => {
            const rank = i + 1;
            const isBlurred = !isPro && rank > FREE_VISIBLE;
            const freshISO =
              freshnessMap[row.country] ?? row.retrieved_at ?? null;
            const fresh = freshnessLabel(freshISO);

            return (
              <div
                key={row.id}
                className={`grid gap-2 px-4 py-3 items-center transition-colors ${
                  isPro
                    ? "grid-cols-[2rem_1fr_4rem_4rem_4rem_4rem_4rem_5rem_3rem]"
                    : "grid-cols-[2rem_1fr_4rem_4rem_4rem_4rem_4rem_5rem]"
                } ${
                  isBlurred
                    ? "opacity-40 select-none pointer-events-none"
                    : "hover:bg-secondary/20 cursor-pointer"
                } ${selectedRow?.id === row.id ? "bg-secondary/30" : ""}`}
                onClick={() => {
                  if (!isBlurred) router.push(`/opportunities/${row.slug}`);
                }}
              >
                <span className="text-xs font-mono text-muted-foreground">
                  {rank}
                </span>

                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {isBlurred ? "████████" : row.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isBlurred ? "███████" : `${row.region} · ${row.country}`}
                  </p>
                </div>

                {/* Scores */}
                {(["opportunity_score","growth_score","infrastructure_score","liquidity_score","risk_score"] as const).map((k) => (
                  <span
                    key={k}
                    className={`font-mono text-xs font-bold ${scoreColor(k === "risk_score" ? 100 - row[k] : row[k])}`}
                  >
                    {isBlurred ? "██" : row[k]}
                  </span>
                ))}

                {/* Freshness chip */}
                <span className={`text-[10px] font-mono text-right ${fresh.color}`}>
                  {isBlurred ? "" : fresh.label}
                </span>

                {/* ROI model button — pro only */}
                {isPro && (
                  <button
                    className={`text-[10px] border rounded px-1 py-0.5 transition-colors text-right ${
                      selectedRow?.id === row.id
                        ? "border-pa-green/60 bg-pa-green/10 text-pa-green"
                        : "border-border text-muted-foreground hover:border-pa-green/40 hover:text-pa-green"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedRow(row.id === selectedRow?.id ? null : row);
                    }}
                  >
                    ⊞
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Blur upgrade wall for free tier */}
        {!isPro && sorted.length > FREE_VISIBLE && (
          <div className="px-4 py-5 border-t border-border text-center bg-gradient-to-b from-transparent to-card">
            <p className="text-sm font-semibold mb-1">
              {sorted.length - FREE_VISIBLE} more markets hidden
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              Pro unlocks all markets, pro-forma modelling, and IC-memo export.
            </p>
            <Link
              href="/pricing"
              className="inline-block bg-pa-green text-pa-navy font-bold text-xs px-5 py-2 rounded-lg hover:bg-pa-green/90 transition-colors"
            >
              Upgrade to Pro →
            </Link>
          </div>
        )}
      </div>

      {/* ── Pro-forma panel ── */}
      {selectedRow && isPro && roi && (
        <div className="border border-pa-green/20 bg-card rounded-xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-0.5">
                Pro-forma · {selectedRow.name}
              </p>
              <p className="text-xs text-muted-foreground">
                Source: {selectedRow.source_name} ·{" "}
                Data confidence: {(selectedRow.data_confidence * 100).toFixed(0)}%
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => roi && exportICMemo(selectedRow, assumptions, roi)}
                className="text-xs border border-pa-green/30 text-pa-green px-3 py-1.5 rounded-lg hover:bg-pa-green/10 transition-colors"
              >
                ↓ IC Memo
              </button>
              <button
                onClick={() => setSelectedRow(null)}
                className="text-xs border border-border text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-secondary transition-colors"
              >
                Close
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Assumptions */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Assumptions
              </p>

              {[
                { label: "Investment",         key: "investmentGbp",     step: 10000, prefix: symbolFor(selectedRow.currency_code) },
                { label: "Hold period (yrs)",  key: "holdYears",         step: 1 },
                { label: "Rent yield (%pa)",   key: "annualRentYield",   step: 0.5 },
                { label: "Capital growth (%pa)", key: "capitalGrowthPa", step: 0.5 },
                { label: "Acquisition costs (%)", key: "acquisitionCosts", step: 0.5 },
                { label: "Exit costs (%)",     key: "exitCosts",         step: 0.5 },
              ].map(({ label, key, step, prefix }) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <label className="text-xs text-muted-foreground flex-1">{label}</label>
                  <div className="flex items-center gap-1">
                    {prefix && <span className="text-xs text-muted-foreground">{prefix}</span>}
                    <input
                      type="number"
                      step={step}
                      value={assumptions[key as keyof ProFormaAssumptions]}
                      onChange={(e) =>
                        setAssumptions((prev) => ({
                          ...prev,
                          [key]: Number(e.target.value),
                        }))
                      }
                      className="w-20 text-right text-sm bg-secondary border border-border rounded px-2 py-1 focus:outline-none focus:border-pa-green/50"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* ROI output */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                ROI Feasibility Index™
              </p>
              {[
                { label: "Total return",     value: `${roi.totalReturn}%`,   highlight: roi.totalReturn > 0 },
                { label: "Estimated IRR",    value: `${roi.irr}%`,           highlight: roi.irr > 0 },
                { label: "Exit value",       value: `${symbolFor(selectedRow.currency_code)}${roi.exitValue.toLocaleString()}`,     highlight: true },
                { label: "Rent income",      value: `${symbolFor(selectedRow.currency_code)}${roi.totalRent.toLocaleString()}`,     highlight: false },
              ].map(({ label, value, highlight }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className={`font-mono font-bold text-sm ${highlight ? "text-pa-green" : "text-foreground"}`}>
                    {value}
                  </span>
                </div>
              ))}

              <div className="pt-3 border-t border-border">
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Indicative only. Based on static index scores — not live market data.
                  prime-atlas does not provide investment advice. Scores derived from{" "}
                  {selectedRow.source_name}.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Prompt free users to select a row */}
      {selectedRow && !isPro && (
        <div className="border border-border rounded-xl p-5 text-center">
          <p className="text-sm font-semibold mb-1">Pro-forma modelling is a Pro feature</p>
          <Link href="/pricing" className="text-xs text-pa-green hover:underline">
            Upgrade to run ROI Feasibility Index™ →
          </Link>
        </div>
      )}
    </div>
  );
}
