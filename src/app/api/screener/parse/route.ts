/**
 * POST /api/screener/parse — OM/rent-roll/T12 PDF → pro-forma prefill.
 *
 * Sends the PDF to Claude for structured extraction. Requires
 * ANTHROPIC_API_KEY; until it is configured this returns 503 and the client
 * falls back to manual entry (which is a first-class path, not a degradation).
 * Auth required. OM parsing is a Professional+ entitlement (see
 * src/lib/entitlements.ts) — free/Explorer get "upgrade_required", not a
 * raw 403, so the client can render it as an upsell rather than an error.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canParseOm, checkScreenerQuota } from "@/lib/entitlements";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_PDF_BYTES = 8 * 1024 * 1024; // 8 MB

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

  const { data: profile } = await supabase
    .from("profiles").select("subscription_tier").eq("id", user.id).single();
  const tier = profile?.subscription_tier ?? "free";

  if (!canParseOm(tier)) {
    return NextResponse.json(
      {
        error: "upgrade_required",
        feature: "om_parsing",
        requiredTier: "professional",
        message: "OM parsing is a Professional feature — upgrade to parse.",
      },
      { status: 403 },
    );
  }

  const quota = await checkScreenerQuota(supabase, user.id, tier);
  if (!quota.allowed) {
    return NextResponse.json(
      { error: "quota_exceeded", used: quota.used, limit: quota.limit },
      { status: 403 },
    );
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
            "Respond with ONLY a JSON object, no prose: " +
            '{"name": string, "fields": {"<key>": {"value": number, "confidence": "high"|"low", "source": string}}}. ' +
            "Only include a field if you found an explicit number for it — never estimate or fabricate a value. " +
            "Field keys (include only ones you found): purchasePrice (asking price, $), units (unit count), " +
            "avgRentMo (average in-place monthly rent per unit, $), otherIncomeYr (other annual income, $), " +
            "expenseRatioPct (operating expenses as % of effective gross income, from a T12 if present), " +
            "vacancyPct (vacancy %). " +
            'confidence = "high" only if the number is explicitly and unambiguously stated in the document as ' +
            'that exact metric; use "low" if you had to derive, calculate, or infer it, or the source was ' +
            "ambiguous. source = a short citation for where the number came from, as specific about page/location " +
            "as you can be from the document, e.g. 'p.2, \"Asking Price\" line' or 'derived from T12 p.4 expense " +
            "total' — this lets an analyst spot-check without re-reading the whole document." },
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
  // content may lead with a thinking block — take the first text block.
  const text: string = (data?.content as { type: string; text?: string }[] | undefined)
    ?.find((b) => b.type === "text")?.text ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return NextResponse.json({ error: "parse_failed" }, { status: 502 });

  const FIELD_KEYS = ["purchasePrice", "units", "avgRentMo", "otherIncomeYr", "expenseRatioPct", "vacancyPct"] as const;

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const rawFields = parsed?.fields && typeof parsed.fields === "object" ? parsed.fields : {};
    const fields: Record<string, { value: number; confidence: "high" | "low"; source: string }> = {};
    for (const k of FIELD_KEYS) {
      const f = rawFields[k];
      if (!f || typeof f !== "object") continue;
      const v = Number(f.value);
      if (!isFinite(v) || v < 0) continue;
      fields[k] = {
        value: v,
        confidence: f.confidence === "low" ? "low" : "high",
        source: typeof f.source === "string" ? f.source.slice(0, 160) : "",
      };
    }
    const name = typeof parsed.name === "string" ? parsed.name.slice(0, 120) : undefined;
    return NextResponse.json({ name, fields });
  } catch {
    return NextResponse.json({ error: "parse_failed" }, { status: 502 });
  }
}
