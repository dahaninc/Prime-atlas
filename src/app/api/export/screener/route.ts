/**
 * POST /api/export/screener
 *
 * Exports a single Deal Screener analysis (pro-forma + scorecard +
 * sensitivity) as a Word-editable document (.doc — same HTML interchange
 * format as /api/export/ic-memo, which committees open natively for
 * editing). This is the Screener's forwardable deliverable — the previous
 * "Share read-only link" only produced a web link, not a document a partner
 * could annotate offline.
 *
 * Gating is enforced SERVER-SIDE via src/lib/entitlements.ts
 * (screenerExportEnabled: Professional+): anonymous -> 401, below-entitlement
 * -> 403 with upgrade flag. The client button is a convenience, not the
 * security boundary.
 *
 * Where any input came from an OM/rent-roll/T12 parse, its confidence and
 * source citation are included in a provenance table — the exported
 * document should carry the same spot-check trail as the on-screen pro-forma.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canExportScreenerDoc } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

interface ScreenerExportPayload {
  name: string;
  inputs: Record<string, number>;
  outputs: Record<string, number>;
  scorecard: { metric: string; target: string; actual: string; pass: boolean; delta: string }[];
  sensitivity: { ratePct: number; capPct: number; cashOnCash: number; isBase: boolean }[][];
  fields?: Record<string, { confidence?: "high" | "low"; note?: string }>;
}

const esc = (v: unknown): string =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const INPUT_LABELS: Record<string, string> = {
  purchasePrice: "Purchase price ($)", units: "Units", avgRentMo: "Avg rent / unit / mo ($)",
  otherIncomeYr: "Other income / yr ($)", vacancyPct: "Vacancy %", expenseRatioPct: "Expense ratio % of EGI",
  ltvPct: "LTV %", interestPct: "Interest % (APR)", amortYears: "Amortization (yrs)",
  closingCostPct: "Closing costs %", exitCapPct: "Exit cap %", holdYears: "Hold (yrs)", rentGrowthPct: "Rent growth % / yr",
};

const OUTPUT_LABELS: Record<string, string> = {
  noi: "NOI (yr 1)", capRate: "Cap rate (%)", dscr: "DSCR (x)", cashOnCash: "Cash-on-cash (%)",
  pricePerUnit: "Price / unit ($)", equity: "Equity in ($)", annualDebtService: "Annual debt service ($)",
  exitValue: "Exit value ($)",
};

function kvRows(pairs: [string, unknown][]): string {
  return pairs.map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td class="v">${esc(v)}</td></tr>`).join("");
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles").select("subscription_tier").eq("id", user.id).single();
  const tier = profile?.subscription_tier ?? "free";
  if (!canExportScreenerDoc(tier)) {
    return NextResponse.json(
      {
        error: "upgrade_required",
        requiredTier: "professional",
        message: "Screener export is a Professional feature.",
      },
      { status: 403 },
    );
  }

  let p: ScreenerExportPayload;
  try {
    p = (await req.json()) as ScreenerExportPayload;
    if (!p?.inputs || !p?.outputs || !Array.isArray(p?.scorecard)) throw new Error("bad payload");
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const generated = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";
  const dealName = (p.name || "Untitled analysis").slice(0, 160);

  const scorecardRows = p.scorecard.map((l) => `
    <tr><td class="k">${l.pass ? "PASS" : "FAIL"} — ${esc(l.metric)}</td>
        <td class="v">target ${esc(l.target)} · actual ${esc(l.actual)} · ${esc(l.delta)}</td></tr>`).join("");

  const sensHeads = p.sensitivity[0]?.map((c) => `<th>exit cap ${esc(c.capPct.toFixed(2))}%</th>`).join("") ?? "";
  const sensRows = p.sensitivity.map((row) => `
    <tr>
      <td class="k">${esc(row[0].ratePct.toFixed(2))}% rate</td>
      ${row.map((c) => `<td class="num">${esc(c.cashOnCash.toFixed(1))}%</td>`).join("")}
    </tr>`).join("");

  const parsedFields = Object.entries(p.fields ?? {}).filter(([, f]) => f);
  const provenanceSection = parsedFields.length
    ? `<h2>4. Data Provenance — Parsed Fields</h2>
       <p class="meta">Fields prefilled from an uploaded OM/rent-roll/T12. Low-confidence extractions are flagged — verify against the source document before relying on them.</p>
       <table>${kvRows(parsedFields.map(([k, f]) => [
         `${INPUT_LABELS[k] ?? k}${f?.confidence === "low" ? " (LOW CONFIDENCE)" : ""}`,
         f?.note || "no source citation returned",
       ]))}</table>`
    : "";

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Deal Screener — ${esc(dealName)}</title>
<style>
  body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; color: #111; margin: 48px; font-size: 11pt; }
  h1 { font-size: 17pt; border-bottom: 2px solid #111; padding-bottom: 6px; }
  h2 { font-size: 13pt; margin-top: 24px; border-bottom: 1px solid #999; padding-bottom: 3px; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0; }
  td, th { border: 1px solid #bbb; padding: 4px 8px; text-align: left; font-size: 10pt; }
  th { background: #eee; }
  td.k { width: 42%; color: #333; }
  td.num { text-align: right; font-family: Consolas, monospace; }
  .meta { color: #555; font-size: 9pt; }
  .disclaimer { margin-top: 28px; font-size: 8pt; color: #666; border-top: 1px solid #ccc; padding-top: 8px; }
</style></head><body>

<h1>Deal Screener — ${esc(dealName)}</h1>
<p class="meta">Generated ${esc(generated)} · Analyst: ${esc(user.email ?? "—")}</p>

<h2>1. Key Metrics</h2>
<table>${kvRows(Object.entries(OUTPUT_LABELS).map(([k, label]) => [label, p.outputs[k] != null ? p.outputs[k] : "—"]))}</table>

<h2>2. Assumptions</h2>
<table>${kvRows(Object.entries(INPUT_LABELS).map(([k, label]) => [label, p.inputs[k] != null ? p.inputs[k] : "—"]))}</table>

<h2>3. Scorecard vs. Screening Criteria</h2>
${p.scorecard.length
  ? `<table>${scorecardRows}</table>`
  : `<p class="meta">No screening criteria were set for this analysis.</p>`}

<h3>Sensitivity — cash-on-cash (financing rate × exit cap)</h3>
<table><tr><th></th>${sensHeads}</tr>${sensRows}</table>

${provenanceSection}

<p class="disclaimer">This is a calculation against the inputs shown — not investment advice, an offer, or a solicitation.
No market comparables or rankings are included. Verify all figures independently before committee vote.</p>

<hr/>
<p style="font-size:9pt;color:#666">Prepared on <b>Prime Atlas</b> Deal Screener.</p>
</body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "application/msword",
      "Content-Disposition": `attachment; filename="screener-${dealName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}.doc"`,
      "Cache-Control": "no-store",
    },
  });
}
