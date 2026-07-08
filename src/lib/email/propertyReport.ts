/**
 * Prime Atlas — Property Research Report Email
 *
 * Generates a fully branded HTML email with property data, real market
 * intelligence, and agent contact details. Sent via Resend when a member
 * requests agent details on a market-feed listing.
 *
 * Real data only (2026-07-09 market-feed audit fix): every figure comes
 * from the same engines the Deal Board / Investment Analysis Report / Deal
 * Brochure use — real market rent comps (>=10, market_rent_stats), the
 * ZIP-level comp screen (src/lib/comps.ts, >=5 same-ZIP/type/bedroom
 * comps), and the real screener/pro-forma engine for financing math. This
 * previously ran a hardcoded state-rent lookup table feeding fabricated
 * IRR/cash-on-cash/exit-value/conviction-score/canned-macro-text fields —
 * all removed. Below any real-data threshold: an explicit gap, never a
 * fallback estimate.
 */

export interface CompEvidenceLine { address: string; price: string; ppsm: string }
export interface DemandSignalLine { label: string; value: string; note: string }

export interface PropertyReportData {
  // Property
  id:             string;
  address:        string;
  location:       string;           // city/region
  price:          string;           // formatted, e.g. "£425,000"
  currency:       "GBP" | "USD";
  listingType:    "sale" | "rent";
  propertyType:   string | null;
  bedrooms:       number | null;
  bathrooms:      number | null;
  sizeSqm:        number | null;
  imageUrl:       string | null;

  // Market
  marketName:       string | null;
  opportunityScore: number | null;  // real municipality-level index, null if no market context
  demandSignals:    DemandSignalLine[]; // real, from marketReport.ts — [] if none available

  // Real yield (market_rent_stats gate, >=10 comps)
  grossYieldPct:  number | null;
  rentCompCount:  number;
  netYieldPct:    number | null;    // cap rate after vacancy/opex, requires real rent basis
  monthlyRent:    string | null;    // real market median rent, null if ungated

  // Real ZIP-comp discount (src/lib/comps.ts, >=5 comps)
  discountPct:       number | null;
  compBasisLabel:    string | null;
  comps:             CompEvidenceLine[]; // top 3, empty if no discount
  discountUnavailableReason: "not_covered" | "insufficient" | "implausible" | null;

  // Real financing scenario (computeScreener, one representative rate — see financingAssumptions)
  financingRatePct:  number;
  monthlyPI:         string;        // always real — price-based only
  dscr:              number | null; // requires real rent basis
  cashOnCashPct:     number | null; // requires real rent basis
  exitValue:         string | null; // requires real rent basis
  financingAssumptions: string;     // labeled assumptions line

  // Agent
  agentName:      string | null;
  agentCompany:   string | null;
  agentPhone:     string | null;
  agentEmail:     string | null;

  // Member
  memberName:     string;
  reportUrl:      string;           // link to the print report page
}

function yieldColor(y: number | null): string {
  if (y == null) return "#9CA3AF";
  if (y >= 7) return "#16a34a";
  if (y >= 5) return "#1B4FE4";
  return "#d97706";
}

function scoreColor(s: number | null): string {
  if (s == null) return "#9CA3AF";
  if (s >= 75) return "#16a34a";
  if (s >= 55) return "#1B4FE4";
  return "#d97706";
}

