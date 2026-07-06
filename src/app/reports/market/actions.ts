"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { isPaidTier } from "@/lib/access";
import { buildMarketReport, type MarketReport } from "@/lib/marketReport";

/** Free tier: 3 reports TOTAL (lifetime). Paid tiers: unlimited. */
const FREE_REPORT_LIMIT = 3;

export async function getReportQuota(): Promise<{
  used: number; limit: number; unlimited: boolean;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { used: 0, limit: FREE_REPORT_LIMIT, unlimited: false };

  const [{ data: profile }, { count }] = await Promise.all([
    supabase.from("profiles").select("subscription_tier").eq("id", user.id).single(),
    supabase.from("deal_board_reports")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);
  return {
    used: count ?? 0,
    limit: FREE_REPORT_LIMIT,
    unlimited: isPaidTier(profile?.subscription_tier),
  };
}

export async function generateMarketReport(municipalityId: string): Promise<
  { ok: true; report: MarketReport; remaining: number; id: string } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const quota = await getReportQuota();
  if (!quota.unlimited && quota.used >= quota.limit) {
    return { ok: false, error: "quota_exceeded" };
  }

  const [{ data: muni }, { data: stats }, { data: history }] = await Promise.all([
    supabase
      .from("municipalities")
      .select("id, name, region, country, currency_code, population, opportunity_score, growth_score, risk_score, development_score, infrastructure_score, liquidity_score")
      .eq("id", municipalityId)
      .single(),
    supabase
      .from("market_listing_stats")
      .select("sale_count, rent_count, median_price, median_ppsqm, underpriced_count")
      .eq("municipality_id", municipalityId)
      .maybeSingle(),
    supabase
      .from("market_score_history")
      .select("captured_on, opportunity_score, growth_score, risk_score")
      .eq("municipality_id", municipalityId)
      .order("captured_on", { ascending: false })
      .limit(12),
  ]);
  if (!muni) return { ok: false, error: "market_not_found" };

  // Country-wide median ppsqm across covered markets (for relative value).
  const { data: countryStats } = await supabase
    .from("market_listing_stats")
    .select("median_ppsqm, municipality_id, municipalities!inner(country)")
    .eq("municipalities.country", muni.country)
    .not("median_ppsqm", "is", null);
  const ppsqms = (countryStats ?? [])
    .map((r) => Number(r.median_ppsqm))
    .filter((v) => isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  const countryMedianPpsqm = ppsqms.length
    ? ppsqms[Math.floor(ppsqms.length / 2)]
    : null;

  const report = buildMarketReport({
    muni,
    stats: stats ?? null,
    history: history ?? [],
    countryMedianPpsqm,
  });

  const { data, error } = await supabase.from("deal_board_reports").insert({
    user_id: user.id,
    municipality_id: municipalityId,
    payload: report as unknown as Record<string, never>,
  }).select("id").single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/reports/market");
  const remaining = quota.unlimited ? -1 : Math.max(0, quota.limit - quota.used - 1);
  return { ok: true, report, remaining, id: data.id };
}
