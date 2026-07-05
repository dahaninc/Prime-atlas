"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { generateMarketReport } from "./actions";
import type { MarketReport } from "@/lib/marketReport";
import { toast } from "@/components/ui/Toaster";

interface MarketOption { id: string; name: string; region: string; country: string }
interface PastReport { id: string; created_at: string; payload: MarketReport }

interface Props {
  markets: MarketOption[];
  pastReports: PastReport[];
  quotaUsed: number;
  quotaLimit: number;
  unlimited: boolean;
}

const money = (n: number, sym: string) =>
  Math.abs(n) >= 1_000_000 ? `${sym}${(n / 1_000_000).toFixed(2)}M`
  : Math.abs(n) >= 1_000   ? `${sym}${Math.round(n / 1_000).toLocaleString()}K`
  :                          `${sym}${Math.round(n).toLocaleString()}`;

const READING_STYLE: Record<string, string> = {
  strong:  "text-emerald-400 border-emerald-500/25 bg-emerald-500/10",
  neutral: "text-zinc-300 border-border bg-secondary",
  soft:    "text-amber-400 border-amber-500/25 bg-amber-500/10",
};

/** Inline sparkline for weekly opportunity-score snapshots. */
function Sparkline({ points }: { points: { opportunity: number }[] }) {
  if (points.length < 2) return <span className="text-xs text-zinc-500">Building history — snapshots are weekly</span>;
  const vals = points.map((p) => p.opportunity);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const w = 220, h = 44;
  const coords = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - 4 - ((v - min) / range) * (h - 8)}`).join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible" role="img" aria-label="Opportunity score trend">
      <polyline points={coords} fill="none" stroke="var(--primary, #2563eb)" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export function ReportClient({ markets, pastReports, quotaUsed, quotaLimit, unlimited }: Props) {
  const [marketId, setMarketId] = useState(markets[0]?.id ?? "");
  const [report, setReport] = useState<MarketReport | null>(pastReports[0]?.payload ?? null);
  const [used, setUsed] = useState(quotaUsed);
  const [pending, start] = useTransition();

  const quotaLeft = unlimited ? Infinity : Math.max(0, quotaLimit - used);

  function onGenerate() {
    if (!marketId) return;
    start(async () => {
      const res = await generateMarketReport(marketId);
      if (!res.ok) {
        toast(res.error === "quota_exceeded"
          ? `Free plan: ${quotaLimit} reports used — upgrade for unlimited`
          : "Could not generate the report", "error");
        return;
      }
      setReport(res.report);
      setUsed((u) => u + 1);
      toast("Report generated");
    });
  }

  const sym = report?.market.currencySymbol ?? "$";

  return (
    <div className="space-y-6">
      {/* Generator bar */}
      <div className="border border-border rounded-xl bg-card p-5 flex items-end gap-4 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-[10px] text-muted-foreground mb-1">Market</label>
          <select
            value={marketId}
            onChange={(e) => setMarketId(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/60"
          >
            {markets.map((m) => (
              <option key={m.id} value={m.id}>
                {m.country === "United Kingdom" ? "🇬🇧" : "🇺🇸"} {m.name} — {m.region}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={onGenerate}
          disabled={pending || quotaLeft <= 0}
          className="bg-primary text-white font-semibold text-sm px-6 py-2.5 rounded-lg hover:bg-primary/85 transition-colors disabled:opacity-50"
        >
          {pending ? "Computing…" : "Generate market report"}
        </button>
        <div className="text-xs text-muted-foreground pb-2.5">
          {unlimited
            ? "Unlimited reports on your plan"
            : quotaLeft > 0
            ? `${quotaLeft} of ${quotaLimit} free reports left`
            : <>Free reports used — <Link href="/pricing" className="text-primary hover:underline">upgrade for unlimited</Link></>}
        </div>
      </div>

      {report && (
        <div className="space-y-4">
          {/* Header */}
          <div className="border border-border rounded-xl bg-card p-5">
            <p className="kicker text-primary mb-1">Prime Atlas market report · proprietary metrics</p>
            <h2 className="text-xl font-bold">
              {report.market.country === "United Kingdom" ? "🇬🇧" : "🇺🇸"} {report.market.name}
              <span className="text-muted-foreground font-normal text-sm ml-2">{report.market.region}</span>
            </h2>
            <p className="text-[10px] text-zinc-500 font-mono mt-1">
              generated {new Date(report.generatedAt).toLocaleString("en-GB")}
            </p>
          </div>

          {/* Conviction scores */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {([
              ["Opportunity", report.scores.opportunity],
              ["Growth", report.scores.growth],
              ["Risk", report.scores.risk],
              ["Development", report.scores.development],
              ["Infrastructure", report.scores.infrastructure],
              ["Liquidity", report.scores.liquidity],
            ] as const).map(([label, v]) => (
              <div key={label} className="border border-border rounded-xl bg-card px-4 py-3">
                <div className="text-[10px] text-muted-foreground mb-1">{label}</div>
                <div className="text-xl font-bold font-mono tabular-nums">{Math.round(v)}</div>
              </div>
            ))}
          </div>

          {/* Momentum + inventory */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="border border-border rounded-xl bg-card p-5">
              <p className="kicker mb-3">Score momentum · weekly snapshots</p>
              <Sparkline points={report.momentum} />
              {report.momentumDeltaPts != null && (
                <p className={`text-xs font-mono mt-2 ${report.momentumDeltaPts >= 0 ? "text-emerald-400" : "text-amber-400"}`}>
                  {report.momentumDeltaPts >= 0 ? "▲" : "▼"} {Math.abs(report.momentumDeltaPts).toFixed(1)} pts over tracked window
                </p>
              )}
            </div>
            <div className="border border-border rounded-xl bg-card p-5">
              <p className="kicker mb-3">Live inventory</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div><span className="text-muted-foreground text-xs block">Sale listings</span><span className="font-mono font-bold">{report.inventory.saleCount.toLocaleString()}</span></div>
                <div><span className="text-muted-foreground text-xs block">Rent listings</span><span className="font-mono font-bold">{report.inventory.rentCount.toLocaleString()}</span></div>
                <div><span className="text-muted-foreground text-xs block">Median price</span><span className="font-mono font-bold">{report.inventory.medianPrice != null ? money(report.inventory.medianPrice, sym) : "—"}</span></div>
                <div><span className="text-muted-foreground text-xs block">Median /sqm</span><span className="font-mono font-bold">{report.inventory.medianPpsqm != null ? money(report.inventory.medianPpsqm, sym) : "—"}</span></div>
                <div><span className="text-muted-foreground text-xs block">Flagged underpriced</span><span className="font-mono font-bold text-pa-amber">{report.inventory.underpricedCount}</span></div>
                <div><span className="text-muted-foreground text-xs block">Underpriced share</span><span className="font-mono font-bold">{report.inventory.underpricedSharePct != null ? `${report.inventory.underpricedSharePct.toFixed(1)}%` : "—"}</span></div>
              </div>
            </div>
          </div>

          {/* Demand signals */}
          <div className="border border-border rounded-xl bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <p className="kicker">Demand signals · micro &amp; macro reading</p>
            </div>
            <div className="divide-y divide-border">
              {report.demandSignals.length === 0 && (
                <p className="px-5 py-4 text-sm text-muted-foreground">Not enough live data in this market yet — signals appear as coverage deepens.</p>
              )}
              {report.demandSignals.map((s) => (
                <div key={s.label} className="px-5 py-3.5 flex items-start gap-4">
                  <span className={`text-[10px] font-bold uppercase tracking-wider border rounded-full px-2 py-0.5 mt-0.5 shrink-0 ${READING_STYLE[s.reading]}`}>
                    {s.reading}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <span className="text-sm font-semibold">{s.label}</span>
                      <span className="text-xs font-mono text-muted-foreground">{s.value}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{s.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rate implications */}
          {report.rate.scenarios.length > 0 && (
            <div className="border border-border rounded-xl bg-card p-5">
              <p className="kicker mb-1">Interest-rate implications · 3 / 5 / 10 year horizons</p>
              <p className="text-[10px] text-zinc-500 mb-4 leading-relaxed max-w-3xl">{report.rate.assumptions}</p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse font-mono text-xs min-w-[560px]">
                  <thead>
                    <tr>
                      <th className="border border-border bg-background px-2 py-1.5 text-muted-foreground font-normal text-left text-[10px]">financing rate</th>
                      <th className="border border-border bg-background px-2 py-1.5 text-muted-foreground font-normal text-right text-[10px]">debt service /yr</th>
                      <th className="border border-border bg-background px-2 py-1.5 text-muted-foreground font-normal text-right text-[10px]">breakeven yield</th>
                      {[3, 5, 10].map((y) => (
                        <th key={y} className="border border-border bg-background px-2 py-1.5 text-muted-foreground font-normal text-right text-[10px]">
                          {y}yr interest · value drift
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.rate.scenarios.map((s) => {
                      const isBase = s.ratePct === report.rate.baseRatePct;
                      return (
                        <tr key={s.ratePct}>
                          <td className={`border px-2 py-1.5 ${isBase ? "border-primary/50 bg-primary/10 text-primary font-bold" : "border-border text-muted-foreground"}`}>
                            {s.ratePct.toFixed(2)}%{isBase ? " · base" : ""}
                          </td>
                          <td className="border border-border px-2 py-1.5 text-right tabular-nums">{money(s.annualDebtService, sym)}</td>
                          <td className="border border-border px-2 py-1.5 text-right tabular-nums">{s.breakevenYieldPct.toFixed(2)}%</td>
                          {s.horizons.map((h) => (
                            <td key={h.years} className="border border-border px-2 py-1.5 text-right tabular-nums">
                              {money(h.cumulativeInterest, sym)}
                              <span className={`ml-1 ${h.impliedValueDeltaPct > 0.5 ? "text-emerald-400" : h.impliedValueDeltaPct < -0.5 ? "text-amber-400" : "text-zinc-500"}`}>
                                {h.impliedValueDeltaPct >= 0 ? "+" : ""}{h.impliedValueDeltaPct.toFixed(1)}%
                              </span>
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="text-[10px] text-zinc-500 leading-relaxed">{report.disclaimer}</p>
        </div>
      )}

      {/* Report history */}
      {pastReports.length > 0 && (
        <div className="border border-border rounded-xl bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <p className="kicker">Your report history</p>
          </div>
          <div className="divide-y divide-border">
            {pastReports.map((r) => (
              <button
                key={r.id}
                onClick={() => setReport(r.payload)}
                className="w-full text-left px-5 py-3 hover:bg-secondary/50 transition-colors flex items-baseline justify-between gap-4"
              >
                <span className="text-sm font-semibold truncate">
                  {r.payload.market.name}
                  <span className="text-muted-foreground font-normal text-xs ml-2">{r.payload.market.region}</span>
                </span>
                <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                  {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
