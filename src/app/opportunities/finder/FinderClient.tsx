"use client";

import { useState } from "react";
import { runOpportunityFinder, type FinderParams, type FinderResult } from "./actions";
import { analytics } from "@/lib/analytics";
import { ScoreRadar } from "@/components/charts/ScoreRadar";
import { ScoreBreakdown } from "@/components/charts/ScoreBreakdown";
import { OpportunityScoreGauge } from "@/components/charts/OpportunityScoreGauge";
import { ThesisStream } from "@/components/ui/ThesisStream";
import { cn, scoreColor } from "@/lib/utils";

const OBJECTIVES = [
  { value: "capital_growth", label: "Capital Growth", desc: "Long-term appreciation, pre-infrastructure plays" },
  { value: "rental_yield",   label: "Rental Yield",   desc: "Income-generating assets, high liquidity markets" },
  { value: "development",    label: "Development",    desc: "Planning plays, consented land, greenfield sites" },
  { value: "mixed",          label: "Mixed",          desc: "Balanced weighting across all factors" },
] as const;

const RISK_OPTIONS = [
  { value: "low",    label: "Low",    desc: "Risk score ≤35 only" },
  { value: "medium", label: "Medium", desc: "Risk score ≤60" },
  { value: "high",   label: "High",   desc: "No restriction" },
] as const;

interface Props {
  regions: string[];
  categories: string[];
}

