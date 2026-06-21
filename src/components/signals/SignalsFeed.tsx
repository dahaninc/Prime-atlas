"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Signal {
  id: string;
  signal_type: string;
  title: string;
  summary: string;
  source: string;
  source_url: string | null;
  confidence_level: number;
  opportunity_impact: number;
  municipality_id: string;
  detected_at: string;
  municipalities: { id: string; name: string; region: string } | null;
  isNew?: boolean;
}

const SIGNAL_TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  infrastructure_approved: { label: "Infrastructure",   icon: "🏗️", color: "text-blue-400" },
  employer_relocating:     { label: "Employer",         icon: "🏢", color: "text-pa-green" },
  planning_application:    { label: "Planning",         icon: "📋", color: "text-pa-amber" },
  utility_expansion:       { label: "Utility",          icon: "⚡", color: "text-yellow-400" },
  university_announced:    { label: "Education",        icon: "🎓", color: "text-purple-400" },
  transport_link:          { label: "Transport",        icon: "🚆", color: "text-cyan-400" },
  development_zone:        { label: "Dev Zone",         icon: "🏘️", color: "text-pa-amber" },
  government_investment:   { label: "Gov. Investment",  icon: "🏛️", color: "text-pa-green" },
};

function impactColor(impact: number) {
  if (impact >= 80) return "text-pa-green";
  if (impact >= 55) return "text-pa-amber";
  return "text-muted-foreground";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs  < 24) return `${hrs}h ago`;
  return `${days}d ago`;
}

const SIGNAL_TYPES = Object.keys(SIGNAL_TYPE_LABELS);
const REGIONS = ["Costa Blanca", "Alicante", "Valencia"];

interface Props {
  initialSignals: Signal[];
  isPro: boolean;
  userId?: string;
}

