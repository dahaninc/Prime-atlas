"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  computeScreener, screenerSensitivity, buildScorecard,
  US_DEFAULT_INPUTS, SCORECARD_DISCLAIMER,
  type ScreenerInputs, type Criteria,
} from "@/lib/screener";
import { saveAnalysis, saveCriteria } from "./actions";
import { toast } from "@/components/ui/Toaster";

interface SavedCriteria extends Criteria { id: string; name: string }

interface Props {
  savedCriteria: SavedCriteria | null;
  quotaUsed: number;
  quotaLimit: number;
  unlimited: boolean;
}

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

export function ScreenerClient({ savedCriteria, quotaUsed, quotaLimit, unlimited }: Props) {
  const [inputs, setInputs] = useState<ScreenerInputs>(US_DEFAULT_INPUTS);
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
  const fileRef = useRef<HTMLInputElement>(null);

  const out  = useMemo(() => computeScreener(inputs), [inputs]);
  const sens = useMemo(() => screenerSensitivity(inputs), [inputs]);
  const scorecard = useMemo(() => buildScorecard(criteria, out), [criteria, out]);
  const allPass = scorecard.length > 0 && scorecard.every((l) => l.pass);
  const quotaLeft = unlimited ? Infinity : Math.max(0, quotaLimit - used);

  function setNum(key: keyof ScreenerInputs, v: string) {
    setInputs((p) => ({ ...p, [key]: Number(v) }));
  }

  async function onDropPdf(file: File) {
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/screener/parse", { method: "POST", body: fd });
      if (res.status === 503) {
        toast("PDF parsing engine not configured yet — enter the deal manually", "info");
        return;
      }
      if (!res.ok) {
        toast("Could not parse that PDF — enter the deal manually", "error");
        return;
      }
      const parsed = (await res.json()) as Partial<ScreenerInputs> & { name?: string };
      setInputs((p) => ({ ...p, ...Object.fromEntries(
        Object.entries(parsed).filter(([k, v]) => k !== "name" && typeof v === "number" && isFinite(v)),
      ) }));
      if (parsed.name) setDealName(parsed.name);
      toast("Parsed — review every prefilled number before relying on it");
    } finally {
      setParsing(false);
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
        } else {
          toast("Could not save analysis", "error");
        }
        return;
      }
      setUsed((u) => u + 1);
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
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

      {/* ── Left: deal inputs ─────────────────────────────────────────── */}
      <div className="lg:col-span-2 space-y-4">

        {/* PDF dropzone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onDropPdf(f); }}
          onClick={() => fileRef.current?.click()}
          className="border border-dashed border-primary/40 bg-primary/5 rounded-xl p-5 text-center cursor-pointer hover:bg-primary/10 transition-colors"
        >
          <input ref={fileRef} type="file" accept="application/pdf" className="hidden"
                 onChange={(e) => { const f = e.target.files?.[0]; if (f) onDropPdf(f); }} />
          <p className="text-sm font-semibold">{parsing ? "Parsing…" : "Drop an OM / rent roll / T12 PDF"}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Prefills the pro-forma — every parsed number stays editable. Or skip and enter manually below.
          </p>
        </div>

        {/* Deal inputs */}
        <div className="border border-border rounded-xl bg-card p-5">
          <p className="kicker mb-3">Deal & assumptions</p>
          <input
            value={dealName}
            onChange={(e) => setDealName(e.target.value)}
            placeholder="Deal name (e.g. 12-unit — Maple St)"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-primary/60"
          />
          <div className="grid grid-cols-2 gap-3">
            {INPUT_FIELDS.map(({ key, label, step }) => (
              <div key={key}>
                <label className="block text-[10px] text-muted-foreground mb-1">{label}</label>
                <input
                  type="number" step={step} value={inputs[key]}
                  onChange={(e) => setNum(key, e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono tabular-nums focus:outline-none focus:border-primary/60"
                />
              </div>
            ))}
          </div>
        </div>

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
      <div className="lg:col-span-3 space-y-4">

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
            disabled={pendingSave || (!unlimited && quotaLeft <= 0)}
            className="bg-primary text-white font-semibold text-sm px-6 py-3 rounded-lg hover:bg-primary/85 transition-colors disabled:opacity-50"
          >
            {pendingSave ? "Saving…" : "Save analysis"}
          </button>
          <span className="text-xs text-muted-foreground">
            {unlimited
              ? "Unlimited analyses on your plan"
              : `${quotaLeft} of ${quotaLimit} free analyses left this month`}
          </span>
          {!unlimited && quotaLeft <= 0 && (
            <Link href="/pricing" className="text-xs text-primary hover:underline">Upgrade for unlimited →</Link>
          )}
        </div>

        <p className="text-[10px] text-zinc-500 leading-relaxed">
          All outputs are deterministic calculations from the inputs shown — no market comps,
          no rankings, no recommendations. {SCORECARD_DISCLAIMER}
        </p>
      </div>
    </div>
  );
}
