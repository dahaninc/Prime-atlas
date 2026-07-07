/**
 * POST /api/export/ic-memo
 *
 * Compiles the Deal Board's structured memo payload into a Word-editable
 * document (.doc — HTML interchange format Word opens natively for editing,
 * which committees require for internal debt-structuring notes).
 *
 * Gating is enforced SERVER-SIDE: anonymous -> 401, free tier -> 403 with
 * upgrade flag. The client button is a convenience, not the security boundary.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface MemoPayload {
  market: { name: string; region: string; country: string; slug: string };
  scores: Record<string, number>;
  momentum?: { previous: number; current: number } | null;
  pulse?: {
    sale_count: number; rent_count: number;
    median_price: string; median_ppsm_local: string; underpriced_count: number;
  } | null;
  pf: Record<string, number>;
  pfOut: Record<string, string>;
  sensitivity: { ratePct: number; capPct: number; marginOnGDV: number }[][];
  diligence: { label: string; desc: string; checked: boolean }[];
  evidence: { infra: string[]; planning: string[]; signals: string[] };
  provenance: { source: string; confidence: string; retrieved: string; freshness: string; listingBasis: string };
  analyst: string;
}

const esc = (v: unknown): string =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function kvRows(pairs: [string, unknown][]): string {
  return pairs.map(([k, v]) =>
    `<tr><td class="k">${esc(k)}</td><td class="v">${esc(v)}</td></tr>`).join("");
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
  if (tier === "free") {
    return NextResponse.json(
      { error: "upgrade_required", message: "Investment Analysis Report export is a Pro feature." },
      { status: 403 },
    );
  }

  let p: MemoPayload;
  try {
    p = (await req.json()) as MemoPayload;
    if (!p?.market?.name || !p?.pf || !p?.pfOut) throw new Error("bad payload");
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const us = p.market.country === "United States";
  const generated = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";

  const sensRows = p.sensitivity.map((row) => `
    <tr>
      <td class="k">${esc(row[0].ratePct.toFixed(1))}% rate</td>
      ${row.map((c) => `<td class="num">${esc(c.marginOnGDV.toFixed(1))}%</td>`).join("")}
    </tr>`).join("");
  const capHeads = p.sensitivity[0]?.map((c) =>
    `<th>exit cap ${esc(c.capPct.toFixed(2))}%</th>`).join("") ?? "";

  const diligenceRows = p.diligence.map((d) => `
    <tr><td class="k">${d.checked ? "☑" : "☐"} ${esc(d.label)}</td>
        <td class="v">${esc(d.desc)}${d.checked ? " — reviewed by analyst" : " — <b>not reviewed</b>"}</td></tr>`).join("");

  const list = (title: string, items: string[]) => items.length
    ? `<h3>${esc(title)}</h3><ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : "";

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Investment Analysis Report — ${esc(p.market.name)}</title>
<style>
  body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; color: #111; margin: 48px; font-size: 11pt; }
  h1 { font-size: 17pt; border-bottom: 2px solid #111; padding-bottom: 6px; }
  h2 { font-size: 13pt; margin-top: 24px; border-bottom: 1px solid #999; padding-bottom: 3px; }
  h3 { font-size: 11pt; margin: 14px 0 4px; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0; }
  td, th { border: 1px solid #bbb; padding: 4px 8px; text-align: left; font-size: 10pt; }
  th { background: #eee; }
  td.k { width: 38%; color: #333; }
  td.num { text-align: right; font-family: Consolas, monospace; }
  .meta { color: #555; font-size: 9pt; }
  .disclaimer { margin-top: 28px; font-size: 8pt; color: #666; border-top: 1px solid #ccc; padding-top: 8px; }
</style></head><body>

<h1>Investment Analysis Report — ${esc(p.market.name)}, ${esc(p.market.region)}</h1>
<p class="meta">Generated ${esc(generated)} · Analyst: ${esc(p.analyst)} · Market: ${esc(p.market.country)}</p>

<h2>1. Executive Summary — Core Financial Matrix</h2>
<table>${kvRows([
    ["Target market", `${p.market.name}, ${p.market.region}, ${p.market.country}`],
    ["All-in development cost", p.pfOut.totalDevCost],
    ["Stabilized NOI (10-mo lease-up assumed)", p.pfOut.annualNOI],
    [us ? "Stabilized exit value (GDV)" : "Gross development value (GDV)", p.pfOut.exitValue],
    ["Yield-on-cost (unlevered)", p.pfOut.yieldOnCost],
    ["Development margin on cost", p.pfOut.marginOnCost],
    [us ? "Development equity margin on GDV (screen ≥ 18%)" : "Equity margin on GDV", p.pfOut.marginOnGDV],
  ])}</table>

<h2>2. Market Pulse — Live Data &amp; Discount Delta</h2>
<table>${kvRows([
    ["Composite opportunity score", p.scores.opportunity ?? "—"],
    ...(p.momentum ? [
      ["Score momentum (prev → current)", `${p.momentum.previous} → ${p.momentum.current}`] as [string, unknown],
    ] : []),
    ...(p.pulse ? [
      ["Active sale listings", p.pulse.sale_count],
      ["Active rental listings", p.pulse.rent_count],
      ["Median asking price", p.pulse.median_price],
      [us ? "Median $/SF" : "Median £/sqm", p.pulse.median_ppsm_local],
      ["Listings ≥15% below median (mispricing count)", p.pulse.underpriced_count],
    ] as [string, unknown][] : []),
    ["Sub-scores", `growth ${p.scores.growth} · development ${p.scores.development} · infrastructure ${p.scores.infrastructure} · liquidity ${p.scores.liquidity} · risk ${p.scores.risk}`],
  ])}</table>

<h2>3. Financial Model — Pro-Forma &amp; Sensitivity</h2>
<h3>Assumptions</h3>
<table>${kvRows(Object.entries(p.pf))}</table>
<h3>Development margin on GDV — financing rate × exit cap</h3>
<table><tr><th></th>${capHeads}</tr>${sensRows}</table>

<h2>4. Diligence Trail — ${us ? "US Regulatory & Zoning" : "UK Planning & Compliance"} Checklist</h2>
<table>${diligenceRows}</table>
${list("Infrastructure pipeline (tracked)", p.evidence.infra)}
${list("Planning applications (recent)", p.evidence.planning)}
${list("Market signals (recent)", p.evidence.signals)}

<h2>5. Data Provenance — Citation Directory</h2>
<table>${kvRows([
    ["Market baseline", p.provenance.listingBasis],
    ["Primary source", p.provenance.source],
    ["Data confidence", p.provenance.confidence],
    ["Data retrieved", p.provenance.retrieved],
    ["Market freshness", p.provenance.freshness],
  ])}</table>

<p class="disclaimer">Preliminary underwrite compiled from analyst-set assumptions and index-based market scores.
Illustrative only — not investment advice, an offer, or a solicitation. Verify all figures independently before committee vote.</p>

<hr/>
<p style="font-size:9pt;color:#666">
Prepared on <b>Prime Atlas</b> — live US &amp; UK market intelligence for acquisition committees.<br/>
The live data behind this memorandum (conviction scores, inventory, mispricing feed, rate scenarios):
<a href="${(process.env.NEXT_PUBLIC_APP_URL ?? "https://prime-atlas-weld.vercel.app")}/opportunities/${p.market.slug || ""}">${(process.env.NEXT_PUBLIC_APP_URL ?? "https://prime-atlas-weld.vercel.app").replace(/^https?:\/\//, "")}/opportunities/${p.market.slug || ""}</a><br/>
Committee members can screen deals against their own criteria free at
<a href="${(process.env.NEXT_PUBLIC_APP_URL ?? "https://prime-atlas-weld.vercel.app")}">${(process.env.NEXT_PUBLIC_APP_URL ?? "https://prime-atlas-weld.vercel.app").replace(/^https?:\/\//, "")}</a>.
</p>
</body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "application/msword",
      "Content-Disposition": `attachment; filename="investment-analysis-${p.market.slug || "market"}.doc"`,
      "Cache-Control": "no-store",
    },
  });
}