export function SignalsFeed({ initialSignals, isPro, userId }: Props) {
  const [signals, setSignals]         = useState<Signal[]>(initialSignals);
  const [filterType, setFilterType]   = useState<string | null>(null);
  const [filterRegion, setFilterRegion] = useState<string | null>(null);
  const [minImpact, setMinImpact]     = useState(0);
  const [newCount, setNewCount]       = useState(0);
  const supabase = createClient();

  // Supabase Realtime subscription
  useEffect(() => {
    if (!isPro) return; // real-time only for Pro

    const channel = supabase
      .channel("signals-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "signals" },
        async (payload) => {
          // Fetch municipality for the new signal
          const { data: muni } = await supabase
            .from("municipalities")
            .select("id, name, region")
            .eq("id", (payload.new as Signal).municipality_id)
            .single();

          const newSignal: Signal = {
            ...(payload.new as Signal),
            municipalities: muni ?? null,
            isNew: true,
          };

          setSignals((prev) => [newSignal, ...prev]);
          setNewCount((n) => n + 1);

          // Clear "new" flash after 4s
          setTimeout(() => {
            setSignals((prev) =>
              prev.map((s) => s.id === newSignal.id ? { ...s, isNew: false } : s)
            );
          }, 4000);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isPro, supabase]);

  const filtered = signals.filter((s) => {
    if (filterType && s.signal_type !== filterType) return false;
    if (filterRegion && s.municipalities?.region !== filterRegion) return false;
    if (s.opportunity_impact < minImpact) return false;
    return true;
  });

  const clearNew = useCallback(() => setNewCount(0), []);

  return (
    <div>
      {/* Realtime banner */}
      {isPro && (
        <div className="flex items-center gap-2 mb-5">
          <span className="w-2 h-2 rounded-full bg-pa-green animate-pulse flex-shrink-0" />
          <span className="text-xs text-muted-foreground font-mono">Connected · Real-time</span>
          {newCount > 0 && (
            <button
              onClick={clearNew}
              className="ml-auto text-xs text-pa-green border border-pa-green/30 bg-pa-green/5 px-3 py-1 rounded-full hover:bg-pa-green/10 transition-colors"
            >
              {newCount} new signal{newCount > 1 ? "s" : ""} ↑
            </button>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="space-y-3 mb-6">
        {/* Type filter */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterType(null)}
            className={cn("text-xs px-3 py-1.5 rounded-full border transition-colors",
              !filterType ? "border-pa-green/40 bg-pa-green/10 text-pa-green" : "border-border text-muted-foreground hover:text-foreground"
            )}
          >All types</button>
          {SIGNAL_TYPES.map((t) => {
            const meta = SIGNAL_TYPE_LABELS[t];
            return (
              <button key={t}
                onClick={() => setFilterType(filterType === t ? null : t)}
                className={cn("text-xs px-3 py-1.5 rounded-full border transition-colors",
                  filterType === t ? "border-pa-green/40 bg-pa-green/10 text-pa-green" : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {meta.icon} {meta.label}
              </button>
            );
          })}
        </div>

        {/* Region + impact */}
        <div className="flex gap-3 flex-wrap items-center">
          <div className="flex gap-2">
            <button onClick={() => setFilterRegion(null)}
              className={cn("text-xs px-3 py-1.5 rounded-full border transition-colors",
                !filterRegion ? "border-pa-green/40 bg-pa-green/10 text-pa-green" : "border-border text-muted-foreground hover:text-foreground"
              )}>All regions</button>
            {REGIONS.map((r) => (
              <button key={r} onClick={() => setFilterRegion(filterRegion === r ? null : r)}
                className={cn("text-xs px-3 py-1.5 rounded-full border transition-colors",
                  filterRegion === r ? "border-pa-green/40 bg-pa-green/10 text-pa-green" : "border-border text-muted-foreground hover:text-foreground"
                )}>{r}</button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-muted-foreground">Min impact:</span>
            <input type="range" min={0} max={80} step={10} value={minImpact}
              onChange={(e) => setMinImpact(Number(e.target.value))}
              className="w-20 accent-pa-green" />
            <span className="text-xs font-mono text-pa-green w-6">{minImpact}</span>
          </div>
        </div>
      </div>

      {/* Signal count */}
      <p className="text-xs text-muted-foreground mb-4 font-mono">
        {filtered.length} signal{filtered.length !== 1 ? "s" : ""}
        {(filterType || filterRegion || minImpact > 0) && " (filtered)"}
      </p>

      {/* Feed */}
      <div className="space-y-3">
        {filtered.map((sig) => {
          const meta = SIGNAL_TYPE_LABELS[sig.signal_type] ?? { label: sig.signal_type, icon: "📡", color: "text-muted-foreground" };
          const slug = sig.municipalities?.name?.toLowerCase().replace(/[\s']/g, "-").replace(/[^a-z0-9-]/g, "") ?? sig.municipality_id;

          return (
            <div
              key={sig.id}
              className={cn(
                "border rounded-xl p-5 bg-card transition-all duration-500",
                sig.isNew ? "border-pa-green/50 bg-pa-green/5 shadow-[0_0_20px_rgba(0,229,160,0.08)]" : "border-border"
              )}
            >
              <div className="flex items-start gap-4">
                {/* Impact gauge */}
                <div className="flex-shrink-0 text-center w-12">
                  <p className={cn("text-xl font-bold font-mono", impactColor(sig.opportunity_impact))}>
                    {sig.opportunity_impact}
                  </p>
                  <p className="text-xs text-muted-foreground leading-none">impact</p>
                </div>

                <div className="flex-1 min-w-0">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={cn("text-xs font-medium", meta.color)}>
                          {meta.icon} {meta.label}
                        </span>
                        {sig.municipalities && (
                          <>
                            <span className="text-muted-foreground text-xs">·</span>
                            <Link
                              href={`/opportunities/${slug}`}
                              className="text-xs text-muted-foreground hover:text-pa-green transition-colors"
                            >
                              {sig.municipalities.name}, {sig.municipalities.region}
                            </Link>
                          </>
                        )}
                        {sig.isNew && (
                          <span className="text-xs bg-pa-green text-pa-navy font-bold px-1.5 py-0.5 rounded font-mono animate-pulse">
                            NEW
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-sm leading-snug">{sig.title}</h3>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-xs text-muted-foreground font-mono">{timeAgo(sig.detected_at)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {Math.round(sig.confidence_level * 100)}% confidence
                      </p>
                    </div>
                  </div>

                  {/* Summary */}
                  <p className="text-sm text-muted-foreground leading-relaxed">{sig.summary}</p>

                  {/* Footer */}
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    <span className="text-xs text-muted-foreground">{sig.source}</span>
                    {sig.source_url && (
                      <a href={sig.source_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-pa-green hover:underline">
                        Source →
                      </a>
                    )}
                    {sig.municipalities && (
                      <Link
                        href={`/opportunities/${slug}`}
                        className="ml-auto text-xs text-pa-green hover:underline"
                      >
                        View opportunities →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-16 border border-dashed border-border rounded-xl">
            <p className="text-muted-foreground text-sm">No signals match your filters.</p>
            <button onClick={() => { setFilterType(null); setFilterRegion(null); setMinImpact(0); }}
              className="mt-2 text-xs text-pa-green hover:underline">Clear filters</button>
          </div>
        )}
      </div>

      {/* CTA for non-Pro */}
      {!isPro && (
        <div className="mt-8 p-6 border border-dashed border-pa-green/30 rounded-xl text-center">
          <p className="text-sm font-semibold mb-1">Get signals the moment they are detected</p>
          <p className="text-xs text-muted-foreground mb-4">
            Pro subscribers receive real-time signals + email alerts for their watched municipalities.
            Free tier shows signals with a 48-hour delay.
          </p>
          <Link href="/pricing?upgrade=pro"
            className="inline-block bg-pa-green text-pa-navy font-semibold text-sm px-6 py-2.5 rounded-lg hover:bg-pa-green/90 transition-colors">
            Upgrade to Pro — €149/mo
          </Link>
        </div>
      )}
    </div>
  );
}
