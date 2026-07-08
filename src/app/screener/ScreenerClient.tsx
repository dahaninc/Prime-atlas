"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  computeScreener, screenerSensitivity, buildScorecard,
  US_DEFAULT_INPUTS, SCORECARD_DISCLAIMER,
  type ScreenerInputs, type Criteria,
} from "@/lib/screener";
import { saveAnalysis, saveCriteria } from "./actions";
import { createShareLink } from "@/app/actions/share";
import { toast } from "@/components/ui/Toaster";

interface SavedCriteria extends Criteria { id: string; name: string }

interface PastAnalysis {
  id: string;
  name: string | null;
  created_at: string;
  inputs: Record<string, number>;
  outputs: Record<string, number>;
}

interface Props {
  savedCriteria: SavedCriteria | null;
  pastAnalyses: PastAnalysis[];
  quotaUsed: number;
  quotaLimit: number | null;
  unlimited: boolean;
  cardOnFile: boolean;
  canParseOm: boolean;
  canExportDoc: boolean;
}

/** Where a pro-forma input's current value came from — drives the color coding
 *  next to each field so an analyst can tell parsed/manual/default apart at a
 *  glance, and spot-check low-confidence parses without re-opening the OM. */
type FieldSource = "manual" | "parsed";
interface FieldMeta { source: FieldSource; confidence?: "high" | "low"; note?: string }

