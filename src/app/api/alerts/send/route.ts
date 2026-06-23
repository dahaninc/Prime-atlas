/**
 * POST /api/alerts/send
 *
 * Called by the `signal-alert` Supabase Edge Function when a new signal is
 * detected for a watched municipality.
 *
 * Auth: Bearer {SUPABASE_SERVICE_ROLE_KEY} — only internal callers.
 */

import { type NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { signalAlertEmail, dailyDigestEmail, type SignalAlertData } from "@/lib/email";

export const runtime = "edge";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SendAlertBody {
  type: "immediate" | "daily_digest";
  recipient: {
    email: string;
    name?: string;
  };
  signal?: SignalAlertData;         // for immediate
  signals?: SignalAlertData[];      // for daily_digest
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Validate internal caller
  const auth = req.headers.get("Authorization");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!auth || auth !== `Bearer ${serviceKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
  }

  let body: SendAlertBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM_EMAIL ?? "alerts@prime-atlas.com";

  try {
    if (body.type === "immediate") {
      if (!body.signal) {
        return NextResponse.json({ error: "Missing signal data" }, { status: 400 });
      }

      const { subject, html } = signalAlertEmail(body.signal);

      const result = await resend.emails.send({
        from,
        to: [body.recipient.email],
        subject,
        html,
      });

      return NextResponse.json({ ok: true, id: result.data?.id });
    }

    if (body.type === "daily_digest") {
      if (!body.signals || body.signals.length === 0) {
        return NextResponse.json({ ok: true, skipped: "no signals" });
      }

      const today = new Date().toLocaleDateString("en-GB", {
        day: "numeric", month: "long", year: "numeric",
      });

      const topMuni = body.signals.reduce((best, s) =>
        s.opportunityImpact > best.opportunityImpact ? s : best
      );

      const { subject, html } = dailyDigestEmail({
        userName: body.recipient.name ?? "",
        date: today,
        signals: body.signals,
        topMunicipality: {
          name: topMuni.municipalityName,
          region: topMuni.municipalityRegion,
          score: topMuni.opportunityScore,
          slug: topMuni.municipalitySlug,
        },
      });

      const result = await resend.emails.send({
        from,
        to: [body.recipient.email],
        subject,
        html,
      });

      return NextResponse.json({ ok: true, id: result.data?.id });
    }

    return NextResponse.json({ error: "Unknown type" }, { status: 400 });
  } catch (err) {
    console.error("[alerts/send] Resend error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Send failed" },
      { status: 500 }
    );
  }
}
