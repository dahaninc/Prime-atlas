/**
 * GET /api/cron/snapshot-scores  (weekly — vercel.json)
 * Auth: Bearer CRON_SECRET
 *
 * Appends today's market scores to market_score_history. This time series
 * powers the score-momentum arrows on the Deal Board and, over time, the
 * published track record ("markets we rated 85+ outperformed by X%").
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: markets, error } = await supabase
    .from("municipalities")
    .select("id, opportunity_score, growth_score, infrastructure_score, development_score, liquidity_score, risk_score");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (markets ?? []).map((m) => ({
    municipality_id: m.id,
    opportunity_score: m.opportunity_score,
    growth_score: m.growth_score,
    infrastructure_score: m.infrastructure_score,
    development_score: m.development_score,
    liquidity_score: m.liquidity_score,
    risk_score: m.risk_score,
  }));

  const { error: insertError } = await supabase
    .from("market_score_history")
    .upsert(rows, { onConflict: "municipality_id,captured_on", ignoreDuplicates: true });

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ ok: true, snapshotted: rows.length });
}
