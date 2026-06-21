/**
 * Supabase Edge Function: recompute-scores
 * Runs on a cron schedule (daily) to recompute all opportunity scores.
 *
 * Deploy: supabase functions deploy recompute-scores
 * Schedule via Supabase Dashboard → Edge Functions → Schedule
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WEIGHTS = {
  growth:         0.25,
  infrastructure: 0.25,
  development:    0.25,
  liquidity:      0.15,
  risk:           0.10,
};

function computeScore(m: {
  growth_score: number;
  infrastructure_score: number;
  development_score: number;
  liquidity_score: number;
  risk_score: number;
}): number {
  return Math.round(
    m.growth_score         * WEIGHTS.growth +
    m.infrastructure_score * WEIGHTS.infrastructure +
    m.development_score    * WEIGHTS.development +
    m.liquidity_score      * WEIGHTS.liquidity +
    (100 - m.risk_score)   * WEIGHTS.risk
  );
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: municipalities, error } = await supabase
    .from("municipalities")
    .select("id, growth_score, infrastructure_score, development_score, liquidity_score, risk_score");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const updates = municipalities.map((m) => ({
    id: m.id,
    opportunity_score: computeScore(m),
  }));

  const { error: upsertError } = await supabase
    .from("municipalities")
    .upsert(updates, { onConflict: "id" });

  if (upsertError) {
    return new Response(JSON.stringify({ error: upsertError.message }), { status: 500 });
  }

  console.log(`Recomputed scores for ${updates.length} municipalities`);

  return new Response(
    JSON.stringify({ success: true, recomputed: updates.length, at: new Date().toISOString() }),
    { headers: { "Content-Type": "application/json" } }
  );
});