const money = (n: number) =>
  Math.abs(n) >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M`
  : Math.abs(n) >= 1_000   ? `$${Math.round(n / 1_000).toLocaleString()}K`
  :                          `$${Math.round(n).toLocaleString()}`;

const INPUT_FIELDS: { key: keyof ScreenerInputs; label: string; step: number }[] = [
  { key: "purchasePrice",   label: "Purchase price ($)",     step: 50_000 },
  { key: "units",           label: "Units",                  step: 1 },
  { key: "avgRentMo",       label: "Avg rent / unit / mo ($)", step: 50 },
  { key: "otherIncomeYr",   label: "Other income / yr ($)",  step: 1_000 },
  { key: "vacancyPct",      label: "Vacancy %",              step: 0.5 },
  { key: "expenseRatioPct", label: "Expense ratio % of EGI", step: 1 },
  { key: "ltvPct",          label: "LTV %",                  step: 5 },
  { key: "interestPct",     label: "Interest % (APR)",       step: 0.125 },
  { key: "amortYears",      label: "Amortization (yrs)",     step: 5 },
  { key: "closingCostPct",  label: "Closing costs %",        step: 0.5 },
  { key: "exitCapPct",      label: "Exit cap %",             step: 0.25 },
  { key: "holdYears",       label: "Hold (yrs)",             step: 1 },
  { key: "rentGrowthPct",   label: "Rent growth % / yr",     step: 0.5 },
];

const CRITERIA_FIELDS = [
  { key: "target_cap_pct",     label: "Target cap rate ≥ %",   step: 0.25 },
  { key: "min_dscr",           label: "Min DSCR ≥ x",          step: 0.05 },
  { key: "max_price_per_unit", label: "Max price / unit ≤ $",  step: 10_000 },
  { key: "target_coc_pct",     label: "Target cash-on-cash ≥ %", step: 0.5 },
  { key: "hold_years",         label: "Hold period (yrs)",     step: 1 },
] as const;

export function ScreenerClient({ savedCriteria, pastAnalyses, quotaUsed, quotaLimit, unlimited, cardOnFile, canParseOm, canExportDoc }: Props) {
  const [inputs, setInputs] = useState<ScreenerInputs>(US_DEFAULT_INPUTS);
  const [fieldMeta, setFieldMeta] = useState<Partial<Record<keyof ScreenerInputs, FieldMeta>>>({});
  const [dealName, setDealName] = useState("");
  const [criteria, setCriteria] = useState<Criteria & { name: string }>(
    savedCriteria ?? {
      name: "My criteria", target_cap_pct: 6, min_dscr: 1.25,
      max_price_per_unit: 250_000, target_coc_pct: 8, hold_years: 5,
    },
  );
  const [criteriaId, setCriteriaId] = useState<string | null>(savedCriteria?.id ?? null);
  const [criteriaOpen, setCriteriaOpen] = useState(!savedCriteria);
  const [used, setUsed] = useState(quotaUsed);
  const [pendingSave, startSave] = useTransition();
  const [parsing, setParsing] = useState(false);
  const [activating, setActivating] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onShare() {
    if (!savedId || sharing) return;
    setSharing(true);
    try {
      const res = await createShareLink("analysis", savedId);
      if (!res.ok) { toast("Could not create the share link", "error"); return; }
      await navigator.clipboard.writeText(`${window.location.origin}${res.path}`);
      toast("Read-only link copied — send it to your LP, lender or co-GP");
    } finally {
      setSharing(false);
    }
  }

  const needsActivation = !unlimited && !cardOnFile;

  // Return leg from Stripe card setup (/api/stripe/setup GET redirect).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("card_saved") === "1") {
      toast("Card saved — your 3 free analyses/month are active");
      window.history.replaceState({}, "", "/screener");
    } else if (params.get("setup_cancelled") === "1") {
      toast("Card setup cancelled — add a card to activate your free analyses", "info");
      window.history.replaceState({}, "", "/screener");
    }
  }, []);

  async function onActivate() {
    setActivating(true);
    try {
      const res = await fetch("/api/stripe/setup", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && data.url) {
        window.location.assign(data.url);
        return;
      }
      toast(data.error ?? "Could not start card setup — try again", "error");
    } finally {
      setActivating(false);
    }
  }

  const out  = useMemo(() => computeScreener(inputs), [inputs]);
  const sens = useMemo(() => screenerSensitivity(inputs), [inputs]);
  const scorecard = useMemo(() => buildScorecard(criteria, out), [criteria, out]);
  const allPass = scorecard.length > 0 && scorecard.every((l) => l.pass);
  const quotaLeft = unlimited || quotaLimit === null ? Infinity : Math.max(0, quotaLimit - used);

  function setNum(key: keyof ScreenerInputs, v: string) {
    setInputs((p) => ({ ...p, [key]: Number(v) }));
    // Editing a field makes it the analyst's own number — it's no longer
    // presented as an AI extraction, parsed or otherwise.
    setFieldMeta((m) => ({ ...m, [key]: { source: "manual" } }));
  }

  async function onDropPdf(file: File) {
    if (!canParseOm) {
      toast("OM parsing is a Professional feature — upgrade to parse", "info");
      return;
    }
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/screener/parse", { method: "POST", body: fd });
      if (res.status === 503) {
        toast("PDF parsing engine not configured yet — enter the deal manually", "info");
        return;
      }
      if (res.status === 403) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (body.error === "upgrade_required") {
          toast("OM parsing is a Professional feature — upgrade to parse", "info");
        } else if (body.error === "card_required") {
          toast("Add a card to activate your free analyses (you won't be charged)", "info");
        } else {
          toast(`Plan limit: ${quotaLimit} screener runs/month used — upgrade for more`, "info");
        }
        return;
      }
      if (!res.ok) {
        toast("Could not parse that PDF — enter the deal manually", "error");
        return;
      }
      const parsed = (await res.json()) as {
        name?: string;
        fields?: Record<string, { value: number; confidence: "high" | "low"; source: string }>;
      };
      const newInputs: Partial<ScreenerInputs> = {};
      const newMeta: Partial<Record<keyof ScreenerInputs, FieldMeta>> = {};
      let lowCount = 0;
      for (const [k, f] of Object.entries(parsed.fields ?? {})) {
        if (!f || typeof f.value !== "number" || !isFinite(f.value)) continue;
        const key = k as keyof ScreenerInputs;
        newInputs[key] = f.value;
        newMeta[key] = { source: "parsed", confidence: f.confidence, note: f.source };
        if (f.confidence === "low") lowCount++;
      }
      setInputs((p) => ({ ...p, ...newInputs }));
      setFieldMeta((m) => ({ ...m, ...newMeta }));
      if (parsed.name) setDealName(parsed.name);
      toast(
        lowCount > 0
          ? `Parsed — ${lowCount} field${lowCount > 1 ? "s" : ""} flagged low-confidence, verify against the source before relying on it`
          : "Parsed — review every prefilled number before relying on it",
      );
    } finally {
      setParsing(false);
    }
  }

  async function onExportDoc() {
    if (!canExportDoc || exporting) return;
    setExporting(true);
    try {
      const res = await fetch("/api/export/screener", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: dealName || "Untitled analysis",
          inputs, outputs: out, scorecard, sensitivity: sens,
          fields: Object.fromEntries(
            Object.entries(fieldMeta).filter(([, m]) => m?.source === "parsed"),
          ),
        }),
      });
      if (res.status === 403) {
        toast("Screener export is a Professional feature — upgrade to unlock", "info");
        return;
      }
      if (!res.ok) {
        toast("Export failed — try again", "error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `screener-${(dealName || "analysis").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}.doc`;
      a.click(); URL.revokeObjectURL(url);
      toast("Exported — Word-editable .doc, ready to forward");
    } finally {
      setExporting(false);
    }
  }

  function onSaveAnalysis() {
    startSave(async () => {
      const res = await saveAnalysis({
        name: dealName,
        inputs: inputs as unknown as Record<string, number>,
        outputs: {
          noi: out.noi, capRate: out.capRate, dscr: out.dscr,
          cashOnCash: out.cashOnCash, pricePerUnit: out.pricePerUnit,
          equity: out.equity, exitValue: out.exitValue,
        },
        scorecard,
        criteria_id: criteriaId,
      });
      if (!res.ok) {
        if (res.error === "quota_exceeded") {
          toast(`Free plan: ${quotaLimit} analyses/month used — upgrade for unlimited`, "error");
        } else if (res.error === "card_required") {
          toast("Add a card to activate your free analyses (you won't be charged)", "info");
        } else {
          toast("Could not save analysis", "error");
        }
        return;
      }
      setUsed((u) => u + 1);
      setSavedId(res.id ?? null);
      toast("Analysis saved");
    });
  }

  function onSaveCriteria() {
    startSave(async () => {
      const res = await saveCriteria({
        name: criteria.name,
        target_cap_pct: criteria.target_cap_pct,
        min_dscr: criteria.min_dscr,
        max_price_per_unit: criteria.max_price_per_unit,
        target_coc_pct: criteria.target_coc_pct,
        hold_years: criteria.hold_years,
      });
      if (res.ok && res.id) {
        setCriteriaId(res.id);
        toast("Criteria profile saved — every future deal is checked against it");
      } else {
        toast("Could not save criteria", "error");
      }
    });
  }

  return (
    <>
    {needsActivation && (
      <div className="mb-6 border border-primary/40 bg-primary/5 rounded-xl px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-semibold">Activate your {quotaLimit} free analyses / month</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Add a card to unlock them — you won&apos;t be charged. Your card is vaulted securely
            with Stripe and only used if you later upgrade.
          </p>
        </div>
        <button
          onClick={onActivate}
          disabled={activating}
          className="bg-primary text-white font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-primary/85 transition-colors disabled:opacity-60 shrink-0"
        >
          {activating ? "Opening Stripe…" : "Add card & activate"}
        </button>
      </div>
    )}
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

      {/* ── Left: deal inputs ─────────────────────────────────────────── */}
      <div className="lg:col-span-2 space-y-4">

        {/* PDF dropzone — Professional+ only (src/lib/entitlements.ts: omParsingEnabled) */}
        {canParseOm ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onDropPdf(f); }}
            onClick={() => fileRef.current?.click()}
            className="border border-dashed border-primary/40 bg-primary/5 rounded-xl p-5 text-center cursor-pointer hover:bg-primary/10 transition-colors"
          >
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden"
                   onChange={(e) => { const f = e.target.files?.[0]; if (f) onDropPdf(f); }} />
            {parsing ? (
              <div className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-semibold">Parsing document…</p>
              </div>
            ) : (
              <p className="text-sm font-semibold">Drop an OM / rent roll / T12 PDF</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Prefills the pro-forma — every parsed number stays editable. Or skip and enter manually below.
            </p>
          </div>
        ) : (
          <div className="border border-dashed border-border rounded-xl p-5 text-center bg-card">
            <p className="text-sm font-semibold text-foreground">OM / rent roll / T12 parsing</p>
            <p className="text-xs text-muted-foreground mt-1 mb-3">
              Drop a PDF and Prime Atlas prefills the pro-forma for you — a Professional feature.
              Enter deals manually below in the meantime.
            </p>
            <Link
              href="/pricing"
              className="inline-block bg-primary text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-primary/85 transition-colors"
            >
              Upgrade to Professional →
            </Link>
          </div>
        )}

        {/* Deal inputs */}
        <div className="border border-border rounded-xl bg-card p-5">
          <p className="kicker mb-3">Deal & assumptions</p>
          <input
            value={dealName}
            onChange={(e) => setDealName(e.target.value)}
            placeholder="Deal name (e.g. 12-unit — Maple St)"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-primary/60"
          />
          {Object.values(fieldMeta).some((m) => m?.source === "parsed") && (
            <div className="flex flex-wrap items-center gap-3 text-[9px] text-muted-foreground mb-3">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> parsed from document</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-pa-amber" /> parsed — low confidence, verify</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-zinc-600" /> your edit</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {INPUT_FIELDS.map(({ key, label, step }) => {
              const meta = fieldMeta[key];
              const isLow = meta?.source === "parsed" && meta.confidence === "low";
              const isParsed = meta?.source === "parsed" && meta.confidence !== "low";
              const borderClass = isLow ? "border-pa-amber focus:border-pa-amber"
                : isParsed ? "border-primary/60 focus:border-primary"
                : "border-border focus:border-primary/60";
              const bgClass = isLow ? "bg-pa-amber/5" : isParsed ? "bg-primary/5" : "bg-background";
              return (
                <div key={key}>
                  <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
                    {label}
                    {(isLow || isParsed) && (
                      <span
                        title={meta?.note ? `${isLow ? "Low confidence — verify: " : "Parsed — "}${meta.note}` : undefined}
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${isLow ? "bg-pa-amber" : "bg-primary"}`}
                      />
                    )}
                    {meta?.source === "manual" && (
                      <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-zinc-600" title="Edited by you" />
                    )}
                  </label>
                  <input
                    type="number" step={step} value={inputs[key]}
                    onChange={(e) => setNum(key, e.target.value)}
                    className={`w-full border rounded-lg px-3 py-2 text-sm font-mono tabular-nums focus:outline-none transition-colors ${borderClass} ${bgClass}`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Analysis history — click to reload a past deal into the pro-forma */}
        {pastAnalyses.length > 0 && (
          <div className="border border-border rounded-xl bg-card overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-baseline justify-between">
              <p className="kicker">Analysis history</p>
              <span className="text-[10px] text-zinc-500 font-mono">{pastAnalyses.length} saved</span>
            </div>
            <div className="divide-y divide-border max-h-64 overflow-y-auto">
              {pastAnalyses.map((a) => (
                <button
                  key={a.id}
                  onClick={() => {
                    setInputs({ ...US_DEFAULT_INPUTS, ...a.inputs });
                    setFieldMeta({}); // historical analyses don't carry parse provenance
                    setDealName(a.name ?? "");
                    setSavedId(a.id);
                    toast("Loaded — every input stays editable");
                  }}
                  className="w-full text-left px-5 py-2.5 hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold truncate">{a.name || "Untitled analysis"}</span>
                    <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                      {new Date(a.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                    {a.outputs.capRate != null ? `${Number(a.outputs.capRate).toFixed(2)}% cap` : ""}
                    {a.outputs.dscr != null ? ` · ${Number(a.outputs.dscr).toFixed(2)}x DSCR` : ""}
                    {a.outputs.cashOnCash != null ? ` · ${Number(a.outputs.cashOnCash).toFixed(1)}% CoC` : ""}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Criteria profile */}
        <div className="border border-border rounded-xl bg-card p-5">
          <button onClick={() => setCriteriaOpen((o) => !o)} className="w-full flex items-center justify-between">
            <p className="kicker">Screening criteria {criteriaId ? "· saved" : "· not saved yet"}</p>
            <span className="text-muted-foreground text-xs">{criteriaOpen ? "−" : "+"}</span>
          </button>
          {criteriaOpen && (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {CRITERIA_FIELDS.map(({ key, label, step }) => (
                  <div key={key}>
                    <label className="block text-[10px] text-muted-foreground mb-1">{label}</label>
                    <input
                      type="number" step={step}
                      value={criteria[key] ?? ""}
                      placeholder="—"
                      onChange={(e) => setCriteria((c) => ({
                        ...c, [key]: e.target.value === "" ? null : Number(e.target.value),
                      }))}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono tabular-nums focus:outline-none focus:border-primary/60"
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={onSaveCriteria} disabled={pendingSave}
                className="w-full bg-secondary border border-border text-sm font-semibold py-2.5 rounded-lg hover:border-primary/40 transition-colors disabled:opacity-60"
              >
                Save criteria profile — reused on every deal
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Right: live pro-forma + scorecard ─────────────────────────── */}
      <div className="lg:col-span-3 space-y-4 relative">
        {parsing && (
          <div className="absolute inset-0 z-10 -m-2 p-2 bg-background/70 backdrop-blur-[1px] rounded-xl flex flex-col items-center justify-center gap-2 text-center">
            <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold text-foreground">Updating pro-forma &amp; scorecard from parsed data…</p>
          </div>
        )}

        {/* Headline metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "NOI (yr 1)",   value: money(out.noi) },
            { label: "Cap rate",     value: `${out.capRate.toFixed(2)}%` },
            { label: "DSCR",         value: `${out.dscr.toFixed(2)}x` },
            { label: "Cash-on-cash", value: `${out.cashOnCash.toFixed(1)}%` },
          ].map(({ label, value }) => (
            <div key={label} className="border border-border rounded-xl bg-card px-4 py-3">
              <div className="text-[10px] text-muted-foreground mb-1">{label}</div>
              <div className="text-xl font-bold font-mono tabular-nums">{value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Price / unit", value: money(out.pricePerUnit) },
            { label: "Equity in",    value: money(out.equity) },
            { label: "Debt service", value: money(out.annualDebtService) },
            { label: `Exit value (${inputs.holdYears}yr)`, value: money(out.exitValue) },
          ].map(({ label, value }) => (
            <div key={label} className="border border-border rounded-xl bg-card px-4 py-3">
              <div className="text-[10px] text-muted-foreground mb-1">{label}</div>
              <div className="text-lg font-bold font-mono tabular-nums">{value}</div>
            </div>
          ))}
        </div>

        {/* Scorecard */}
        <div className={`border rounded-xl bg-card overflow-hidden ${allPass ? "border-emerald-500/40" : "border-border"}`}>
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <p className="kicker">Scorecard vs your criteria</p>
            <span className={`text-xs font-mono font-bold ${allPass ? "text-emerald-400" : "text-amber-400"}`}>
              {scorecard.filter((l) => l.pass).length}/{scorecard.length} criteria met
            </span>
          </div>
          <div className="divide-y divide-border">
            {scorecard.length === 0 && (
              <p className="px-5 py-4 text-sm text-muted-foreground">Set at least one criterion on the left to screen this deal.</p>
            )}
            {scorecard.map((l) => (
              <div key={l.metric} className="px-5 py-3 flex items-center gap-4">
                <span className={`text-sm font-bold w-5 ${l.pass ? "text-emerald-400" : "text-red-400"}`}>
                  {l.pass ? "✓" : "✗"}
                </span>
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
          <p className="px-5 py-2.5 border-t border-border text-[10px] text-zinc-500">{SCORECARD_DISCLAIMER}</p>
        </div>

        {/* Sensitivity */}
        <div className="border border-border rounded-xl bg-card p-5">
          <p className="kicker mb-1">Sensitivity — cash-on-cash</p>
          <p className="text-[10px] text-zinc-500 mb-3">financing rate ±1% × exit cap ±0.5%</p>
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
                        className={`border px-2 py-1.5 text-right tabular-nums ${
                          c.isBase ? "border-primary/50 bg-primary/10 text-primary font-bold" : "border-border"
                        }`}>
                      {c.cashOnCash.toFixed(1)}%
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Save + quota */}
        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={onSaveAnalysis}
            disabled={pendingSave || needsActivation || (!unlimited && quotaLeft <= 0)}
            className="bg-primary text-white font-semibold text-sm px-6 py-3 rounded-lg hover:bg-primary/85 transition-colors disabled:opacity-50"
          >
            {pendingSave ? "Saving…" : "Save analysis"}
          </button>
          <span className="text-xs text-muted-foreground">
            {unlimited
              ? "Unlimited screener runs on your plan"
              : needsActivation
              ? "Add a card above to activate your free analyses"
              : `${quotaLeft} of ${quotaLimit} screener runs left this month`}
          </span>
          {!unlimited && quotaLeft <= 0 && (
            <Link href="/pricing" className="text-xs text-primary hover:underline">Upgrade for unlimited →</Link>
          )}
          {savedId && (
            <button
              onClick={onShare}
              disabled={sharing}
              className="bg-secondary border border-border text-sm font-semibold px-5 py-3 rounded-lg hover:border-primary/40 transition-colors disabled:opacity-60"
            >
              {sharing ? "Creating link…" : "Share read-only link"}
            </button>
          )}
          {canExportDoc ? (
            <button
              onClick={onExportDoc}
              disabled={exporting}
              className="bg-secondary border border-border text-sm font-semibold px-5 py-3 rounded-lg hover:border-primary/40 transition-colors disabled:opacity-60"
            >
              {exporting ? "Exporting…" : "Export report (.doc)"}
            </button>
          ) : (
            <Link
              href="/pricing"
              className="text-xs text-muted-foreground hover:text-primary border border-border rounded-lg px-5 py-3 transition-colors"
              title="Export a forwardable pro-forma + scorecard document"
            >
              Export report — Professional feature →
            </Link>
          )}
        </div>

        <p className="text-[10px] text-zinc-500 leading-relaxed">
          All outputs are deterministic calculations from the inputs shown — no market comps,
          no rankings, no recommendations. {SCORECARD_DISCLAIMER}
        </p>
      </div>
    </div>
    </>
  );
}
