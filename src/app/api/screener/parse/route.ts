/**
 * POST /api/screener/parse — OM/rent-roll/T12 PDF → pro-forma prefill.
 *
 * Sends the PDF to Claude for structured extraction. Requires
 * ANTHROPIC_API_KEY; until it is configured this returns 503 and the client
 * falls back to manual entry (which is a first-class path, not a degradation).
 * Auth required; free tier must have quota remaining (parsing is the
 * expensive unit of work, per the usage-gated pricing model).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_PDF_BYTES = 8 * 1024 * 1024; // 8 MB
const FREE_LIMIT = 3;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "authentication_required" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "parser_unconfigured", message: "PDF parsing engine is not configured yet." },
      { status: 503 },
    );
  }

  // Quota: parsing shares the monthly analysis quota (compute is the cost).
  // Free quota activates only once a card is vaulted with Stripe.
  const { data: profile } = await supabase
    .from("profiles").select("subscription_tier, payment_method_on_file").eq("id", user.id).single();
  if ((profile?.subscription_tier ?? "free") === "free") {
    if (!profile?.payment_method_on_file) {
      return NextResponse.json({ error: "card_required" }, { status: 403 });
    }
    const monthStart = new Date();
    monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
    const { count } = await supabase
      .from("screener_analyses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", monthStart.toISOString());
    if ((count ?? 0) >= FREE_LIMIT) {
      return NextResponse.json({ error: "quota_exceeded" }, { status: 403 });
    }
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.type !== "application/pdf") {
    return NextResponse.json({ error: "pdf_required" }, { status: 400 });
  }
  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json({ error: "file_too_large", maxBytes: MAX_PDF_BYTES }, { status: 413 });
  }

  const b64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } },
          { type: "text", text:
            "Extract deal facts from this real-estate document (offering memo, rent roll, T12, or listing sheet). " +
            "Respond with ONLY a JSON object, no prose, using these keys (omit any you cannot find explicitly stated — never estimate): " +
            '{"name": string, "purchasePrice": number, "units": number, "avgRentMo": number, ' +
            '"otherIncomeYr": number, "expenseRatioPct": number, "vacancyPct": number}. ' +
            "purchasePrice = asking price in dollars; avgRentMo = average in-place monthly rent per unit; " +
            "expenseRatioPct = operating expenses as % of effective gross income if a T12 is present." },
        ],
      }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("[screener/parse] anthropic error:", res.status, detail.slice(0, 300));
    return NextResponse.json({ error: "parse_failed" }, { status: 502 });
  }

  const data = await res.json();
  const text: string = data?.content?.[0]?.text ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return NextResponse.json({ error: "parse_failed" }, { status: 502 });

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const clean: Record<string, number | string> = {};
    if (typeof parsed.name === "string") clean.name = parsed.name.slice(0, 120);
    for (const k of ["purchasePrice", "units", "avgRentMo", "otherIncomeYr", "expenseRatioPct", "vacancyPct"]) {
      const v = Number(parsed[k]);
      if (isFinite(v) && v >= 0) clean[k] = v;
    }
    return NextResponse.json(clean);
  } catch {
    return NextResponse.json({ error: "parse_failed" }, { status: 502 });
  }
}
