/**
 * Deal Brochure — multi-property export template (pure, no I/O).
 *
 * The user-facing "take this to your people" artifact: a structured pack of
 * selected deals an investor can hand to a partner, an agent, or a mortgage
 * broker to open a preliminary financing conversation. Structured around
 * what that conversation actually needs (standard US/UK practice for a
 * preliminary / decision-in-principle discussion on an investment
 * property):
 *   1. Property identification — address, type, size, photos.
 *   2. Price and the evidence behind the pricing view — ZIP-level comps,
 *      shown, or an explicit "insufficient comparable data".
 *   3. Income basis — real market rent comps where they exist (never a
 *      heuristic), and the gross yield they imply.
 *   4. Financing scenarios — indicative P&I / DSCR / cash-to-close at
 *      LABELED assumptions (75% LTV, 30yr amortization, rate scenarios),
 *      computed by the same screener engine the product uses. A lender
 *      quote this is not, and it says so.
 *   5. Listing contact — where the user's contact-reveal quota covers it.
 *   6. What a lender will still require — so the pack reads as a
 *      preparation document, not an approval.
 *
 * Honesty rules (same as icMemoTemplate):
 *  - No fabricated numbers: discount requires the ZIP-comp basis; yield/
 *    DSCR require real market rent comps; anything else renders as an
 *    explicit gap, never an estimate.
 *  - All financing figures carry their assumptions inline.
 *  - Deltas and calculations only — never advice language.
 *
 * Word's HTML renderer: tables/borders/solid colors only (no flexbox/grid).
 */

export interface BrochureCompPayload {
  address: string; price: string; ppsm: string;
}

export interface BrochureFinancingScenario {
  ratePct: number;
  monthlyPI: string;       // pre-formatted, major units
  dscr: number | null;     // null when no real rent basis
  cashToClose: string;     // down payment + closing costs, pre-formatted
}

export interface BrochurePropertyPayload {
  address: string;
  market: string;          // "Charlotte, North Carolina — USA"
  price: string;           // pre-formatted
  detail: string;          // "2 bed · 1 bath · Condo · 78 sqm"
  images: string[];        // up to 2 public URLs
  listingUrl?: string | null;
  // Pricing evidence
  discountPct: number | null;
  compBasisLabel: string | null;
  comps: BrochureCompPayload[];
  // Income basis
  grossYieldPct: number | null;
  rentCompCount: number;
  medianRentDisplay: string | null;  // pre-formatted monthly, null when insufficient
  // Financing
  financing: BrochureFinancingScenario[];
  // Contact
  agent: { name: string | null; company: string | null; phone: string | null; email: string | null } | null;
  contactWithheldReason: "quota" | null;
}

export interface BrochurePayload {
  preparedFor: string;      // account email
  properties: BrochurePropertyPayload[];
  assumptions: {
    ltvPct: number; amortYears: number; vacancyPct: number; expenseRatioPct: number; closingCostPct: number;
  };
  generatedAtIso: string;
}

const INK = "#0F1E3D";
const ACCENT = "#1B6E6A";
const POSITIVE = "#1F8A4C";

const esc = (v: unknown): string =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function summaryLine(p: BrochurePayload): string {
  const n = p.properties.length;
  const withDiscount = p.properties.filter((x) => x.discountPct != null);
  const avgDiscount = withDiscount.length
    ? withDiscount.reduce((s, x) => s + (x.discountPct as number), 0) / withDiscount.length
    : null;
  const markets = Array.from(new Set(p.properties.map((x) => x.market)));
  return `${n} propert${n === 1 ? "y" : "ies"} across ${markets.length} market${markets.length === 1 ? "" : "s"}` +
    (avgDiscount != null
      ? `; ${withDiscount.length} carry a computed ZIP-comp discount (average ${avgDiscount.toFixed(1)}% below their own comparable basis)`
      : "") + ".";
}

