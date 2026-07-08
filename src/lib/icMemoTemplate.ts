/**
 * Investment Analysis Report — HTML template (pure, no I/O).
 *
 * This is a MARKET-SCREENING memo: its subject is "the state of this
 * market and the live deals worth screening in it," not a single
 * development deal. There is deliberately no ground-up development
 * pro-forma here — that's a different investment strategy (build-new)
 * from the resale/acquisition deals this report screens, and stitching
 * the two together in one document read as incoherent (2026-07-08
 * rebuild). If a development-scenario appendix is wanted later, it needs
 * to be visibly, unambiguously separate from this analysis — not bolted
 * onto the end of it by default.
 *
 * Pulled out of the /api/export/ic-memo route so it's testable the same
 * way as the other engines (screener.ts, marketReport.ts, levers.ts,
 * proforma.ts) — deterministic string in, string out.
 *
 * Word's HTML renderer does not support flexbox, CSS grid, gradients, or
 * box-shadow — only tables, borders, and solid background-color. Every
 * "visual" below (score bars, colored callouts, accent blocks) is built
 * with nested tables and background-color for that reason.
 */

export interface DemandSignalPayload {
  label: string; value: string; reading: "strong" | "neutral" | "soft"; note: string;
}

export type UnrankedReason = "insufficient_data" | "implausible";

/** One comparable behind a ranked deal's discount — pre-formatted strings (money.ts / localizedPpsm). */
export interface CompEvidencePayload {
  address: string; price: string; ppsm: string;
}

export interface DealPayload {
  address: string; price: string; detail: string;
  discountPct: number | null;
  grossYieldPct: number | null;
  ranked: boolean;
  unrankedReason?: UnrankedReason | null;
  verdict: string;
  /** e.g. "ZIP 28202 · Condo · 2 bed" — the comparable-set definition this discount was measured in. */
  compBasisLabel?: string | null;
  /** The actual comparables the discount was measured against — the evidence that makes the claim auditable. */
  comps?: CompEvidencePayload[];
}

export interface NarrativePayload {
  thesis: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  demandSignals: DemandSignalPayload[];
}

export interface DiligenceItemPayload {
  label: string; desc: string;
}

export interface MemoPayload {
  market: { name: string; region: string; country: string; slug: string; population?: number | null };
  scores: Record<string, number>;
  momentum?: { previous: number; current: number } | null;
  pulse?: {
    sale_count: number; rent_count: number;
    median_price: string; median_ppsm_local: string;
    /** ZIP-comp mispricing count — listings 15–60% below their OWN comparable basis, same screen Section 3 ranks from. */
    underpriced_count: number;
    /** How many listings have a valid comp basis at all (≥5 same-ZIP/type/bedroom comps) — honest coverage, not assumed. */
    comp_coverage?: { covered: number; total: number } | null;
  } | null;
  narrative?: NarrativePayload | null;
  deals?: DealPayload[];
  diligence: DiligenceItemPayload[];
  evidence: { infra: string[]; planning: string[]; signals: string[] };
  provenance: { source: string; confidence: string; retrieved: string; freshness: string; listingBasis: string };
  analyst: string;
}

// Prime Atlas brand tokens — the ink/teal/status palette, reused here ahead
// of the web app's own visual pass so the exported artifact isn't stuck
// with Word's default blue-link aesthetic.
const INK = "#0F1E3D";
const ACCENT = "#1B6E6A";
const POSITIVE = "#1F8A4C";
const CAUTION = "#C77A0A";
const NEGATIVE = "#C0392B";
const BAR_TRACK = "#E2E5EA";

const esc = (v: unknown): string =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function kvRows(pairs: [string, unknown][]): string {
  return pairs.map(([k, v]) =>
    `<tr><td class="k">${esc(k)}</td><td class="v">${esc(v)}</td></tr>`).join("");
}

