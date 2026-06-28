"use client";

import { useState } from "react";

/* ─────────────────────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────────────────────── */

type ExitStatus = "success" | "partial" | "failure";

interface ScraperRun {
  id:               string;
  provider:         string;
  started_at:       string;
  finished_at:      string;
  records_scraped:  number;
  records_upserted: number;
  records_failed:   number;
  errors:           string[];
  exit_status:      ExitStatus;
  duration_ms:      number;
}

interface Props {
  runs:               ScraperRun[];
  latestByProvider:   Record<string, ScraperRun>;
}

/* ─────────────────────────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────────────────────────── */

const ALL_PROVIDERS = [
  "zoopla", "rightmove", "onthemarket",
  "zillow", "realtor_ca", "realestate_au", "idealista",
];

const PROVIDER_LABELS: Record<string, string> = {
  zoopla:        "Zoopla",
  rightmove:     "Rightmove",
  onthemarket:   "OnTheMarket",
  zillow:        "Zillow",
  realtor_ca:    "Realtor.ca",
  realestate_au: "REA Group",
  idealista:     "Idealista",
};

const PROVIDER_FLAG: Record<string, string> = {
  zoopla:        "🇬🇧",
  rightmove:     "🇬🇧",
  onthemarket:   "🇬🇧",
  zillow:        "🇺🇸",
  realtor_ca:    "🇨🇦",
  realestate_au: "🇦🇺",
  idealista:     "🇪🇸",
};

const STATUS_COLOR: Record<ExitStatus, string> = {
  success: "#00C805",
  partial: "#CCFF00",
  failure: "#FF3B30",
};

const STATUS_BG: Record<ExitStatus, string> = {
  success: "rgba(0,200,5,0.1)",
  partial: "rgba(204,255,0,0.1)",
  failure: "rgba(255,59,48,0.1)",
};