function propertyBlock(d: BrochurePropertyPayload, idx: number): string {
  const imgs = d.images.slice(0, 2).map((u) =>
    `<td style="border:1px solid #ddd;padding:0;width:50%;"><img src="${esc(u)}" width="330" style="width:100%;display:block;" alt=""/></td>`).join("");

  const discountRow = d.discountPct != null
    ? `<tr><td class="k">Pricing vs comparables</td><td class="v"><b style="color:${POSITIVE};">${esc(d.discountPct.toFixed(1))}% below</b> the median of ${d.comps.length} live comps (${esc(d.compBasisLabel ?? "same submarket")})</td></tr>`
    : `<tr><td class="k">Pricing vs comparables</td><td class="v">Insufficient comparable data — fewer than 5 live same-ZIP/type/bedroom comps; no discount is computed or implied</td></tr>`;

  const rentRow = d.grossYieldPct != null && d.medianRentDisplay
    ? `<tr><td class="k">Income basis</td><td class="v">Market median rent ${esc(d.medianRentDisplay)}/mo (${d.rentCompCount} live rent comps) → <b>${esc(d.grossYieldPct.toFixed(1))}% gross yield</b> at asking</td></tr>`
    : `<tr><td class="k">Income basis</td><td class="v">Insufficient rent-comp data for this market — no yield estimated</td></tr>`;

  const compTable = d.comps.length > 0 ? `
  <p class="meta" style="margin:8px 0 2px;">Comparable evidence — the listings this pricing view is measured against:</p>
  <table>
    <tr><th>Comparable</th><th>Asking</th><th>Rate</th></tr>
    ${d.comps.map((c) => `<tr><td class="v">${esc(c.address)}</td><td class="num">${esc(c.price)}</td><td class="num">${esc(c.ppsm)}</td></tr>`).join("")}
  </table>` : "";

  const finTable = d.financing.length > 0 ? `
  <p class="meta" style="margin:8px 0 2px;">Indicative financing scenarios (see assumptions on page 1 — not a quote, not an offer of credit):</p>
  <table>
    <tr><th>Rate</th><th>Monthly P&amp;I</th><th>DSCR</th><th>Est. cash to close</th></tr>
    ${d.financing.map((f) => `<tr>
      <td class="num">${esc(f.ratePct.toFixed(1))}%</td>
      <td class="num">${esc(f.monthlyPI)}</td>
      <td class="num">${f.dscr != null ? esc(f.dscr.toFixed(2)) : "n/a — no real rent basis"}</td>
      <td class="num">${esc(f.cashToClose)}</td>
    </tr>`).join("")}
  </table>` : "";

  const agentBlock = d.agent
    ? `<tr><td class="k">Listing contact</td><td class="v">${esc([d.agent.name, d.agent.company].filter(Boolean).join(" · ") || "On file")}${d.agent.phone ? ` · ${esc(d.agent.phone)}` : ""}${d.agent.email ? ` · ${esc(d.agent.email)}` : ""}</td></tr>`
    : d.contactWithheldReason === "quota"
      ? `<tr><td class="k">Listing contact</td><td class="v">Withheld — monthly contact-reveal quota reached on this account; upgrade or reveal next month</td></tr>`
      : `<tr><td class="k">Listing contact</td><td class="v">Not on file for this listing</td></tr>`;

  return `
<h2>${idx + 1}. ${esc(d.address)}</h2>
<p class="meta">${esc(d.market)}${d.listingUrl ? ` · <a href="${esc(d.listingUrl)}">original listing</a>` : ""}</p>
${imgs ? `<table style="border-collapse:collapse;width:100%;margin:6px 0;"><tr>${imgs}</tr></table>` : ""}
<table>
  <tr><td class="k">Asking price</td><td class="v"><b>${esc(d.price)}</b></td></tr>
  <tr><td class="k">Property</td><td class="v">${esc(d.detail)}</td></tr>
  ${discountRow}
  ${rentRow}
  ${agentBlock}
</table>
${compTable}
${finTable}`;
}

