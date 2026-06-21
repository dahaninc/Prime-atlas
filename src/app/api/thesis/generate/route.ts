/**
 * POST /api/thesis/generate
 * Calls Anthropic Claude to generate an investment thesis for a municipality/opportunity.
 * Streams the response back for real-time UI rendering.
 *
 * Body: { municipality_id, opportunity_id? (optional), context: FinderContext }
 * Returns: Server-Sent Events stream with thesis text chunks.
 */
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import { computeOpportunityScore, weightsForObjective } from "@/lib/scoring";

export const runtime = "edge";
export const maxDuration = 30;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

type Objective = "capital_growth" | "rental_yield" | "development" | "mixed";

interface ThesisRequest {
  municipality_id: string;
  opportunity_id?: string;
  context?: {
    objective?: Objective;
    budget_min?: number;
    budget_max?: number;
    risk_tolerance?: "low" | "medium" | "high";
    investor_type?: string;
  };
}

export async function POST(request: Request) {
  const body: ThesisRequest = await request.json();
  const { municipality_id, opportunity_id, context = {} } = body;

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Gather all relevant data
  const [
    { data: municipality },
    { data: signals },
    { data: infraProjects },
    { data: planningApps },
    { data: opportunity },
  ] = await Promise.all([
    supabase.from("municipalities").select("*").eq("id", municipality_id).single(),
    supabase.from("signals").select("*").eq("municipality_id", municipality_id).order("detected_at", { ascending: false }).limit(8),
    supabase.from("infrastructure_projects").select("*").eq("municipality_id", municipality_id).in("status", ["approved", "under_construction"]),
    supabase.from("planning_applications").select("*").eq("municipality_id", municipality_id).limit(5),
    opportunity_id
      ? supabase.from("opportunities").select("*").eq("id", opportunity_id).single()
      : Promise.resolve({ data: null }),
  ]);

  if (!municipality) {
    return NextResponse.json({ error: "Municipality not found" }, { status: 404 });
  }

  const weights = weightsForObjective(context.objective ?? "mixed");
  const personalisedScore = computeOpportunityScore({
    growth_score:         municipality.growth_score,
    infrastructure_score: municipality.infrastructure_score,
    development_score:    municipality.development_score,
    liquidity_score:      municipality.liquidity_score,
    risk_score:           municipality.risk_score,
  }, weights);

  // Build the prompt
  const systemPrompt = `You are prime-atlas's AI investment analyst — the engine behind "The Bloomberg for Future Investment Opportunities."

Your role is to generate a concise, evidence-based investment thesis for a specific municipality in Spain. You write like a senior analyst at a capital-allocation firm: direct, data-led, no waffle.

Rules:
- Never hedge with "it might" or "could potentially" — state convictions directly
- Always reference specific data points from the context provided
- Structure: Opening conviction statement → 2–3 catalyst paragraphs → Risk acknowledgement → Entry thesis (1–2 sentences)
- Aim for 300–450 words — dense enough to be useful, tight enough to read fast
- Never invent data. Only use what is in the context.
- End with a one-line "Entry thesis:" in bold`;

  const userPrompt = `Generate an investment thesis for ${municipality.name}, ${municipality.region}, Spain.

SCORES (0–100):
- Opportunity Score (personalised): ${personalisedScore}/100
- Growth Score: ${municipality.growth_score}/100
- Infrastructure Score: ${municipality.infrastructure_score}/100
- Development Score: ${municipality.development_score}/100
- Liquidity Score: ${municipality.liquidity_score}/100
- Risk Score: ${municipality.risk_score}/100 (lower = less risk)

POPULATION & GROWTH METRICS:
${JSON.stringify(municipality.growth_metrics, null, 2)}
Population: ${municipality.population.toLocaleString()}

${infraProjects && infraProjects.length > 0 ? `INFRASTRUCTURE PROJECTS (approved/under construction):
${infraProjects.map((p) => `- ${p.project_name} (${p.type}, ${p.status}) — Budget: €${(p.budget / 100_000_000).toFixed(0)}M — Impact Score: ${p.impact_score}/100${p.description ? `\n  ${p.description}` : ""}`).join("\n")}` : ""}

${signals && signals.length > 0 ? `RECENT SIGNALS:
${signals.map((s) => `- [${s.signal_type}] ${s.title} (Impact: ${s.opportunity_impact}/100, Confidence: ${Math.round(s.confidence_level * 100)}%)\n  ${s.summary}`).join("\n\n")}` : ""}

${planningApps && planningApps.length > 0 ? `PLANNING ACTIVITY:
${planningApps.map((p) => `- ${p.project_type} application (${p.status}) — ${p.description ?? ""}${p.applicant ? ` — ${p.applicant}` : ""}`).join("\n")}` : ""}

${opportunity ? `EXISTING OPPORTUNITY ON RECORD:
Title: ${opportunity.title}
Category: ${opportunity.category}
Risk: ${opportunity.risk_level}` : ""}

INVESTOR CONTEXT:
- Objective: ${context.objective ?? "mixed"}
- Budget: ${context.budget_min ? `€${context.budget_min.toLocaleString()}` : "unspecified"}${context.budget_max ? ` – €${context.budget_max.toLocaleString()}` : ""}
- Risk tolerance: ${context.risk_tolerance ?? "medium"}

Write the investment thesis now:`;

  // Stream Claude's response
  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 700,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  // Return as SSE stream
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === "content_block_delta" &&
          chunk.delta.type === "text_delta"
        ) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`)
          );
        }
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
