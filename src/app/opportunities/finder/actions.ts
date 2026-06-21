"use server";

import { createClient } from "@/lib/supabase/server";
import { rankOpportunities, weightsForObjective } from "@/lib/scoring";
import type { SubScores } from "@/lib/scoring";

export interface FinderParams {
  budget_min?: number;
  budget_max?: number;
  regions: string[];
  categories: string[];
  risk_tolerance: "low" | "medium" | "high";
  objective: "capital_growth" | "rental_yield" | "development" | "mixed";
  min_score: number;
}

export interface FinderResult {
  id: string;
  municipality_id: string;
  municipality_name: string;
  municipality_region: string;
  title: string;
  category: string;
  risk_level: string;
  investment_thesis: string;
  opportunity_score: number;
  personalised_score: number;
  scores: SubScores;
  evidence: unknown[];
  rank: number;
}

export async function runOpportunityFinder(params: FinderParams): Promise<FinderResult[]> {
  const supabase = await createClient();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required");

  // Tier check
  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .eq("id", user.id)
    .single();

  if (!profile || profile.subscription_tier === "free") {
    throw new Error("Pro subscription required to use the Opportunity Finder");
  }

  // Build query
  let query = supabase
    .from("opportunities")
    .select("*, municipalities!inner(id, name, region, growth_score, infrastructure_score, development_score, liquidity_score, risk_score)")
    .eq("status", "active");

  if (params.regions.length > 0) {
    query = query.in("municipalities.region", params.regions);
  }
  if (params.categories.length > 0) {
    query = query.in("category", params.categories);
  }
  if (params.risk_tolerance === "low") {
    query = query.lte("risk_score", 35);
  } else if (params.risk_tolerance === "medium") {
    query = query.lte("risk_score", 60);
  }
  if (params.min_score > 0) {
    query = query.gte("opportunity_score", params.min_score);
  }

  const { data: opportunities, error } = await query.limit(50);
  if (error) throw new Error(error.message);
  if (!opportunities || opportunities.length === 0) return [];

  const weights = weightsForObjective(params.objective);

  // Enrich with sub-scores from municipality
  const enriched = opportunities.map((opp) => {
    const m = opp.municipalities as {
      id: string; name: string; region: string;
      growth_score: number; infrastructure_score: number;
      development_score: number; liquidity_score: number; risk_score: number;
    };
    const scores: SubScores = {
      growth_score:         (opp.scores as { growth_score?: number } | null)?.growth_score ?? m.growth_score,
      infrastructure_score: (opp.scores as { infrastructure_score?: number } | null)?.infrastructure_score ?? m.infrastructure_score,
      development_score:    (opp.scores as { development_score?: number } | null)?.development_score ?? m.development_score,
      liquidity_score:      (opp.scores as { liquidity_score?: number } | null)?.liquidity_score ?? m.liquidity_score,
      risk_score:           opp.risk_score,
    };
    return { ...opp, municipality_name: m.name, municipality_region: m.region, scores };
  });

  const ranked = rankOpportunities(enriched, weights);

  return ranked.slice(0, 20).map((opp, i) => ({
    id: opp.id,
    municipality_id: opp.municipality_id,
    municipality_name: opp.municipality_name,
    municipality_region: opp.municipality_region,
    title: opp.title,
    category: opp.category,
    risk_level: opp.risk_level,
    investment_thesis: opp.investment_thesis,
    opportunity_score: opp.opportunity_score,
    personalised_score: opp.personalised_score,
    scores: opp.scores,
    evidence: (opp.evidence as unknown[]) ?? [],
    rank: i + 1,
  }));
}