export function buildDealBrochureHtml(p: BrochurePayload): string {
  const a = p.assumptions;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Prime Atlas — Deal Brochure</title>
<style>
  body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; color: #111; margin: 0; font-size: 11pt; }
  .page { margin: 40px 48px 48px; }
  h2 { font-size: 13pt; margin-top: 26px; color: ${INK}; border-bottom: 2px solid ${ACCENT}; padding-bottom: 4px; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0; }
  td, th { border: 1px solid #ccc; padding: 4px 8px; text-align: left; font-size: 10pt; }
  th { background: #eee; }
  td.k { width: 30%; color: #333; }
  td.num { text-align: right; font-family: Consolas, monospace; }
  .meta { color: #666; font-size: 8.5pt; }
  .disclaimer { margin-top: 28px; font-size: 8pt; color: #666; border-top: 1px solid #ccc; padding-top: 8px; }
</style></head><body>

<table style="width:100%;border-collapse:collapse;margin:0;"><tr>
  <td style="background:${INK};border:none;padding:20px 48px;">
    <div style="font-size:13pt;font-weight:bold;color:#ffffff;letter-spacing:0.02em;">PRIME ATLAS</div>
    <div style="font-size:16pt;font-weight:bold;color:#ffffff;margin-top:6px;">Deal Brochure <span style="font-weight:normal;color:#B9C6DC;">— Preliminary Financing Discussion Pack</span></div>
    <div style="font-size:9pt;color:#B9C6DC;margin-top:4px;">Prepared for ${esc(p.preparedFor)} · Generated ${esc(p.generatedAtIso.slice(0, 16).replace("T", " "))} UTC</div>
  </td>
</tr></table>

<div class="page">

<h2 style="margin-top:18px;">Pack Summary</h2>
<p style="font-size:10.5pt;line-height:1.55;color:#222;">${esc(summaryLine(p))}
This pack is a preparation document for a preliminary conversation with an agent, partner, or mortgage
broker — every figure is a calculation from live market data with its basis shown, not an appraisal,
valuation, or lending decision.</p>

<h2>Financing Assumptions (apply to every scenario table below)</h2>
<table>
  <tr><td class="k">Loan-to-value</td><td class="v">${esc(a.ltvPct)}% (${esc(100 - a.ltvPct)}% down payment — typical investment-property requirement; your lender sets the real figure)</td></tr>
  <tr><td class="k">Amortization</td><td class="v">${esc(a.amortYears)} years, principal &amp; interest only — property taxes, insurance, and any HOA/service charges are NOT included</td></tr>
  <tr><td class="k">DSCR basis</td><td class="v">Net operating income at ${esc(a.vacancyPct)}% vacancy and ${esc(a.expenseRatioPct)}% operating-expense ratio on market median rent — computed only where 10+ real rent comps exist</td></tr>
  <tr><td class="k">Cash to close</td><td class="v">Down payment + ${esc(a.closingCostPct)}% estimated closing costs</td></tr>
  <tr><td class="k">Rates shown</td><td class="v">Illustrative scenario rates, not offers — actual pricing depends on borrower profile, product, and market at time of application</td></tr>
</table>

${p.properties.map(propertyBlock).join("\n")}

<h2>What a Lender Will Still Require</h2>
<table>
  <tr><td class="k">Valuation</td><td class="v">Independent appraisal / RICS survey of the specific property</td></tr>
  <tr><td class="k">Borrower file</td><td class="v">Proof of income or rental coverage, asset/reserve statements, credit report, ID/KYC</td></tr>
  <tr><td class="k">Property file</td><td class="v">Insurance quote, title search, HOA/leasehold documents where applicable</td></tr>
  <tr><td class="k">Verification</td><td class="v">Current availability and asking price of each listing — live listings move; confirm before proceeding</td></tr>
</table>

<p class="disclaimer">Compiled from live scraped listings and Prime Atlas calculation engines. Illustrative only —
not investment advice, not mortgage advice, not an offer or arrangement of credit, and not a valuation.
Figures marked "insufficient data" reflect real coverage gaps and are never estimated. Verify all figures
independently before any commitment.</p>

<hr style="border:none;border-top:1px solid #ccc;margin-top:20px;"/>
<p style="font-size:9pt;color:#666">Prepared on <b style="color:${INK};">Prime Atlas</b>.</p>

</div>
</body></html>`;
}