/** Word-safe horizontal bar: two table cells sized by percentage width. */
function scoreBar(label: string, score: number): string {
  const pct = Math.max(0, Math.min(100, Math.round(score)));
  const color = pct >= 75 ? POSITIVE : pct >= 55 ? CAUTION : NEGATIVE;
  return `
  <tr>
    <td style="width:120px;font-size:9pt;color:#333;border:none;padding:3px 8px 3px 0;">${esc(label)}</td>
    <td style="border:none;padding:3px 0;">
      <table style="width:100%;border-collapse:collapse;"><tr>
        <td style="background:${color};width:${pct}%;height:11px;font-size:1px;line-height:11px;border:none;">&nbsp;</td>
        <td style="background:${BAR_TRACK};width:${100 - pct}%;height:11px;font-size:1px;line-height:11px;border:none;">&nbsp;</td>
      </tr></table>
    </td>
    <td style="width:28px;text-align:right;font-size:9pt;font-family:Consolas,monospace;color:#111;border:none;padding:3px 0 3px 8px;">${pct}</td>
  </tr>`;
}

/** Colored executive-summary callout — value + label, tone-driven background. */
function statCell(label: string, value: string, tone: "positive" | "caution" | "negative" | "neutral"): string {
  const bg = tone === "positive" ? "#EAF3E9" : tone === "caution" ? "#FBF0E1" : tone === "negative" ? "#FBEAEA" : "#F0F1F3";
  const fg = tone === "positive" ? POSITIVE : tone === "caution" ? CAUTION : tone === "negative" ? NEGATIVE : "#333";
  return `
  <td style="background:${bg};border:1px solid #ddd;padding:10px 12px;width:25%;">
    <div style="font-size:8pt;color:#555;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:3px;">${esc(label)}</div>
    <div style="font-size:15pt;font-weight:bold;color:${fg};font-family:Consolas,monospace;">${esc(value)}</div>
  </td>`;
}

/** Demand-signal narrative block — colored left rail via a 4px accent cell. */
function signalBlock(sig: DemandSignalPayload): string {
  const color = sig.reading === "strong" ? POSITIVE : sig.reading === "soft" ? NEGATIVE : CAUTION;
  return `
  <table style="width:100%;border-collapse:collapse;margin:0 0 6px;"><tr>
    <td style="background:${color};width:4px;border:none;padding:0;">&nbsp;</td>
    <td style="border:1px solid #ddd;border-left:none;padding:8px 10px;">
      <div style="font-size:9.5pt;font-weight:bold;color:#111;">${esc(sig.label)}
        <span style="font-family:Consolas,monospace;font-weight:normal;color:${color};float:right;">${esc(sig.value)}</span>
      </div>
      <div style="font-size:9pt;color:#555;margin-top:2px;">${esc(sig.note)}</div>
    </td>
  </tr></table>`;
}

/**
 * Deterministic executive-summary paragraph — assembled from real computed
 * figures, not AI-generated prose, so the document's headline conclusion
 * carries the same defensibility as the rest of the "honest data" work.
 * Pulls exactly one line of macro context up from Section 2, per spec.
 */
function buildExecutiveSummary(p: MemoPayload, rankedCount: number, yieldAvailable: boolean): string {
  const macroLine = p.narrative?.demandSignals?.[0]?.note ?? null;

  const coverage = p.pulse?.comp_coverage ?? null;
  const pulseLine = p.pulse
    ? `${esc(p.market.name)} carries ${p.pulse.sale_count} active sale listings, ${p.pulse.underpriced_count} of which price at least 15% below their own ZIP-level comparable basis (same ZIP, property type, and bedroom count; minimum 5 comps), against a median asking price of ${esc(p.pulse.median_price)}.`
    : `Live sale-listing coverage for ${esc(p.market.name)} is limited in this data set.`;

  const coverageLine = coverage
    ? coverage.covered > 0
      ? `${coverage.covered} of ${coverage.total} listings currently have a valid comparable set; the rest read "insufficient comparable data" rather than a discount measured against a blended metro median.`
      : `No listing in this market currently has the 5+ same-ZIP comparables required to compute a defensible discount — comparable-set coverage is a data-density gap here, and this report shows "insufficient comparable data" rather than a discount measured against a blended metro median.`
    : null;

  const mispricedTotal = p.pulse?.underpriced_count ?? null;
  const screenLine = rankedCount > 0
    ? `Section 3 ranks the top ${rankedCount}${mispricedTotal != null ? ` of ${mispricedTotal}` : ""} by discount to ZIP-level comps, with the comparable evidence behind each discount${yieldAvailable ? " and real market-rent yield data" : "; rental-yield data is not yet available for this market"}.`
    : mispricedTotal != null && mispricedTotal > 0
      ? `${mispricedTotal} listings clear the 15% mispricing threshold against their comp basis, but none have the data needed to rank reliably in this report.`
      : `No live deals cleared the mispricing screening threshold for this market at time of writing.`;

  const riskLine = `Composite opportunity score is ${p.scores.opportunity ?? "—"}/100 (risk sub-score ${p.scores.risk ?? "—"}/100, higher is riskier). These are calculations against this market's own live data, not a recommendation to transact — screen every deal against your own criteria before committee.`;

  return [macroLine, pulseLine, coverageLine, screenLine, riskLine].filter(Boolean).join(" ");
}

