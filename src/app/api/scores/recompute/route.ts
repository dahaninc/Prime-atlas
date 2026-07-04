/**
 * POST /api/scores/recompute
 * Server-side scoring engine — recomputes opportunity scores for all municipalities.
 * Called by the Supabase Edge Function scheduler, or manually from the admin.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (never exposed to client).
 */
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { computeOpportunityScore, DEFAULT_WEIGHTS } from "@/lib/scoring";
import type { Database } from "@/lib/supabase/database.types";

export const runtime = "edge";

export async function POST(request: Request) {
  // Verify internal secret to prevent public triggering
  const authHeader = request.headers.get("Authorization");
  const secret = process.env.RECOMPUTE_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch all municipalities with sub-scores
  const { data: municipalities, error } = await supabase
    .from("municipalities")
    .select("id, growth_score, infrastructure_score, development_score, liquidity_score, risk_score");

  if (error || !municipalities) return NextResponse.json({ error: error?.message ?? "No data" }, { status: 500 });

  const updates = (municipalities as Array<{ id: string; growth_score: number; infrastructure_score: number; development_score: number; liquidity_score: number; risk_score: number }>).map((m) => ({
    id: m.id,
    opportunity_score: computeOpportunityScore({
      growth_score:         m.growth_score,
      infrastructure_score: m.infrastructure_score,
      development_score:    m.development_score,
      liquidity_score:      m.liquidity_score,
      risk_score:           m.risk_score,
    }, DEFAULT_WEIGHTS),
  }));

  // Upsert scores in batch
  const { error: upsertError } = await supabase
    .from("municipalities")
    .upsert(updates as any, { onConflict: "id" });

  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

  // Also recompute opportunity-level scores
  const { data: opps } = await supabase
    .from("opportunities")
    .select("id, scores");

  if (opps) {
    const oppUpdates = (opps as any[])
      .filter((o) => o.scores)
      .map((o) => {
        const s = o.scores as {
          growth_score: number; infrastructure_score: number;
          development_score: number; liquidity_score: number; risk_score: number;
        };
        return {
          id: o.id as string,
          opportunity_score: computeOpportunityScore({
            growth_score:         s.growth_score ?? 0,
            infrastructure_score: s.infrastructure_score ?? 0,
            development_score:    s.development_score ?? 0,
            liquidity_score:      s.liquidity_score ?? 0,
            risk_score:           s.risk_score ?? 50,
          }),
        };
      });

    if (oppUpdates.length > 0) {
      await supabase.from("opportunities").upsert(oppUpdates as any, { onConflict: "id" });
    }
  }

  return NextResponse.json({
    success: true,
    recomputed: updates.length,
    timestamp: new Date().toISOString(),
  });
}