export function buildPropertyReportEmail(d: PropertyReportData): { subject: string; html: string } {
  const subject = `Prime Atlas Research Report — ${d.location} · ${d.price}`;

  const agentBlock = d.agentName || d.agentCompany || d.agentPhone
    ? `
      <tr><td style="padding:28px 32px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F7FF;border-radius:12px;border:1px solid #DBEAFE;">
          <tr><td style="padding:20px 24px;">
            <p style="margin:0 0 14px;font-size:10px;font-weight:700;color:#6B7A99;letter-spacing:2px;text-transform:uppercase;font-family:monospace;">
              Agent / Vendor Contact
            </p>
            ${d.agentName    ? `<p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#0A0E1A;">${d.agentName}</p>` : ""}
            ${d.agentCompany ? `<p style="margin:0 0 8px;font-size:13px;color:#4B5563;">${d.agentCompany}</p>` : ""}
            <table cellpadding="0" cellspacing="0">
              ${d.agentPhone ? `<tr><td style="padding:3px 0;font-size:13px;color:#0A0E1A;"><span style="color:#6B7A99;margin-right:8px;">📞</span><a href="tel:${d.agentPhone}" style="color:#1B4FE4;text-decoration:none;">${d.agentPhone}</a></td></tr>` : ""}
              ${d.agentEmail ? `<tr><td style="padding:3px 0;font-size:13px;color:#0A0E1A;"><span style="color:#6B7A99;margin-right:8px;">✉️</span><a href="mailto:${d.agentEmail}" style="color:#1B4FE4;text-decoration:none;">${d.agentEmail}</a></td></tr>` : ""}
            </table>
          </td></tr>
        </table>
      </td></tr>`
    : `
      <tr><td style="padding:28px 32px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F7FF;border-radius:12px;border:1px solid #DBEAFE;">
          <tr><td style="padding:20px 24px;">
            <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:#6B7A99;letter-spacing:2px;text-transform:uppercase;font-family:monospace;">Agent / Vendor Contact</p>
            <p style="margin:0;font-size:13px;font-weight:600;color:#0A0E1A;">Prime Atlas Research Desk</p>
            <p style="margin:4px 0 0;font-size:12px;color:#6B7A99;">Our team is verifying agent details for this listing. We will follow up within 24 hours with full contact information.</p>
          </td></tr>
        </table>
      </td></tr>`;

  const imageBlock = d.imageUrl
    ? `<tr><td style="padding:0 32px 24px;">
        <img src="${d.imageUrl}" alt="${d.location} property" width="560"
          style="width:100%;max-width:560px;height:260px;object-fit:cover;border-radius:12px;display:block;" />
      </td></tr>`
    : "";

  const discountLine = d.discountPct != null
    ? `<span style="color:#16a34a;font-weight:700;">${Math.abs(d.discountPct).toFixed(1)}% below</span> the median of ${d.comps.length}+ live comparables (${d.compBasisLabel ?? "same submarket"})`
    : d.discountUnavailableReason === "implausible"
      ? `Flagged as a likely data error (beyond ±60% of its comparable basis) — not shown as a discount`
      : d.discountUnavailableReason === "not_covered"
        ? `No ZIP-level comparable coverage for this market today — no discount is computed or implied`
        : `Insufficient comparable data — fewer than 5 live same-ZIP/type/bedroom comps exist for this listing`;

  const compRows = d.comps.length > 0 ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
      ${d.comps.map((c) => `<tr style="border-bottom:1px solid #E5E7EB;"><td style="padding:6px 10px;font-size:11px;color:#374151;">${c.address}</td><td style="padding:6px 10px;font-size:11px;color:#374151;text-align:right;font-family:monospace;">${c.price} · ${c.ppsm}</td></tr>`).join("")}
    </table>` : "";

  const signalLines = d.demandSignals.length > 0
    ? d.demandSignals.slice(0, 2).map((s) => `<p style="margin:0 0 8px;font-size:13px;color:#374151;line-height:1.6;"><strong>${s.label}:</strong> ${s.value} — ${s.note}</p>`).join("")
    : `<p style="margin:0;font-size:13px;color:#6B7A99;line-height:1.6;">Insufficient market data for a demand-signal read in this market.</p>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${subject}</title></head>
<body style="margin:0;padding:0;background:#F1F2EE;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F2EE;padding:32px 16px;">
<tr><td align="center">
<table style="max-width:620px;width:100%;background:#FFFFFF;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

  <!-- Header -->
  <tr><td style="background:#0A0E1A;padding:24px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <span style="font-size:15px;font-weight:800;color:#00E5A0;font-family:monospace;letter-spacing:1px;">
            PRIME ATLAS
          </span>
          <span style="display:block;font-size:10px;color:#6B7A99;letter-spacing:2px;text-transform:uppercase;margin-top:2px;">
            Property Research Report
          </span>
        </td>
        <td align="right">
          <span style="font-size:10px;color:#6B7A99;font-family:monospace;">
            ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
          </span>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Greeting -->
  <tr><td style="padding:28px 32px 20px;">
    <p style="margin:0 0 6px;font-size:13px;color:#6B7A99;">Hello ${d.memberName},</p>
    <h1 style="margin:0;font-size:26px;font-weight:800;color:#0A0E1A;line-height:1.2;">
      ${d.price}${d.listingType === "rent" ? "<span style='font-size:14px;font-weight:500;color:#6B7A99;'> /mo</span>" : ""}
    </h1>
    <p style="margin:6px 0 0;font-size:14px;color:#4B5563;font-weight:500;">${d.address}</p>
    <p style="margin:2px 0 0;font-size:11px;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px;">${d.location}</p>
  </td></tr>

  <!-- Image -->
  ${imageBlock}

  <!-- Specs row -->
  <tr><td style="padding:0 32px 24px;">
    <table cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;width:100%;">
      <tr style="background:#F9FAFB;">
        ${d.bedrooms  != null ? `<td style="padding:12px 16px;text-align:center;border-right:1px solid #E5E7EB;"><p style="margin:0;font-size:18px;font-weight:800;color:#0A0E1A;">${d.bedrooms}</p><p style="margin:4px 0 0;font-size:9px;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px;">Beds</p></td>` : ""}
        ${d.bathrooms != null ? `<td style="padding:12px 16px;text-align:center;border-right:1px solid #E5E7EB;"><p style="margin:0;font-size:18px;font-weight:800;color:#0A0E1A;">${d.bathrooms}</p><p style="margin:4px 0 0;font-size:9px;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px;">Baths</p></td>` : ""}
        ${d.sizeSqm   != null ? `<td style="padding:12px 16px;text-align:center;border-right:1px solid #E5E7EB;"><p style="margin:0;font-size:18px;font-weight:800;color:#0A0E1A;">${d.sizeSqm.toLocaleString()}</p><p style="margin:4px 0 0;font-size:9px;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px;">sqm</p></td>` : ""}
        <td style="padding:12px 16px;text-align:center;">
          <p style="margin:0;font-size:18px;font-weight:800;color:${scoreColor(d.opportunityScore)};">${d.opportunityScore ?? "—"}</p>
          <p style="margin:4px 0 0;font-size:9px;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px;">${d.marketName ?? "Market"} Index</p>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Investment Metrics -->
  <tr><td style="padding:0 32px 24px;">
    <p style="margin:0 0 12px;font-size:10px;font-weight:700;color:#6B7A99;letter-spacing:2px;text-transform:uppercase;font-family:monospace;">Investment Metrics</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="33%" style="padding-right:8px;">
          <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;padding:14px;text-align:center;">
            <p style="margin:0;font-size:20px;font-weight:800;font-family:monospace;color:${yieldColor(d.grossYieldPct)};">${d.grossYieldPct != null ? `${d.grossYieldPct.toFixed(1)}%` : "—"}</p>
            <p style="margin:4px 0 0;font-size:9px;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px;">Gross Yield</p>
          </div>
        </td>
        <td width="33%" style="padding-right:8px;">
          <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;padding:14px;text-align:center;">
            <p style="margin:0;font-size:20px;font-weight:800;font-family:monospace;color:${yieldColor(d.netYieldPct)};">${d.netYieldPct != null ? `${d.netYieldPct.toFixed(1)}%` : "—"}</p>
            <p style="margin:4px 0 0;font-size:9px;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px;">Net Yield</p>
          </div>
        </td>
        <td width="33%">
          <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;padding:14px;text-align:center;">
            <p style="margin:0;font-size:20px;font-weight:800;font-family:monospace;color:${d.discountPct != null ? "#16a34a" : "#9CA3AF"};">${d.discountPct != null ? `−${Math.abs(d.discountPct).toFixed(1)}%` : "—"}</p>
            <p style="margin:4px 0 0;font-size:9px;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px;">Discount vs Comps</p>
          </div>
        </td>
      </tr>
    </table>
    <p style="margin:8px 0 0;font-size:9px;color:#9CA3AF;">
      Gross yield requires ${"≥"}10 real rent comps for this market (${d.rentCompCount} on file). Metrics read "—" without real coverage — never a fallback estimate.
    </p>
  </td></tr>

  <!-- Comparable evidence -->
  <tr><td style="padding:0 32px 24px;">
    <p style="margin:0 0 8px;font-size:10px;font-weight:700;color:#6B7A99;letter-spacing:2px;text-transform:uppercase;font-family:monospace;">Pricing Basis</p>
    <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;padding:16px;">
      <p style="margin:0;font-size:13px;color:#374151;line-height:1.6;">${discountLine}</p>
      ${compRows}
    </div>
  </td></tr>

  <!-- Financing Scenario -->
  <tr><td style="padding:0 32px 24px;">
    <p style="margin:0 0 12px;font-size:10px;font-weight:700;color:#6B7A99;letter-spacing:2px;text-transform:uppercase;font-family:monospace;">Financing Scenario — Illustrative</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;">
      <tr style="background:#F9FAFB;border-bottom:1px solid #E5E7EB;">
        <td style="padding:8px 12px;font-size:9px;font-weight:700;color:#6B7A99;text-transform:uppercase;letter-spacing:1px;">Metric</td>
        <td style="padding:8px 12px;font-size:9px;font-weight:700;color:#6B7A99;text-transform:uppercase;letter-spacing:1px;text-align:right;">${d.financingRatePct}% rate</td>
      </tr>
      <tr style="border-bottom:1px solid #E5E7EB;">
        <td style="padding:10px 12px;font-size:12px;font-weight:600;color:#0A0E1A;">Monthly P&amp;I</td>
        <td style="padding:10px 12px;font-size:13px;font-weight:800;font-family:monospace;color:#0A0E1A;text-align:right;">${d.monthlyPI}</td>
      </tr>
      <tr style="border-bottom:1px solid #E5E7EB;">
        <td style="padding:10px 12px;font-size:12px;font-weight:600;color:#0A0E1A;">DSCR</td>
        <td style="padding:10px 12px;font-size:13px;font-weight:800;font-family:monospace;color:#0A0E1A;text-align:right;">${d.dscr != null ? d.dscr.toFixed(2) : "n/a — no real rent basis"}</td>
      </tr>
      <tr style="border-bottom:1px solid #E5E7EB;">
        <td style="padding:10px 12px;font-size:12px;font-weight:600;color:#0A0E1A;">Cash-on-cash</td>
        <td style="padding:10px 12px;font-size:13px;font-weight:800;font-family:monospace;color:#0A0E1A;text-align:right;">${d.cashOnCashPct != null ? `${d.cashOnCashPct > 0 ? "+" : ""}${d.cashOnCashPct}%` : "n/a"}</td>
      </tr>
      <tr>
        <td style="padding:10px 12px;font-size:12px;font-weight:600;color:#0A0E1A;">Exit value</td>
        <td style="padding:10px 12px;font-size:12px;font-weight:600;color:#4B5563;text-align:right;">${d.exitValue ?? "n/a"}</td>
      </tr>
    </table>
    <p style="margin:6px 0 0;font-size:9px;color:#9CA3AF;font-family:monospace;">${d.financingAssumptions}</p>
  </td></tr>

  <!-- Demand Signals -->
  <tr><td style="padding:0 32px 24px;">
    <p style="margin:0 0 12px;font-size:10px;font-weight:700;color:#6B7A99;letter-spacing:2px;text-transform:uppercase;font-family:monospace;">Demand Signals${d.marketName ? ` — ${d.marketName}` : ""}</p>
    <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;padding:16px;">
      ${signalLines}
    </div>
  </td></tr>

  <!-- Agent Contact -->
  ${agentBlock}

  <!-- CTA -->
  <tr><td style="padding:28px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0E1A;border-radius:12px;">
      <tr><td style="padding:20px 24px;" align="center">
        <p style="margin:0 0 12px;font-size:13px;color:#9CA3AF;line-height:1.5;">
          View the full interactive analysis on Prime Atlas, including comparables, live signals, and deal board positioning.
        </p>
        <a href="${d.reportUrl}"
          style="display:inline-block;background:#00E5A0;color:#0A0E1A;font-size:13px;font-weight:800;padding:12px 28px;border-radius:8px;text-decoration:none;letter-spacing:0.5px;">
          Open Full Report →
        </a>
      </td></tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:0 32px 28px;">
    <p style="margin:0;font-size:10px;color:#9CA3AF;line-height:1.6;border-top:1px solid #E5E7EB;padding-top:16px;">
      <strong>DISCLAIMER:</strong> This report is produced by Prime Atlas for informational purposes only and does not constitute financial or investment advice. Yield, discount, and financing figures are calculations from Prime Atlas's own live market data and comparable listings at the stated assumptions — never a fallback estimate below a real-data threshold. Actual returns will vary. Prime Atlas is not a regulated financial adviser. Always seek independent professional advice before making investment decisions.
    </p>
    <p style="margin:12px 0 0;font-size:10px;color:#9CA3AF;">
      © ${new Date().getFullYear()} Prime Atlas · <a href="https://prime-atlas.io" style="color:#6B7A99;text-decoration:none;">prime-atlas.io</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject, html };
}
