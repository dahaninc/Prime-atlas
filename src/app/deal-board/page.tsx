import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { DealBoard } from "@/components/deal-board/DealBoard";
import type {
  DealRow, LiveOpportunity, MarketStats,
  EvidenceInfra, EvidencePlanning, EvidenceSignal,
} from "@/components/deal-board/DealBoard";

export const metadata: Metadata = {
  title: "Deal Board | prime-atlas",
  description: "Site-acquisition terminal. Ranked markets by ROI, zoning momentum, and demand pressure.",
};

export const dynamic = "force-dynamic";

export default async function DealBoardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?redirect=/deal-board");

  const [profileRes, municipalitiesRes, freshnessRes, opportunitiesRes, statsRes, historyRes, infraRes, planningRes, signalsRes] = await Promise.all([
    supabase.from("profiles").select("subscription_tier").eq("id", user.id).single(),
    supabase.from("municipalities").select(
      `id, name, region, country, currency_code,
       opportunity_score, growth_score, infrastructure_score,
       development_score, liquidity_score, risk_score,
       population, retrieved_at, source_name, data_confidence, slug`
    ).in("country", ["United Kingdom", "United States"])
     .order("opportunity_score", { ascending: false }).limit(120),
    supabase.from("data_freshness").select("market_iso2, last_updated"),
    supabase.from("opportunities")
      .select("id, municipality_id, title, category, opportunity_score, risk_level, source_name, source_url")
      .eq("status", "active")
      .order("opportunity_score", { ascending: false }),
    supabase.from("market_listing_stats").select("*"),
    supabase.from("market_score_history")
      .select("municipality_id, captured_on, opportunity_score")
      .lt("captured_on", new Date().toISOString().slice(0, 10))
      .order("captured_on", { ascending: false }),
    supabase.from("infrastructure_projects")
      .select("municipality_id, project_name, type, budget, status, expected_completion")
      .order("impact_score", { ascending: false }),
    supabase.from("planning_applications")
      .select("municipality_id, project_type, status, application_date, description")
      .order("application_date", { ascending: false }),
    supabase.from("signals")
      .select("municipality_id, title, signal_type, opportunity_impact, detected_at")
      .order("detected_at", { ascending: false })
      .limit(200),
  ]);

  const tier = (profileRes.data?.subscription_tier ?? "free") as
    "free" | "explorer" | "professional" | "institutional";

  const isoToCountry: Record<string, string> = {
    GB: "United Kingdom", US: "United States",
  };
  const freshnessMap: Record<string, string> = {};
  for (const f of (freshnessRes.data ?? []) as Array<{ market_iso2: string; last_updated: string | null }>) {
    const country = isoToCountry[f.market_iso2];
    if (country && f.last_updated) freshnessMap[country] = f.last_updated;
  }

  const rows = (municipalitiesRes.data ?? []).map((m) => ({
    ...m,
    currency_code:   m.currency_code   ?? "USD",
    source_name:     m.source_name     ?? "manual",
    data_confidence: m.data_confidence ?? 0.5,
    retrieved_at:    m.retrieved_at    ?? null,
  })) as DealRow[];

  // Build opportunities map keyed by municipality_id
  const opportunitiesMap: Record<string, LiveOpportunity[]> = {};
  for (const opp of (opportunitiesRes.data ?? []) as LiveOpportunity[]) {
    if (opp.municipality_id) {
      if (!opportunitiesMap[opp.municipality_id]) opportunitiesMap[opp.municipality_id] = [];
      opportunitiesMap[opp.municipality_id].push(opp);
    }
  }

  // Live listing stats per market
  const statsMap: Record<string, MarketStats> = {};
  for (const st of (statsRes.data ?? []) as MarketStats[]) {
    if (st.municipality_id) statsMap[st.municipality_id] = st;
  }

  // Previous opportunity score per market (most recent snapshot before today)
  const prevScoreMap: Record<string, number> = {};
  for (const h of (historyRes.data ?? []) as Array<{ municipality_id: string; opportunity_score: number }>) {
    if (!(h.municipality_id in prevScoreMap)) prevScoreMap[h.municipality_id] = h.opportunity_score;
  }

  const groupBy = <T extends { municipality_id: string | null }>(items: T[], cap: number) => {
    const map: Record<string, T[]> = {};
    for (const it of items) {
      if (!it.municipality_id) continue;
      (map[it.municipality_id] ??= []);
      if (map[it.municipality_id].length < cap) map[it.municipality_id].push(it);
    }
    return map;
  };

  const evidence = {
    infra:    groupBy((infraRes.data ?? []) as EvidenceInfra[], 5),
    planning: groupBy((planningRes.data ?? []) as EvidencePlanning[], 5),
    signals:  groupBy((signalsRes.data ?? []) as EvidenceSignal[], 5),
  };

  return (
    <div className="min-h-screen bg-background">
      <DealBoard
        rows={rows}
        tier={tier}
        freshnessMap={freshnessMap}
        userEmail={user.email}
        opportunitiesMap={opportunitiesMap}
        statsMap={statsMap}
        prevScoreMap={prevScoreMap}
        evidence={evidence}
      />
    </div>
  );
}