/* ─────────────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────────────── */

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day:    "2-digit",
      month:  "short",
      hour:   "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins   = Math.floor(diffMs / 60_000);
  if (mins < 2)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/* ─────────────────────────────────────────────────────────────────────────────
   SUB-COMPONENTS
───────────────────────────────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: ExitStatus }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest"
      style={{ color: STATUS_COLOR[status], background: STATUS_BG[status] }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: STATUS_COLOR[status] }}
      />
      {status}
    </span>
  );
}

function ProviderCard({
  provider,
  run,
}: {
  provider: string;
  run: ScraperRun | undefined;
}) {
  const label  = PROVIDER_LABELS[provider] ?? provider;
  const flag   = PROVIDER_FLAG[provider]   ?? "🌐";
  const status = run?.exit_status ?? null;

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3"
      style={{
        background: "#18181B",
        border:     status ? `1px solid ${STATUS_COLOR[status as ExitStatus]}22` : "1px solid #27272A",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{flag}</span>
          <span className="text-sm font-semibold text-white">{label}</span>
        </div>
        {status
          ? <StatusBadge status={status as ExitStatus} />
          : <span className="text-[10px] uppercase tracking-widest text-[#52525B] font-bold">Never run</span>
        }
      </div>

      {/* Stats */}
      {run ? (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Scraped",  value: run.records_scraped  },
            { label: "Upserted", value: run.records_upserted },
            { label: "Failed",   value: run.records_failed   },
          ].map(({ label: l, value }) => (
            <div key={l} className="flex flex-col">
              <span className="text-[10px] uppercase tracking-widest text-[#52525B] font-bold">{l}</span>
              <span
                className="text-2xl font-black tabular-nums"
                style={{
                  color: l === "Failed" && value > 0 ? "#FF3B30"
                       : l === "Upserted"            ? "#00C805"
                       :                               "white",
                }}
              >
                {value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-[#52525B] text-sm">No runs recorded yet.</div>
      )}

      {/* Footer */}
      {run && (
        <div className="flex items-center justify-between pt-1 border-t border-[#27272A]">
          <span className="text-[11px] text-[#71717A]">
            {timeAgo(run.started_at)}
          </span>
          <span className="text-[11px] text-[#71717A] tabular-nums">
            {fmtDuration(run.duration_ms)}
          </span>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN DASHBOARD
───────────────────────────────────────────────────────────────────────────── */

export function ScraperDashboard({ runs, latestByProvider }: Props) {
  const [selectedProvider, setSelectedProvider] = useState<string>("all");
  const [expandedRunId,    setExpandedRunId]    = useState<string | null>(null);

  const filteredRuns = selectedProvider === "all"
    ? runs
    : runs.filter((r) => r.provider === selectedProvider);

  const totalRecords  = Object.values(latestByProvider).reduce((s, r) => s + (r?.records_upserted ?? 0), 0);
  const totalFailures = Object.values(latestByProvider).filter((r) => r?.exit_status === "failure").length;
  const healthyCount  = Object.values(latestByProvider).filter((r) => r?.exit_status === "success").length;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="border-b border-[#27272A] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-widest font-bold text-[#52525B]">
            Prime Atlas
          </span>
          <span className="text-[#27272A]">/</span>
          <span className="text-sm font-semibold text-white">Scraper Health</span>
        </div>
        <a
          href="/"
          className="text-[11px] text-[#71717A] hover:text-white transition-colors"
        >
          ← Back to app
        </a>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10 space-y-10">

        {/* ── Headline stats ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-6">
          {[
            { label: "Total records (latest runs)", value: totalRecords.toLocaleString(),  color: "#CCFF00" },
            { label: "Providers healthy",            value: `${healthyCount} / ${ALL_PROVIDERS.length}`, color: "#00C805" },
            { label: "Providers failing",            value: String(totalFailures),          color: totalFailures > 0 ? "#FF3B30" : "#52525B" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl p-6" style={{ background: "#18181B" }}>
              <div className="text-[10px] uppercase tracking-widest text-[#52525B] font-bold mb-2">{label}</div>
              <div className="text-4xl font-black tabular-nums" style={{ color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* ── Provider status cards ────────────────────────────────────────── */}
        <section>
          <h2 className="text-[10px] uppercase tracking-widest font-bold text-[#52525B] mb-4">
            Provider Status — Latest Run
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {ALL_PROVIDERS.map((p) => (
              <ProviderCard key={p} provider={p} run={latestByProvider[p]} />
            ))}
          </div>
        </section>

        {/* ── Run log ─────────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] uppercase tracking-widest font-bold text-[#52525B]">
              Run Log
            </h2>
            {/* Provider filter pills */}
            <div className="flex flex-wrap gap-2">
              {["all", ...ALL_PROVIDERS].map((p) => (
                <button
                  key={p}
                  onClick={() => setSelectedProvider(p)}
                  className="px-3 py-1 rounded-full text-[11px] font-semibold transition-all"
                  style={{
                    background:  selectedProvider === p ? "#CCFF00" : "#18181B",
                    color:       selectedProvider === p ? "#000"    : "#A1A1AA",
                    border:      selectedProvider === p ? "none"     : "1px solid #27272A",
                  }}
                >
                  {p === "all" ? "All" : PROVIDER_LABELS[p] ?? p}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ background: "#18181B" }}>
            {/* Table header */}
            <div
              className="grid text-[10px] uppercase tracking-widest font-bold text-[#52525B] px-5 py-3"
              style={{
                gridTemplateColumns: "1fr 100px 80px 80px 80px 90px 80px",
                borderBottom: "1px solid #27272A",
              }}
            >
              <span>Provider / Time</span>
              <span>Status</span>
              <span className="text-right">Scraped</span>
              <span className="text-right">Upserted</span>
              <span className="text-right">Failed</span>
              <span className="text-right">Duration</span>
              <span className="text-right">Errors</span>
            </div>

            {/* Table rows */}
            {filteredRuns.length === 0 ? (
              <div className="px-5 py-10 text-center text-[#52525B] text-sm">
                No runs recorded yet for this provider.
              </div>
            ) : (
              filteredRuns.map((run) => {
                const isExpanded = expandedRunId === run.id;
                const hasErrors  = run.errors && run.errors.length > 0;

                return (
                  <div key={run.id} style={{ borderBottom: "1px solid #27272A" }}>
                    {/* Row */}
                    <div
                      className={`grid items-center px-5 py-3.5 transition-colors ${hasErrors ? "cursor-pointer hover:bg-[#1C1C1F]" : ""}`}
                      style={{ gridTemplateColumns: "1fr 100px 80px 80px 80px 90px 80px" }}
                      onClick={() => hasErrors && setExpandedRunId(isExpanded ? null : run.id)}
                    >
                      {/* Provider + time */}
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-semibold text-white">
                          {PROVIDER_FLAG[run.provider]} {PROVIDER_LABELS[run.provider] ?? run.provider}
                        </span>
                        <span className="text-[11px] text-[#52525B] tabular-nums">
                          {fmtTime(run.started_at)}
                        </span>
                      </div>

                      {/* Status */}
                      <div>
                        <StatusBadge status={run.exit_status} />
                      </div>

                      {/* Counts */}
                      <span className="text-sm tabular-nums text-right text-[#A1A1AA]">
                        {run.records_scraped.toLocaleString()}
                      </span>
                      <span className="text-sm tabular-nums text-right font-semibold" style={{ color: "#00C805" }}>
                        {run.records_upserted.toLocaleString()}
                      </span>
                      <span
                        className="text-sm tabular-nums text-right font-semibold"
                        style={{ color: run.records_failed > 0 ? "#FF3B30" : "#52525B" }}
                      >
                        {run.records_failed.toLocaleString()}
                      </span>

                      {/* Duration */}
                      <span className="text-sm tabular-nums text-right text-[#A1A1AA]">
                        {fmtDuration(run.duration_ms)}
                      </span>

                      {/* Error count / expand toggle */}
                      <div className="flex justify-end items-center gap-1">
                        {hasErrors ? (
                          <span className="text-xs font-bold tabular-nums" style={{ color: "#FF3B30" }}>
                            {run.errors.length} {isExpanded ? "▲" : "▼"}
                          </span>
                        ) : (
                          <span className="text-xs text-[#52525B]">—</span>
                        )}
                      </div>
                    </div>

                    {/* Expanded error detail */}
                    {isExpanded && hasErrors && (
                      <div
                        className="px-5 pb-4 space-y-2"
                        style={{ background: "rgba(255,59,48,0.04)" }}
                      >
                        {run.errors.map((err, i) => (
                          <div
                            key={i}
                            className="rounded-lg px-4 py-3 text-[11px] font-mono text-[#FF3B30] leading-relaxed"
                            style={{ background: "rgba(255,59,48,0.08)" }}
                          >
                            {err}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
