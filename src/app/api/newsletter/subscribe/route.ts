/**
 * POST /api/newsletter/subscribe
 * Adds email to Resend audience + stores in newsletter_subscribers table.
 * Public endpoint — no auth required.
 */

import { type NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  let body: { email?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const source = body.source ?? "footer";

  // 1. Store in Supabase (idempotent — UNIQUE constraint on email)
  const supabase = adminSupabase();
  await supabase
    .from("newsletter_subscribers")
    .upsert({ email, source }, { onConflict: "email", ignoreDuplicates: true });

  // 2. Add to Resend audience
  const resend = new Resend(process.env.RESEND_API_KEY);
  if (process.env.RESEND_AUDIENCE_ID) {
    try {
      await resend.contacts.create({
        email,
        audienceId: process.env.RESEND_AUDIENCE_ID,
        unsubscribed: false,
      });
    } catch (err) {
      // Don't fail the request if Resend is unavailable
      console.error("[newsletter/subscribe] Resend error:", err);
    }
  }

  // 3. Send welcome email
  if (process.env.RESEND_API_KEY) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://prime-atlas.com";
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "hello@prime-atlas.com",
      to: [email],
      subject: "Welcome to prime-atlas intelligence",
      html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/><title>prime-atlas</title></head>
<body style="margin:0;padding:0;background:#0A0E1A;font-family:Inter,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
<tr><td align="center">
<table style="max-width:560px;width:100%;">
  <tr><td style="padding-bottom:24px;">
    <span style="font-size:18px;font-weight:700;color:#00E5A0;font-family:monospace;">prime-atlas</span>
  </td></tr>
  <tr><td style="padding-bottom:20px;">
    <h1 style="margin:0;font-size:22px;font-weight:700;color:#E8EAF0;">You're in.</h1>
    <p style="margin:12px 0 0;font-size:14px;color:#6B7A99;line-height:1.6;">
      You'll receive our weekly intelligence digest — live deal flow, conviction scores,
      and AI-generated investment theses across USA and UK property markets.
    </p>
  </td></tr>
  <tr><td style="padding-bottom:28px;">
    <a href="${appUrl}/listings" style="display:inline-block;background:#00E5A0;color:#0A0E1A;font-size:14px;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none;">
      Explore the Listings Terminal →
    </a>
  </td></tr>
  <tr><td style="border-top:1px solid #1E2A45;padding-top:20px;">
    <p style="margin:0;font-size:11px;color:#6B7A99;">
      prime-atlas · Scores are algorithmic estimates, not financial advice.
      <a href="${appUrl}/auth/unsubscribe" style="color:#6B7A99;">Unsubscribe</a>
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`,
    }).catch(console.error);
  }

  return NextResponse.json({ ok: true });
}