export function FinderClient({ regions, categories }: Props) {
  const [params, setParams] = useState<FinderParams>({
    regions: [],
    categories: [],
    risk_tolerance: "medium",
    objective: "capital_growth",
    min_score: 70,
    budget_min: undefined,
    budget_max: undefined,
  });

  const [results, setResults] = useState<FinderResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeResult, setActiveResult] = useState<string | null>(null);
  const [step, setStep] = useState<"form" | "results">("form");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await runOpportunityFinder(params);
      analytics.opportunityFinderRun({
        objective:      params.objective,
        region:         params.regions.join(", "),
        category:       params.categories.join(", "),
        budget_min:     params.budget_min,
        budget_max:     params.budget_max,
        risk_tolerance: params.risk_tolerance === "low" ? 1 : params.risk_tolerance === "medium" ? 2 : 3,
        min_score:      params.min_score,
        result_count:   data.length,
      });
      setResults(data);
      setStep("results");
      if (data.length > 0) setActiveResult(data[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function toggleRegion(r: string) {
    setParams((p) => ({
      ...p,
      regions: p.regions.includes(r) ? p.regions.filter((x) => x !== r) : [...p.regions, r],
    }));
  }

  function toggleCategory(c: string) {
    setParams((p) => ({
      ...p,
      categories: p.categories.includes(c) ? p.categories.filter((x) => x !== c) : [...p.categories, c],
    }));
  }

  const selectedResult = results?.find((r) => r.id === activeResult);

  if (step === "results" && results) {
    return (
      <div>
        {/* Results header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm font-semibold">{results.length} opportunities found</p>
            <p className="text-xs text-muted-foreground">Ranked by personalised score · {params.objective.replace("_", " ")} objective</p>
          </div>
          <button
            onClick={() => { setStep("form"); setResults(null); setActiveResult(null); }}
            className="text-xs border border-border px-3 py-1.5 rounded-lg hover:bg-secondary transition-colors"
          >
            ← Refine search
          </button>
        </div>

        {results.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-xl">
            <p className="text-muted-foreground text-sm mb-3">No opportunities matched your criteria.</p>
            <button onClick={() => setStep("form")} className="text-xs text-pa-green hover:underline">
              Broaden your search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Results list */}
            <div className="lg:col-span-1 space-y-2">
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setActiveResult(r.id)}
                  className={cn(
                    "w-full text-left border rounded-xl p-4 transition-all",
                    activeResult === r.id
                      ? "border-pa-green/50 bg-pa-green/5"
                      : "border-border bg-card hover:border-border/70 hover:bg-secondary/20"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground font-mono mb-0.5">#{r.rank}</p>
                      <p className="text-sm font-medium leading-snug line-clamp-2">{r.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{r.municipality_name} · {r.municipality_region}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className={cn("font-mono font-bold text-lg", scoreColor(r.personalised_score))}>
                        {r.personalised_score}
                      </p>
                      <p className="text-xs text-muted-foreground">score</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    <span className="text-xs border border-border rounded px-1.5 py-0.5 text-muted-foreground">{r.category}</span>
                    <span className={cn("text-xs border rounded px-1.5 py-0.5 font-medium",
                      r.risk_level === "low" ? "border-pa-green/30 text-pa-green bg-pa-green/5" :
                      r.risk_level === "medium" ? "border-pa-amber/30 text-pa-amber bg-pa-amber/5" :
                      "border-pa-red/30 text-pa-red bg-pa-red/5"
                    )}>{r.risk_level} risk</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Detail panel */}
            {selectedResult && (
              <div className="lg:col-span-2 space-y-5">
                {/* Score header */}
                <div className="border border-border rounded-xl p-6 bg-card">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-6">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground font-mono mb-1">#{selectedResult.rank} · {selectedResult.municipality_name}, {selectedResult.municipality_region}</p>
                      <h2 className="text-xl font-bold mb-1">{selectedResult.title}</h2>
                      <div className="flex gap-2 mt-2">
                        <span className="text-xs border border-border rounded px-2 py-0.5 text-muted-foreground">{selectedResult.category}</span>
                        <span className={cn("text-xs border rounded px-2 py-0.5 font-medium",
                          selectedResult.risk_level === "low" ? "border-pa-green/30 text-pa-green bg-pa-green/5" : "border-pa-amber/30 text-pa-amber bg-pa-amber/5"
                        )}>{selectedResult.risk_level} risk</span>
                      </div>
                    </div>
                    <OpportunityScoreGauge score={selectedResult.personalised_score} size="md" label={`Personalised score (${params.objective.replace("_"," ")})`} />
                  </div>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="border border-border rounded-xl p-5 bg-card">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">Score Radar</p>
                    <ScoreRadar scores={selectedResult.scores} size={220} />
                  </div>
                  <div className="border border-border rounded-xl p-5 bg-card">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">Sub-score Breakdown</p>
                    <ScoreBreakdown scores={selectedResult.scores} />
                    <div className="mt-4 space-y-1.5">
                      {[
                        { label: "Growth",        v: selectedResult.scores.growth_score },
                        { label: "Infrastructure", v: selectedResult.scores.infrastructure_score },
                        { label: "Development",   v: selectedResult.scores.development_score },
                        { label: "Liquidity",     v: selectedResult.scores.liquidity_score },
                        { label: "Risk (inverted)",v: 100 - selectedResult.scores.risk_score },
                      ].map(({ label, v }) => (
                        <div key={label} className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{label}</span>
                          <span className={cn("font-mono font-semibold", scoreColor(v))}>{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* AI Thesis */}
                <div className="border border-border rounded-xl p-6 bg-card">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">AI Investment Thesis</span>
                    <span className="text-xs border border-pa-green/30 bg-pa-green/5 text-pa-green px-2 py-0.5 rounded-full font-mono">Claude</span>
                  </div>
                  <ThesisStream
                    municipalityId={selectedResult.municipality_id}
                    opportunityId={selectedResult.id}
                    context={{
                      objective: params.objective,
                      budget_min: params.budget_min,
                      budget_max: params.budget_max,
                      risk_tolerance: params.risk_tolerance,
                    }}
                    fallbackThesis={selectedResult.investment_thesis}
                  />
                </div>

                {/* Evidence */}
                {selectedResult.evidence && (selectedResult.evidence as { source: string; summary: string; confidence: number }[]).length > 0 && (
                  <div className="border border-border rounded-xl p-5 bg-card">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">Supporting Evidence</p>
                    <div className="space-y-3">
                      {(selectedResult.evidence as { source: string; date?: string; summary: string; confidence: number }[]).map((ev, i) => (
                        <div key={i} className="flex gap-3">
                          <span className="w-5 h-5 rounded-full bg-secondary border border-border flex items-center justify-center text-xs text-muted-foreground flex-shrink-0 mt-0.5">{i + 1}</span>
                          <div>
                            <p className="text-xs font-medium">{ev.source}{ev.date ? ` · ${ev.date}` : ""}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{ev.summary}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Confidence: <span className={cn("font-mono", scoreColor(ev.confidence * 100))}>{Math.round(ev.confidence * 100)}%</span>
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CTA */}
                <div className="border border-dashed border-pa-green/30 rounded-xl p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">Add {selectedResult.municipality_name} to your Watchlist</p>
                    <p className="text-xs text-muted-foreground">Get alerted when new signals are detected.</p>
                  </div>
                  <a
                    href={`/watchlists?add=${selectedResult.municipality_id}`}
                    className="flex-shrink-0 bg-pa-green text-pa-navy font-semibold text-xs px-4 py-2 rounded-lg hover:bg-pa-green/90 transition-colors"
                  >
                    Add to Watchlist
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Form view
  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — primary inputs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Objective */}
          <div className="border border-border rounded-xl p-6 bg-card">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">Investment Objective</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {OBJECTIVES.map((obj) => (
                <button
                  key={obj.value}
                  type="button"
                  onClick={() => setParams((p) => ({ ...p, objective: obj.value }))}
                  className={cn(
                    "text-left border rounded-xl p-4 transition-all",
                    params.objective === obj.value
                      ? "border-pa-green/50 bg-pa-green/5"
                      : "border-border hover:border-border/70 bg-card"
                  )}
                >
                  <p className="text-sm font-medium">{obj.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{obj.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Geography */}
          <div className="border border-border rounded-xl p-6 bg-card">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">
              Geography <span className="normal-case font-normal text-muted-foreground">(leave blank for all)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {regions.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggleRegion(r)}
                  className={cn(
                    "text-sm px-3 py-1.5 rounded-full border transition-colors",
                    params.regions.includes(r)
                      ? "border-pa-green/50 bg-pa-green/10 text-pa-green"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Categories */}
          <div className="border border-border rounded-xl p-6 bg-card">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">
              Category <span className="normal-case font-normal text-muted-foreground">(leave blank for all)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCategory(c)}
                  className={cn(
                    "text-sm px-3 py-1.5 rounded-full border transition-colors",
                    params.categories.includes(c)
                      ? "border-pa-green/50 bg-pa-green/10 text-pa-green"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right column — filters */}
        <div className="space-y-4">
          {/* Budget */}
          <div className="border border-border rounded-xl p-5 bg-card">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">Budget (EUR)</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Minimum</label>
                <input
                  type="number"
                  placeholder="e.g. 100000"
                  value={params.budget_min ?? ""}
                  onChange={(e) => setParams((p) => ({ ...p, budget_min: e.target.value ? Number(e.target.value) : undefined }))}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-pa-green/50"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Maximum</label>
                <input
                  type="number"
                  placeholder="e.g. 500000"
                  value={params.budget_max ?? ""}
                  onChange={(e) => setParams((p) => ({ ...p, budget_max: e.target.value ? Number(e.target.value) : undefined }))}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-pa-green/50"
                />
              </div>
            </div>
          </div>

          {/* Risk tolerance */}
          <div className="border border-border rounded-xl p-5 bg-card">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">Risk Tolerance</p>
            <div className="space-y-2">
              {RISK_OPTIONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setParams((p) => ({ ...p, risk_tolerance: r.value }))}
                  className={cn(
                    "w-full text-left border rounded-lg px-4 py-2.5 transition-all",
                    params.risk_tolerance === r.value
                      ? "border-pa-green/50 bg-pa-green/5"
                      : "border-border hover:bg-secondary/50"
                  )}
                >
                  <p className="text-sm font-medium">{r.label}</p>
                  <p className="text-xs text-muted-foreground">{r.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Min score */}
          <div className="border border-border rounded-xl p-5 bg-card">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Minimum Score</p>
            <p className="text-xs text-muted-foreground mb-3">Only show opportunities scoring above:</p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={90}
                step={5}
                value={params.min_score}
                onChange={(e) => setParams((p) => ({ ...p, min_score: Number(e.target.value) }))}
                className="flex-1 accent-pa-green"
              />
              <span className="text-pa-green font-mono font-bold text-lg w-10 text-right">{params.min_score}</span>
            </div>
          </div>

          {/* Submit */}
          {error && (
            <div className="p-3 border border-pa-red/30 bg-pa-red/5 rounded-xl text-xs text-pa-red">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-pa-green text-pa-navy font-bold py-3.5 rounded-xl hover:bg-pa-green/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && <span className="w-4 h-4 border-2 border-pa-navy border-t-transparent rounded-full animate-spin" />}
            {loading ? "Finding opportunities…" : "Find opportunities →"}
          </button>
        </div>
      </div>
    </form>
  );
}