export function buildMemoHtml(p: MemoPayload): string {
  const us = p.market.country === "United States";
  const generated = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";

  const ranked = (p.deals ?? []).filter((d) => d.ranked);
  const unranked = (p.deals ?? []).filter((d) => !d.ranked);
  const yieldAvailable = ranked.some((d) => d.grossYieldPct != null) || unranked.some((d) => d.grossYieldPct != null);

  const dealRow = (d: DealPayload) => `
    <tr>
      <td class="v">${esc(d.address)}</td>
      <td class="num">${esc(d.price)}</td>
      <td class="num">${d.discountPct != null ? `${d.discountPct >= 0 ? "−" : "+"}${esc(Math.abs(d.discountPct).toFixed(1))}%` : "n/a"}</td>
      <td class="num">${d.grossYieldPct != null ? `${esc(d.grossYieldPct.toFixed(1))}%` : "n/a"}</td>
      <td class="v">${esc(d.verdict)}</td>
    </tr>`;

  // The evidence that makes a discount auditable rather than asserted: the
  // actual comparables it was measured against, nested under the deal row.
  const compEvidenceRow = (d: DealPayload) => (d.comps && d.comps.length > 0) ? `
    <tr>
      <td colspan="5" style="border:1px solid #ccc;border-top:none;padding:6px 8px 8px;background:#FAFAFA;">
        <div style="font-size:8.5pt;color:#555;margin-bottom:3px;">Comparable evidence — ${esc(d.comps.length)} listings, ${esc(d.compBasisLabel ?? "same submarket")} (discount measured against this set's median):</div>
        <table style="margin:0;">
          <tr><th style="font-size:8.5pt;">Comparable</th><th style="font-size:8.5pt;">Asking</th><th style="font-size:8.5pt;">Rate</th></tr>
          ${d.comps.map((c) => `<tr>
            <td class="v" style="font-size:8.5pt;">${esc(c.address)}</td>
            <td class="num" style="font-size:8.5pt;">${esc(c.price)}</td>
            <td class="num" style="font-size:8.5pt;">${esc(c.ppsm)}</td>
          </tr>`).join("")}
        </table>
      </td>
    </tr>` : "";

  const unrankedNote = (reason: UnrankedReason | null | undefined) =>
    reason === "implausible"
      ? "Deals flagged here show a discount too large to be reliable (beyond the ±60% band) — treated as a likely data artifact, not a bargain, and excluded from ranking rather than presented as the top opportunity."
      : "Deals listed here lack the 5+ same-ZIP/type/bedroom comparables (or the size data) needed to compute a defensible discount and are not ranked against deals with fuller data.";

  const mispricedTotal = p.pulse?.underpriced_count ?? null;
  const rankedHeading = mispricedTotal != null && mispricedTotal > 0
    ? `Ranked by discount to ZIP-level comps — top ${ranked.length} of ${mispricedTotal} listings trading ≥15% below their own comparable basis`
    : `Ranked by discount to ZIP-level comps`;

  const dealsSection = (p.deals && p.deals.length > 0) ? `
<h2>3. Live Deals in Market</h2>
${ranked.length > 0 ? `
<h3>${esc(rankedHeading)}</h3>
<table>
  <tr><th>Address</th><th>Price</th><th>Discount</th><th>Gross yield</th><th>Read</th></tr>
  ${ranked.map((d) => dealRow(d) + compEvidenceRow(d)).join("")}
</table>` : mispricedTotal != null ? `<p class="meta">No listings in this market currently clear the 15% mispricing threshold with usable comp data.</p>` : ""}
${unranked.length > 0 ? `
<h3>Additional deals — not ranked</h3>
<p class="meta">${unrankedNote(unranked[0]?.unrankedReason)}</p>
<table>
  <tr><th>Address</th><th>Price</th><th>Discount</th><th>Gross yield</th><th>Read</th></tr>
  ${unranked.map(dealRow).join("")}
</table>` : ""}
<p class="meta">Discount is vs. the median of each listing's own comparable set — other live listings in the same ZIP,
of the same property type and bedroom count, minimum 5 comps — never a blended metro-wide median, and never padded with
sub-threshold listings to hit a round number. The comparables behind each ranked discount are shown so the claim can be
audited, not taken on faith. Restricted to the same ≥15%/≤60% band Section 1's mispricing count uses. A listing without
enough true comparables reads "insufficient comparable data" — no metro-median fallback. Gross yield uses this market's
real rent comps only, as a market-wide median basis (not adjusted for this specific listing's size or postcode) —
never a fallback or interpolated figure, and never shown for a market without real rent-comp coverage. "n/a" means the
underlying data doesn't exist yet for this market/listing, not a zero or a negative signal. Live scraped listings, not
a curated selection — verify current availability before committee vote.</p>
` : "";

  const sourceLine = p.narrative?.sourceName
    ? `<p class="meta">Source: ${esc(p.narrative.sourceName)}${p.narrative.sourceUrl ? ` — <a href="${esc(p.narrative.sourceUrl)}">${esc(p.narrative.sourceUrl)}</a>` : " (internal analysis, not an external citation)"}</p>`
    : "";

  const macroSignal = p.narrative?.demandSignals?.find((s) => s.label.toLowerCase().includes("mispricing"));
  const connectorLine = macroSignal
    ? `<p style="font-size:10.5pt;line-height:1.5;color:#222;">${esc(macroSignal.note)} This is the basis for the deal screen in Section 3 — a wide, real comp-basis dispersion is what fast, criteria-driven screening is for.</p>`
    : "";

  const narrativeSection = (p.narrative?.thesis || (p.narrative?.demandSignals?.length ?? 0) > 0) ? `
<h2>2. Macro &amp; Micro Analysis</h2>
${p.narrative?.thesis ? `<p style="font-size:10.5pt;line-height:1.5;color:#222;">${esc(p.narrative.thesis)}</p>${sourceLine}` : ""}
${(p.narrative?.demandSignals ?? []).map(signalBlock).join("")}
${connectorLine}
<p class="meta">Demand-signal narrative is a deterministic reading of live market data. The market thesis above may include AI-assisted analysis — see its source line; verify any specific claim independently before committee.</p>
` : "";

  const diligenceSection = p.diligence.length > 0 ? `
<h2>4. Diligence Roadmap — ${us ? "US Regulatory & Zoning" : "UK Planning & Compliance"}</h2>
<p class="meta">Steps committee approval would trigger, not a record of what has or hasn't been checked yet.</p>
<table>
  ${p.diligence.map((d) => `<tr><td class="k">${esc(d.label)}</td><td class="v">${esc(d.desc)}</td></tr>`).join("")}
</table>` : "";

  const list = (title: string, items: string[]) => items.length
    ? `<h3>${esc(title)}</h3><ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : "";

  const execSummary = buildExecutiveSummary(p, ranked.length, yieldAvailable);

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Investment Analysis — ${esc(p.market.name)}</title>
<style>
  body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; color: #111; margin: 0; font-size: 11pt; }
  .page { margin: 40px 48px 48px; }
  h2 { font-size: 13pt; margin-top: 26px; color: ${INK}; border-bottom: 2px solid ${ACCENT}; padding-bottom: 4px; }
  h3 { font-size: 11pt; margin: 14px 0 4px; color: ${INK}; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0; }
  td, th { border: 1px solid #ccc; padding: 4px 8px; text-align: left; font-size: 10pt; }
  th { background: #eee; }
  td.k { width: 38%; color: #333; }
  td.num { text-align: right; font-family: Consolas, monospace; }
  .meta { color: #666; font-size: 8.5pt; }
  .disclaimer { margin-top: 28px; font-size: 8pt; color: #666; border-top: 1px solid #ccc; padding-top: 8px; }
</style></head><body>

<table style="width:100%;border-collapse:collapse;margin:0;"><tr>
  <td style="background:${INK};border:none;padding:20px 48px;">
    <div style="font-size:13pt;font-weight:bold;color:#ffffff;letter-spacing:0.02em;">PRIME ATLAS</div>
    <div style="font-size:16pt;font-weight:bold;color:#ffffff;margin-top:6px;">${esc(p.market.name)}, ${esc(p.market.region)} — Investment Analysis <span style="font-weight:normal;color:#B9C6DC;">— Confidential</span></div>
    <div style="font-size:9pt;color:#B9C6DC;margin-top:4px;">Generated ${esc(generated)} · Prepared by ${esc(p.analyst)}</div>
  </td>
</tr></table>

<div class="page">

<h2 style="margin-top:18px;">1. Executive Summary</h2>
<p style="font-size:10.5pt;line-height:1.55;color:#222;">${execSummary}</p>

<table style="border:none;"><tr>
  ${statCell("Composite opportunity score", String(p.scores.opportunity ?? "—"), (p.scores.opportunity ?? 0) >= 75 ? "positive" : (p.scores.opportunity ?? 0) >= 55 ? "caution" : "negative")}
  ${statCell("Median asking price", p.pulse?.median_price ?? "n/a", "neutral")}
  ${statCell("Mispricing count", p.pulse ? `${p.pulse.underpriced_count} / ${p.pulse.sale_count}` : "n/a", "neutral")}
  ${statCell("Deals ranked / screened", `${ranked.length} / ${ranked.length + unranked.length}`, "neutral")}
</tr></table>

<h3>Sub-score breakdown</h3>
<table style="border:none;">
  ${scoreBar("Growth", p.scores.growth ?? 0)}
  ${scoreBar("Development", p.scores.development ?? 0)}
  ${scoreBar("Infrastructure", p.scores.infrastructure ?? 0)}
  ${scoreBar("Liquidity", p.scores.liquidity ?? 0)}
  ${scoreBar("Risk (inverted — higher is safer)", 100 - (p.scores.risk ?? 0))}
</table>

${p.pulse ? `<h3>Live market pulse</h3>
<table>${kvRows([
    ["Active sale listings", p.pulse.sale_count],
    ["Active rental listings", p.pulse.rent_count],
    ["Median asking price", p.pulse.median_price],
    [us ? "Median $/SF" : "Median £/sqm", p.pulse.median_ppsm_local],
    ["Listings ≥15% below ZIP-level comp basis (mispricing count)", p.pulse.underpriced_count],
    ...(p.pulse.comp_coverage
      ? [["Listings with a valid comp basis (≥5 same-ZIP/type/bedroom comps)", `${p.pulse.comp_coverage.covered} / ${p.pulse.comp_coverage.total}`] as [string, unknown]]
      : []),
    ...(p.momentum ? [["Score momentum (prev → current)", `${p.momentum.previous} → ${p.momentum.current}`] as [string, unknown]] : []),
  ])}</table>` : ""}

${narrativeSection}
${dealsSection}
${diligenceSection}
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

<p class="disclaimer">This is a market-screening analysis compiled from live scraped listings and index-based market scores.
Illustrative only — not investment advice, an offer, or a solicitation. Verify all figures independently before committee vote.</p>

<hr style="border:none;border-top:1px solid #ccc;margin-top:20px;"/>
<p style="font-size:9pt;color:#666">Prepared on <b style="color:${INK};">Prime Atlas</b>.</p>

</div>
</body></html>`;
}
