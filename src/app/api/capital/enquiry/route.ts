/**
 * POST /api/capital/enquiry
 * Stores a Capital deal enquiry + notifies the team.
 * Public endpoint — no auth required.
 */

import { type NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

const resend = new Resend(process.env.RESEND_API_KEY);

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  let body: {
    name?: string; email?: string; company?: string;
    fund_size?: string; target_return?: string; geography?: string; message?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.name?.trim() || !body.email?.trim()) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  const supabase = adminSupabase();

  // Store enquiry
  const { error } = await supabase.from("capital_enquiries").insert({
    name:          body.name.trim(),
    email:         body.email.trim().toLowerCase(),
    company:       body.company?.trim() ?? null,
    fund_size:     body.fund_size ?? null,
    target_return: body.target_return ?? null,
    geography:     body.geography ?? null,
    message:       body.message?.trim() ?? null,
  });

  if (error) {
    console.error("[capital/enquiry] DB error:", error);
    return NextResponse.json({ error: "Failed to store enquiry" }, { status: 500 });
  }

  const teamEmail = process.env.CAPITAL_TEAM_EMAIL ?? "capital@prime-atlas.com";
  const from      = process.env.RESEND_FROM_EMAIL ?? "capital@prime-atlas.com";

  // Notify team
  if (process.env.RESEND_API_KEY) {
    await resend.emails.send({
      from,
      to: [teamEmail],
      subject: `⚡ New Capital Enquiry — ${body.name} (${body.company ?? "no company"})`,
      html: `<pre style="font-family:monospace;font-size:13px;white-space:pre-wrap;">
Name:          ${body.name}
Email:         ${body.email}
Company:       ${body.company ?? "—"}
Fund size:     ${body.fund_size ?? "—"}
Target return: ${body.target_return ?? "—"}
Geography:     ${body.geography ?? "—"}

Message:
${body.message ?? "—"}
      </pre>`,
    }).catch(console.error);

    // Send confirmation to enquirer
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://prime-atlas.com";
    await resend.emails.send({
      from,
      to: [body.email],
      subject: "prime-atlas Capital — we'll be in touch",
      html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#0A0E1A;font-family:Inter,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
<tr><td align="center">
<table style="max-width:560px;width:100%;">
  <tr><td style="padding-bottom:24px;">
    <span style="font-size:18px;font-weight:700;color:#00E5A0;font-family:monospace;">prime-atlas Capital</span>
  </td></tr>
  <tr><td style="padding-bottom:20px;">
    <h1 style="margin:0;font-size:22px;font-weight:700;color:#E8EAF0;">Thanks, ${body.name.split(" ")[0]}.</h1>
    <p style="margin:12px 0 0;font-size:14px;color:#6B7A99;line-height:1.6;">
      We've received your enquiry and a member of the prime-atlas Capital team will be in touch within 2 business days to discuss your investment mandate.
    </p>
  </td></tr>
  <tr><td style="padding-bottom:28px;">
    <a href="${appUrl}/opportunities/finder" style="display:inline-block;background:#00E5A0;color:#0A0E1A;font-size:14px;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none;">
      Explore opportunities while you wait →
    </a>
  </td></tr>
  <tr><td style="border-top:1px solid #1E2A45;padding-top:20px;">
    <p style="margin:0;font-size:11px;color:#6B7A99;">prime-atlas Capital · Not investment advice.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`,
    }).catch(console.error);
  }

  return NextResponse.json({ ok: true });
}
