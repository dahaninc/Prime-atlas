/**
 * /s/[token] — public read-only share page for a screener analysis or a
 * market report. This page IS the product demo: the sender forwards it to
 * an LP / lender / co-GP, the recipient sees institutional-grade analytics
 * on live data, and the only wall is "run your own".
 *
 * Resolved via service role (no anonymous RLS on share_links — tokens are
 * the capability). No PII beyond what the artifact itself contains; deal
 * analyses are the sharer's own inputs, reports are market-level.
 */

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import type { Database } from "@/lib/supabase/database.types";
import {
  computeScreener, screenerSensitivity, US_DEFAULT_INPUTS,
  SCORECARD_DISCLAIMER, type ScreenerInputs, type ScorecardLine,
} from "@/lib/screener";
import { computeValueLevers } from "@/lib/levers";
import type { MarketReport } from "@/lib/marketReport";

export const dynamic = "force-dynamic";

const admin = () =>
  createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

const resolveShare = cache(async (token: string) => {
  const db = admin();
  const { data: link } = await db
    .from("share_links")
    .select("id, kind, ref_id, revoked, view_count")
    .eq("token", token)
    .maybeSingle();
  if (!link || link.revoked) return null;

  if (link.kind === "analysis") {
    const { data } = await db
      .from("screener_analyses")
      .select("name, created_at, inputs, outputs, scorecard")
      .eq("id", link.ref_id)
      .maybeSingle();
    return data ? { link, kind: "analysis" as const, analysis: data } : null;
  }
  const { data } = await db
    .from("deal_board_reports")
    .select("created_at, payload")
    .eq("id", link.ref_id)
    .maybeSingle();
  return data ? { link, kind: "report" as const, report: data } : null;
});

export async function generateMetadata(
  { params }: { params: Promise<{ token: string }> },
): Promise<Metadata> {
  const { token } = await params;
  const res = await resolveShare(token);
  if (!res) return { title: "Shared analysis | Prime Atlas", robots: { index: false } };

  if (res.kind === "analysis") {
    const o = (res.analysis.outputs ?? {}) as Record<string, number>;
    return {
      title: `${res.analysis.name ?? "Deal analysis"} | Prime Atlas`,
      description: `Cap rate ${Number(o.capRate ?? 0).toFixed(2)}% · DSCR ${Number(o.dscr ?? 0).toFixed(2)}x · Cash-on-cash ${Number(o.cashOnCash ?? 0).toFixed(1)}% — full pro-forma, sensitivity grid and value levers on Prime Atlas.`,
      robots: { index: false },
    };
  }
  const p = res.report.payload as unknown as MarketReport;
  return {
    title: `${p.market.name} market report | Prime Atlas`,
    description: `${p.market.name}, ${p.market.region} — conviction scores, live inventory analytics, demand signals, and 3/5/10-year rate implications. Prime Atlas market intelligence.`,
    robots: { index: false },
  };
}

const money = (n: number, sym = "$") =>
  Math.abs(n) >= 1_000_000 ? `${sym}${(n / 1_000_000).toFixed(2)}M`
  : Math.abs(n) >= 1_000   ? `${sym}${Math.round(n / 1_000).toLocaleString()}K`
  :                          `${sym}${Math.round(n).toLocaleString()}`;

