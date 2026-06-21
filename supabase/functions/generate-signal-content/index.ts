/**
 * generate-signal-content Edge Function
 * Triggered by DB Webhook on signals INSERT.
 * Uses Claude Haiku to write a 2-sentence investment-grade ai_summary.
 * Writes result back to signals.ai_summary.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

Deno.serve(async (req: Request) => {
  let payload: {
    type: string;
    record: {
      id: string; title: string; summary: string;
      signal_type: string; opportunity_impact: number; municipality_id: string;
    };
  };
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid payload", { status: 400 });
  }

  if (payload.type !== "INSERT") {
    return new Response("ignored", { status: 200 });
  }

  const signal = payload.record;
  if (!signal?.id || !signal?.summary) {
    return new Response("missing fields", { status: 200 });
  }

  if (!ANTHROPIC_API_KEY) {
    return new Response("ANTHROPIC_API_KEY not set", { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: muni } = await supabase
    .from("municipalities")
    .select("name, region, opportunity_score")
    .eq("id", signal.municipality_id)
    .single();

  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    system: `You are a senior property investment analyst writing for sophisticated investors.
Write exactly 2 sentences that interpret the investment significance of a market signal.
Be specific, data-driven, and forward-looking. Avoid filler phrases. No bullet points.`,
    messages: [
      {
        role: "user",
        content: `Signal: ${signal.title}

Raw summary: ${signal.summary}

Municipality: ${muni?.name ?? "Unknown"}, ${muni?.region ?? "Spain"}
Current opportunity score: ${muni?.opportunity_score ?? "N/A"}/100
Signal type: ${signal.signal_type}
Opportunity impact: ${signal.opportunity_impact}/100

Write the 2-sentence investment interpretation:`,
      },
    ],
  });

  const aiSummary = message.content[0].type === "text" ? message.content[0].text.trim() : null;
  if (!aiSummary) {
    return new Response("No content from Claude", { status: 200 });
  }

  const { error } = await supabase
    .from("signals")
    .update({ ai_summary: aiSummary })
    .eq("id", signal.id);

  if (error) {
    console.error("[generate-signal-content] DB write error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(
    JSON.stringify({ ok: true, signal_id: signal.id, chars: aiSummary.length }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
