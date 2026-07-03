/**
 * Prime Atlas — Property Research Report Email
 *
 * Generates a fully branded HTML email with property data, investment
 * analysis, and agent contact details. Sent via Resend when a member
 * requests agent details on a market-feed listing.
 */

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

  // Scores
  conviction:     number;
  grossYield:     number;
  netYield:       number;
  irr3yr:         number;
  irr5yr:         number;
  irr10yr:        number;
  cashOnCash:     number;
  exit3yr:        string;
  exit5yr:        string;
  exit10yr:       string;
  monthlyRent:    string;
  strategy:       string;

  // Macro
  macroLabel:     string;
  macroText:      string;
  microText:      string;

  // Agent
  agentName:      string | null;
  agentCompany:   string | null;
  agentPhone:     string | null;
  agentEmail:     string | null;

  // Member
  memberName:     string;
  reportUrl:      string;           // link to the print report page
}

const SYM: Record<string, string> = { GBP: "£", USD: "$" };

function scoreColor(s: number): string {
  if (s >= 75) return "#16a34a";
  if (s >= 55) return "#1B4FE4";
  return "#d97706";
}

function yieldColor(y: number): string {
  if (y >= 7) return "#16a34a";
  if (y >= 5) return "#1B4FE4";
  return "#d97706";
}

export function buildPropertyReportEmail(d: PropertyReportData): { subject: string; html: string } {
  const subject = `Prime Atlas Research Report — ${d.location} · ${d.price}`;
  const sym     = SYM[d.currency] ?? "£";

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
          <p style="margin:0;font-size:18px;font-weight:800;" style="color:${scoreColor(d.conviction)}">${d.conviction}</p>
          <p style="margin:4px 0 0;font-size:9px;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px;">Conviction</p>
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
            <p style="margin:0;font-size:20px;font-weight:800;font-family:monospace;color:${yieldColor(d.grossYield)};">${d.grossYield}%</p>
            <p style="margin:4px 0 0;font-size:9px;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px;">Gross Yield</p>
          </div>
        </td>
        <td width="33%" style="padding-right:8px;">
          <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;padding:14px;text-align:center;">
            <p style="margin:0;font-size:20px;font-weight:800;font-family:monospace;color:${yieldColor(d.netYield)};">${d.netYield}%</p>
            <p style="margin:4px 0 0;font-size:9px;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px;">Net Yield</p>
          </div>
        </td>
        <td width="33%">
          <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;padding:14px;text-align:center;">
            <p style="margin:0;font-size:20px;font-weight:800;font-family:monospace;color:${scoreColor(d.irr5yr * 5)};">${d.irr5yr > 0 ? "+" : ""}${d.irr5yr}%</p>
            <p style="margin:4px 0 0;font-size:9px;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px;">5-Yr IRR</p>
          </div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Exit Architecture -->
  <tr><td style="padding:0 32px 24px;">
    <p style="margin:0 0 12px;font-size:10px;font-weight:700;color:#6B7A99;letter-spacing:2px;text-transform:uppercase;font-family:monospace;">Predictive Exit Architecture</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;">
      <tr style="background:#F9FAFB;border-bottom:1px solid #E5E7EB;">
        <td style="padding:8px 12px;font-size:9px;font-weight:700;color:#6B7A99;text-transform:uppercase;letter-spacing:1px;border-right:1px solid #E5E7EB;">Horizon</td>
        <td style="padding:8px 12px;font-size:9px;font-weight:700;color:#6B7A99;text-transform:uppercase;letter-spacing:1px;border-right:1px solid #E5E7EB;">IRR (Est.)</td>
        <td style="padding:8px 12px;font-size:9px;font-weight:700;color:#6B7A99;text-transform:uppercase;letter-spacing:1px;">Exit Value</td>
      </tr>
      <tr style="border-bottom:1px solid #E5E7EB;">
        <td style="padding:10px 12px;font-size:12px;font-weight:600;color:#0A0E1A;border-right:1px solid #E5E7EB;">3 Year</td>
        <td style="padding:10px 12px;font-size:13px;font-weight:800;font-family:monospace;color:${scoreColor(d.irr3yr * 5)};border-right:1px solid #E5E7EB;">${d.irr3yr > 0 ? "+" : ""}${d.irr3yr}%</td>
        <td style="padding:10px 12px;font-size:12px;font-weight:600;color:#4B5563;">${d.exit3yr}</td>
      </tr>
      <tr style="border-bottom:1px solid #E5E7EB;">
        <td style="padding:10px 12px;font-size:12px;font-weight:600;color:#0A0E1A;border-right:1px solid #E5E7EB;">5 Year</td>
        <td style="padding:10px 12px;font-size:13px;font-weight:800;font-family:monospace;color:${scoreColor(d.irr5yr * 5)};border-right:1px solid #E5E7EB;">${d.irr5yr > 0 ? "+" : ""}${d.irr5yr}%</td>
        <td style="padding:10px 12px;font-size:12px;font-weight:600;color:#4B5563;">${d.exit5yr}</td>
      </tr>
      <tr>
        <td style="padding:10px 12px;font-size:12px;font-weight:600;color:#0A0E1A;border-right:1px solid #E5E7EB;">10 Year</td>
        <td style="padding:10px 12px;font-size:13px;font-weight:800;font-family:monospace;color:${scoreColor(d.irr10yr * 5)};border-right:1px solid #E5E7EB;">${d.irr10yr > 0 ? "+" : ""}${d.irr10yr}%</td>
        <td style="padding:10px 12px;font-size:12px;font-weight:600;color:#4B5563;">${d.exit10yr}</td>
      </tr>
    </table>
    <p style="margin:6px 0 0;font-size:9px;color:#9CA3AF;font-family:monospace;">70% LTV · 5% IR · 3% p.a. appreciation assumed</p>
  </td></tr>

  <!-- Macro Outlook -->
  <tr><td style="padding:0 32px 24px;">
    <p style="margin:0 0 12px;font-size:10px;font-weight:700;color:#6B7A99;letter-spacing:2px;text-transform:uppercase;font-family:monospace;">Market Outlook · ${d.macroLabel}</p>
    <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;padding:16px;">
      <p style="margin:0 0 10px;font-size:13px;color:#374151;line-height:1.6;">${d.macroText}</p>
      <p style="margin:0;font-size:13px;color:#374151;line-height:1.6;">${d.microText}</p>
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
      <strong>DISCLAIMER:</strong> This report is produced by Prime Atlas for informational purposes only and does not constitute financial or investment advice. Yield and IRR projections are illustrative estimates based on market data and proprietary modelling. Actual returns will vary. Prime Atlas is not a regulated financial adviser. Always seek independent professional advice before making investment decisions.
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