function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="kicker mb-3">{children}</p>;
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="border border-border rounded-xl bg-card px-4 py-3">
      <div className="text-[10px] text-muted-foreground mb-1">{label}</div>
      <div className={`text-xl font-bold font-mono tabular-nums ${accent ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}

function SignupCta({ kind }: { kind: "analysis" | "report" }) {
  return (
    <div className="border border-primary/25 bg-primary/10 rounded-2xl p-8 text-center">
      <p className="kicker mb-3">Prime Atlas</p>
      <h2 className="text-xl font-bold mb-2">
        {kind === "analysis"
          ? "Screen your own deal in 90 seconds"
          : "Pull this intelligence for any of 32 US & UK markets"}
      </h2>
      <p className="text-sm text-muted-foreground max-w-lg mx-auto mb-5">
        {kind === "analysis"
          ? "Drop an OM or rent roll, get an editable pro-forma, score it against your own criteria, and see exactly which lever moves your return."
          : "Conviction scores, live inventory and mispricing analytics, demand signals, and rate scenarios — recomputed from live market data."}
      </p>
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <Link href="/auth/signup" className="bg-primary text-white font-semibold text-sm px-6 py-2.5 rounded-lg hover:bg-primary/85 transition-colors">
          Start free
        </Link>
        <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground px-3 py-2.5 transition-colors">
          See plans →
        </Link>
      </div>
    </div>
  );
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const res = await resolveShare(token);
  if (!res) notFound();

  // Count the view (fire-and-forget analytics for the sharer).
  admin().from("share_links").update({ view_count: res.link.view_count + 1 }).eq("id", res.link.id)
    .then(() => undefined, () => undefined);

  const dateStr = new Date(
    res.kind === "analysis" ? res.analysis.created_at : res.report.created_at,
  ).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <main className="min-h-screen bg-background">
      {/* Chrome */}
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-black tracking-[0.2em] text-sm">PRIME ATLAS</Link>
          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
            Shared intelligence · read-only · {dateStr}
          </span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        {res.kind === "analysis" ? <AnalysisView a={res.analysis} /> : <ReportView p={res.report.payload as unknown as MarketReport} />}

        <SignupCta kind={res.kind} />

        <p className="text-[10px] text-zinc-500 leading-relaxed text-center pb-8">
          Shared via Prime Atlas by one of its members. All figures are deterministic calculations
          from the inputs and live market data shown. {SCORECARD_DISCLAIMER}
        </p>
      </div>
    </main>
  );
}

/* ── Analysis view — pro-forma + sensitivity + scorecard + value levers ─── */

function AnalysisView({ a }: {
  a: { name: string | null; inputs: unknown; outputs: unknown; scorecard: unknown };
}) {
  const inputs: ScreenerInputs = { ...US_DEFAULT_INPUTS, ...(a.inputs as Partial<ScreenerInputs>) };
  const out = computeScreener(inputs);
  const sens = screenerSensitivity(inputs);
  const levers = computeValueLevers(inputs);
  const scorecard = (Array.isArray(a.scorecard) ? a.scorecard : []) as ScorecardLine[];
  const passCount = scorecard.filter((l) => l.pass).length;

  return (
    <>
      <div>
        <p className="kicker text-primary mb-1">Acquisition screen · US module</p>
        <h1 className="text-2xl sm:text-3xl font-bold">{a.name || "Deal analysis"}</h1>
      </div>

      {/* Headline metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Metric label="NOI (yr 1)" value={money(out.noi)} />
        <Metric label="Cap rate" value={`${out.capRate.toFixed(2)}%`} accent />
        <Metric label="DSCR" value={`${out.dscr.toFixed(2)}x`} />
        <Metric label="Cash-on-cash" value={`${out.cashOnCash.toFixed(1)}%`} accent />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Metric label="Price / unit" value={money(out.pricePerUnit)} />
        <Metric label="Equity in" value={money(out.equity)} />
        <Metric label="Debt service / yr" value={money(out.annualDebtService)} />
        <Metric label={`Exit value (${inputs.holdYears}yr)`} value={money(out.exitValue)} />
      </div>

      {/* Scorecard */}
      {scorecard.length > 0 && (
        <div className="border border-border rounded-xl bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <Kicker>Scorecard vs the sharer&apos;s criteria</Kicker>
            <span className={`text-xs font-mono font-bold ${passCount === scorecard.length ? "text-emerald-400" : "text-amber-400"}`}>
              {passCount}/{scorecard.length} criteria met
            </span>
          </div>
          <div className="divide-y divide-border">
            {scorecard.map((l) => (
              <div key={l.metric} className="px-5 py-3 flex items-center gap-4">
                <span className={`text-sm font-bold w-5 ${l.pass ? "text-emerald-400" : "text-red-400"}`}>{l.pass ? "✓" : "✗"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold">{l.metric}</span>
                    <span className="text-xs font-mono text-muted-foreground">{l.target} · actual {l.actual}</span>
                  </div>
                  <p className={`text-xs mt-0.5 ${l.pass ? "text-muted-foreground" : "text-amber-400"}`}>{l.delta}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Value levers — the strategy annex */}
      <div className="border border-border rounded-xl bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <Kicker>Value levers — what moves the return on this deal</Kicker>
        </div>
        <div className="divide-y divide-border">
          {levers.map((l, i) => (
            <div key={l.lever} className="px-5 py-3.5 flex items-start gap-4">
              <span className="text-[10px] font-mono font-bold text-zinc-500 mt-1 w-5 shrink-0">#{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <span className="text-sm font-semibold">{l.lever} <span className="text-muted-foreground font-normal text-xs">· {l.move}</span></span>
                  <span className={`text-xs font-mono font-bold ${l.cocDeltaPts >= 0 ? "text-emerald-400" : "text-amber-400"}`}>
                    {l.cocDeltaPts >= 0 ? "+" : "−"}{Math.abs(l.cocDeltaPts).toFixed(2)} pts CoC
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{l.narrative}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sensitivity */}
      <div className="border border-border rounded-xl bg-card p-5">
        <Kicker>Sensitivity — cash-on-cash</Kicker>
        <p className="text-[10px] text-zinc-500 mb-3 -mt-2">financing rate ±1% × exit cap ±0.5%</p>
        <table className="w-full border-collapse font-mono text-xs">
          <thead>
            <tr>
              <th className="border border-border bg-background px-2 py-1.5 text-muted-foreground font-normal text-left text-[10px]">rate \ cap</th>
              {sens[0].map((c) => (
                <th key={c.capPct} className="border border-border bg-background px-2 py-1.5 text-muted-foreground font-normal text-right text-[10px]">
                  {c.capPct.toFixed(2)}%
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sens.map((row) => (
              <tr key={row[0].ratePct}>
                <td className="border border-border px-2 py-1.5 text-muted-foreground text-[10px]">{row[0].ratePct.toFixed(2)}%</td>
                {row.map((c) => (
                  <td key={`${c.ratePct}-${c.capPct}`}
                      className={`border px-2 py-1.5 text-right tabular-nums ${c.isBase ? "border-primary/50 bg-primary/10 text-primary font-bold" : "border-border"}`}>
                    {c.cashOnCash.toFixed(1)}%
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ── Report view — scores, momentum, inventory, signals, rate grid ──────── */

function ReportView({ p }: { p: MarketReport }) {
  const sym = p.market.currencySymbol;
  const vals = p.momentum.map((m) => m.opportunity);
  const min = Math.min(...vals), max = Math.max(...vals), range = (max - min) || 1;
  const w = 260, h = 48;
  const spark = vals.length >= 2
    ? vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - 4 - ((v - min) / range) * (h - 8)}`).join(" ")
    : null;

  return (
    <>
      <div>
        <p className="kicker text-primary mb-1">Prime Atlas market report · proprietary metrics</p>
        <h1 className="text-2xl sm:text-3xl font-bold">
          {p.market.country === "United Kingdom" ? "🇬🇧" : "🇺🇸"} {p.market.name}
          <span className="text-muted-foreground font-normal text-lg ml-2">{p.market.region}</span>
        </h1>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {([
          ["Opportunity", p.scores.opportunity], ["Growth", p.scores.growth], ["Risk", p.scores.risk],
          ["Development", p.scores.development], ["Infrastructure", p.scores.infrastructure], ["Liquidity", p.scores.liquidity],
        ] as const).map(([label, v]) => <Metric key={label} label={label} value={String(Math.round(v))} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border border-border rounded-xl bg-card p-5">
          <Kicker>Score momentum · weekly snapshots</Kicker>
          {spark ? (
            <svg width={w} height={h} role="img" aria-label="Opportunity score trend">
              <polyline points={spark} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          ) : (
            <p className="text-xs text-zinc-500">History building — snapshots are weekly</p>
          )}
          {p.momentumDeltaPts != null && (
            <p className={`text-xs font-mono mt-2 ${p.momentumDeltaPts >= 0 ? "text-emerald-400" : "text-amber-400"}`}>
              {p.momentumDeltaPts >= 0 ? "▲" : "▼"} {Math.abs(p.momentumDeltaPts).toFixed(1)} pts over tracked window
            </p>
          )}
        </div>
        <div className="border border-border rounded-xl bg-card p-5">
          <Kicker>Live inventory</Kicker>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div><span className="text-muted-foreground text-xs block">Sale listings</span><span className="font-mono font-bold">{p.inventory.saleCount.toLocaleString()}</span></div>
            <div><span className="text-muted-foreground text-xs block">Rent listings</span><span className="font-mono font-bold">{p.inventory.rentCount.toLocaleString()}</span></div>
            <div><span className="text-muted-foreground text-xs block">Median price</span><span className="font-mono font-bold">{p.inventory.medianPrice != null ? money(p.inventory.medianPrice, sym) : "—"}</span></div>
            <div><span className="text-muted-foreground text-xs block">Median /sqm</span><span className="font-mono font-bold">{p.inventory.medianPpsqm != null ? money(p.inventory.medianPpsqm, sym) : "—"}</span></div>
            <div><span className="text-muted-foreground text-xs block">Flagged underpriced</span><span className="font-mono font-bold text-pa-amber">{p.inventory.underpricedCount}</span></div>
            <div><span className="text-muted-foreground text-xs block">Underpriced share</span><span className="font-mono font-bold">{p.inventory.underpricedSharePct != null ? `${p.inventory.underpricedSharePct.toFixed(1)}%` : "—"}</span></div>
          </div>
        </div>
      </div>

      <div className="border border-border rounded-xl bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border"><Kicker>Demand signals · micro &amp; macro reading</Kicker></div>
        <div className="divide-y divide-border">
          {p.demandSignals.map((s) => (
            <div key={s.label} className="px-5 py-3.5 flex items-start gap-4">
              <span className={`text-[10px] font-bold uppercase tracking-wider border rounded-full px-2 py-0.5 mt-0.5 shrink-0 ${
                s.reading === "strong" ? "text-emerald-400 border-emerald-500/25 bg-emerald-500/10"
                : s.reading === "soft" ? "text-amber-400 border-amber-500/25 bg-amber-500/10"
                : "text-zinc-300 border-border bg-secondary"}`}>
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

      {p.rate.scenarios.length > 0 && (
        <div className="border border-border rounded-xl bg-card p-5">
          <Kicker>Interest-rate implications · 3 / 5 / 10 year horizons</Kicker>
          <p className="text-[10px] text-zinc-500 mb-4 -mt-1 leading-relaxed max-w-3xl">{p.rate.assumptions}</p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse font-mono text-xs min-w-[560px]">
              <thead>
                <tr>
                  <th className="border border-border bg-background px-2 py-1.5 text-muted-foreground font-normal text-left text-[10px]">financing rate</th>
                  <th className="border border-border bg-background px-2 py-1.5 text-muted-foreground font-normal text-right text-[10px]">debt service /yr</th>
                  <th className="border border-border bg-background px-2 py-1.5 text-muted-foreground font-normal text-right text-[10px]">breakeven yield</th>
                  {[3, 5, 10].map((y) => (
                    <th key={y} className="border border-border bg-background px-2 py-1.5 text-muted-foreground font-normal text-right text-[10px]">{y}yr interest · value drift</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {p.rate.scenarios.map((s) => {
                  const isBase = s.ratePct === p.rate.baseRatePct;
                  return (
                    <tr key={s.ratePct}>
                      <td className={`border px-2 py-1.5 ${isBase ? "border-primary/50 bg-primary/10 text-primary font-bold" : "border-border text-muted-foreground"}`}>
                        {s.ratePct.toFixed(2)}%{isBase ? " · base" : ""}
                      </td>
                      <td className="border border-border px-2 py-1.5 text-right tabular-nums">{money(s.annualDebtService, sym)}</td>
                      <td className="border border-border px-2 py-1.5 text-right tabular-nums">{s.breakevenYieldPct.toFixed(2)}%</td>
                      {s.horizons.map((hz) => (
                        <td key={hz.years} className="border border-border px-2 py-1.5 text-right tabular-nums">
                          {money(hz.cumulativeInterest, sym)}
                          <span className={`ml-1 ${hz.impliedValueDeltaPct > 0.5 ? "text-emerald-400" : hz.impliedValueDeltaPct < -0.5 ? "text-amber-400" : "text-zinc-500"}`}>
                            {hz.impliedValueDeltaPct >= 0 ? "+" : ""}{hz.impliedValueDeltaPct.toFixed(1)}%
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
    </>
  );
}
