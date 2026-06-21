/**
 * prime-atlas Email Templates
 * Built for Resend — HTML emails with inline CSS (no external stylesheets).
 */

const BRAND = {
  bg:       "#0A0E1A",
  card:     "#0F1629",
  border:   "#1E2A45",
  green:    "#00E5A0",
  amber:    "#F5A623",
  text:     "#E8EAF0",
  muted:    "#6B7A99",
  navyText: "#0A0E1A",
};

function wrap(content: string, previewText = "") {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>prime-atlas</title>
  ${previewText ? `<span style="display:none;max-height:0;overflow:hidden;">${previewText}&nbsp;‌&nbsp;‌&nbsp;‌</span>` : ""}
</head>
<body style="margin:0;padding:0;background-color:${BRAND.bg};font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.bg};padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:580px;">

        <!-- Logo -->
        <tr><td style="padding-bottom:24px;">
          <a href="https://prime-atlas.com" style="text-decoration:none;">
            <span style="font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:700;color:${BRAND.green};letter-spacing:-0.5px;">prime-atlas</span>
          </a>
        </td></tr>

        <!-- Content -->
        ${content}

        <!-- Footer -->
        <tr><td style="padding-top:32px;border-top:1px solid ${BRAND.border};">
          <p style="margin:0;font-size:11px;color:${BRAND.muted};line-height:1.6;">
            You're receiving this because you have email alerts enabled for your watched municipalities.
            <a href="https://prime-atlas.com/watchlists" style="color:${BRAND.green};text-decoration:none;">Manage alerts</a>
            · <a href="https://prime-atlas.com/auth/unsubscribe" style="color:${BRAND.muted};">Unsubscribe</a>
          </p>
          <p style="margin:8px 0 0;font-size:11px;color:${BRAND.muted};">
            prime-atlas · Scores are algorithmic estimates, not financial advice.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export interface SignalAlertData {
  municipalityName: string;
  municipalityRegion: string;
  municipalitySlug: string;
  signalTitle: string;
  signalSummary: string;
  signalType: string;
  opportunityImpact: number;
  confidenceLevel: number;
  source: string;
  sourceUrl?: string;
  opportunityScore: number;
}

export function signalAlertEmail(data: SignalAlertData) {
  const impactColor = data.opportunityImpact >= 80 ? BRAND.green : data.opportunityImpact >= 55 ? BRAND.amber : BRAND.muted;
  const muniUrl = `https://prime-atlas.com/opportunities/${data.municipalitySlug}`;

  const content = `
    <!-- Alert badge -->
    <tr><td style="padding-bottom:20px;">
      <span style="display:inline-block;background:${BRAND.green}1A;border:1px solid ${BRAND.green}4D;color:${BRAND.green};font-size:11px;font-weight:600;padding:4px 10px;border-radius:100px;font-family:monospace;letter-spacing:0.5px;">
        ⚡ NEW SIGNAL DETECTED
      </span>
    </td></tr>

    <!-- Headline -->
    <tr><td style="padding-bottom:24px;">
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${BRAND.text};line-height:1.3;">
        ${data.signalTitle}
      </h1>
      <p style="margin:0;font-size:13px;color:${BRAND.muted};">
        ${data.municipalityName}, ${data.municipalityRegion}
        · ${data.signalType.replace(/_/g, " ")}
        · ${data.source}
      </p>
    </td></tr>

    <!-- Score pills -->
    <tr><td style="padding-bottom:24px;">
      <table cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding-right:12px;">
            <table style="background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:8px;padding:12px 16px;" cellpadding="0" cellspacing="0">
              <tr><td>
                <p style="margin:0;font-size:24px;font-weight:700;color:${impactColor};font-family:monospace;">${data.opportunityImpact}</p>
                <p style="margin:4px 0 0;font-size:11px;color:${BRAND.muted};">Opportunity Impact</p>
              </td></tr>
            </table>
          </td>
          <td style="padding-right:12px;">
            <table style="background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:8px;padding:12px 16px;" cellpadding="0" cellspacing="0">
              <tr><td>
                <p style="margin:0;font-size:24px;font-weight:700;color:${BRAND.green};font-family:monospace;">${data.opportunityScore}</p>
                <p style="margin:4px 0 0;font-size:11px;color:${BRAND.muted};">${data.municipalityName} Score</p>
              </td></tr>
            </table>
          </td>
          <td>
            <table style="background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:8px;padding:12px 16px;" cellpadding="0" cellspacing="0">
              <tr><td>
                <p style="margin:0;font-size:24px;font-weight:700;color:${BRAND.text};font-family:monospace;">${Math.round(data.confidenceLevel * 100)}%</p>
                <p style="margin:4px 0 0;font-size:11px;color:${BRAND.muted};">Confidence</p>
              </td></tr>
            </table>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- Summary card -->
    <tr><td style="padding-bottom:24px;">
      <table width="100%" style="background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:12px;padding:20px;" cellpadding="0" cellspacing="0">
        <tr><td>
          <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:${BRAND.muted};">Signal Summary</p>
          <p style="margin:0;font-size:14px;color:${BRAND.text};line-height:1.6;">${data.signalSummary}</p>
          ${data.sourceUrl ? `<p style="margin:12px 0 0;font-size:12px;"><a href="${data.sourceUrl}" style="color:${BRAND.green};text-decoration:none;">Read source →</a></p>` : ""}
        </td></tr>
      </table>
    </td></tr>

    <!-- CTA -->
    <tr><td style="padding-bottom:16px;">
      <a href="${muniUrl}" style="display:inline-block;background:${BRAND.green};color:${BRAND.navyText};font-size:14px;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none;">
        View ${data.municipalityName} opportunities →
      </a>
    </td></tr>

    <tr><td style="padding-bottom:32px;">
      <a href="https://prime-atlas.com/opportunities/finder" style="font-size:13px;color:${BRAND.green};text-decoration:none;">
        Open Opportunity Finder →
      </a>
    </td></tr>
  `;

  return {
    subject: `⚡ Signal: ${data.signalTitle} — Impact ${data.opportunityImpact}/100`,
    html: wrap(content, `New signal detected in ${data.municipalityName}: ${data.signalTitle}`),
  };
}

export interface DailyDigestData {
  userName: string;
  date: string;
  signals: SignalAlertData[];
  topMunicipality: { name: string; region: string; score: number; slug: string };
}

export function dailyDigestEmail(data: DailyDigestData) {
  const signalRows = data.signals.slice(0, 5).map((s) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid ${BRAND.border};">
        <p style="margin:0 0 2px;font-size:13px;font-weight:600;color:${BRAND.text};">${s.signalTitle}</p>
        <p style="margin:0;font-size:11px;color:${BRAND.muted};">${s.municipalityName}, ${s.municipalityRegion} · Impact: <span style="color:${BRAND.green};font-weight:600;">${s.opportunityImpact}</span></p>
      </td>
    </tr>
  `).join("");

  const content = `
    <tr><td style="padding-bottom:16px;">
      <p style="margin:0;font-size:13px;color:${BRAND.muted};">${data.date}</p>
      <h1 style="margin:8px 0;font-size:22px;font-weight:700;color:${BRAND.text};">Your Daily Intelligence Briefing</h1>
      <p style="margin:0;font-size:14px;color:${BRAND.muted};">Hi${data.userName ? ` ${data.userName}` : ""}. Here's what moved overnight.</p>
    </td></tr>

    <tr><td style="padding-bottom:24px;">
      <table width="100%" style="background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:12px;padding:16px 20px;" cellpadding="0" cellspacing="0">
        <tr><td style="padding-bottom:8px;">
          <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:${BRAND.muted};">Today's signals (${data.signals.length})</p>
        </td></tr>
        ${signalRows}
      </table>
    </td></tr>

    <tr><td style="padding-bottom:24px;">
      <a href="https://prime-atlas.com/signals" style="display:inline-block;background:${BRAND.green};color:${BRAND.navyText};font-size:14px;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none;">
        View all signals →
      </a>
    </td></tr>
  `;

  return {
    subject: `prime-atlas Daily: ${data.signals.length} new signal${data.signals.length !== 1 ? "s" : ""} · ${data.date}`,
    html: wrap(content, `${data.signals.length} new signals detected overnight`),
  };
}
