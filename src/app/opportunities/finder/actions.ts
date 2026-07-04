"use server";

import { createClient } from "@/lib/supabase/server";
import { rankOpportunities, weightsForObjective } from "@/lib/scoring";
import type { SubScores } from "@/lib/scoring";

export interface FinderParams {
  budget_min?: number;
  budget_max?: number;
  budget_currency?: "USD" | "GBP" | "EUR";
  country?: string;
  region?: string;
  city?: string;
  categories: string[];
  risk_tolerance: "low" | "medium" | "high";
  objective: "capital_growth" | "rental_yield" | "development" | "mixed";
  min_score: number;
}

export interface FinderResult {
  id: string;
  municipality_id: string;
  municipality_slug: string;
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
  const { data: profileRaw } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .eq("id", user.id)
    .single();
  const profile = profileRaw as { subscription_tier: string } | null;

  if (!profile || profile.subscription_tier === "free") {
    throw new Error("Pro subscription required to use the Opportunity Finder");
  }

  // Build query — UK + USA only, municipalities!inner enforces join
  let query = supabase
    .from("opportunities")
    .select("*, municipalities!inner(id, name, region, slug, country, growth_score, infrastructure_score, development_score, liquidity_score, risk_score)")
    .eq("status", "active")
    .in("municipalities.country", ["United Kingdom", "United States"]);

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

  const { data: rawOpportunities, error } = await query.limit(100);
  if (error) throw new Error(error.message);

  type OppRow = {
    id: string; title: string; category: string; risk_level: string; investment_thesis: string;
    opportunity_score: number; risk_score: number; municipality_id: string;
    scores: Record<string, number> | null;
    evidence: unknown[];
    municipalities: {
      id: string; name: string; region: string; slug: string; country: string;
      growth_score: number; infrastructure_score: number;
      development_score: number; liquidity_score: number; risk_score: number;
    } | null;
  };
  const rows = (rawOpportunities as unknown as OppRow[]) ?? [];
  if (rows.length === 0) return [];

  // JS-filter to UK + USA and apply geography params
  const ALLOWED_COUNTRIES = ["United Kingdom", "United States"];
  const opportunities = rows.filter((opp) => {
    const m = opp.municipalities;
    if (!m) return false;
    if (!ALLOWED_COUNTRIES.includes(m.country)) return false;
    if (params.country && m.country !== params.country) return false;
    if (params.region && m.region !== params.region) return false;
    if (params.city && m.name !== params.city) return false;
    return true;
  });

  if (opportunities.length === 0) return [];

  const weights = weightsForObjective(params.objective);

  // Enrich with sub-scores from municipality
  // IMPORTANT: spread scores at root level so rankOpportunities can access growth_score etc. directly
  const enriched = opportunities.map((opp) => {
    const m = opp.municipalities!;
    const scores: SubScores = {
      growth_score:         opp.scores?.growth_score         ?? m.growth_score         ?? 50,
      infrastructure_score: opp.scores?.infrastructure_score ?? m.infrastructure_score ?? 50,
      development_score:    opp.scores?.development_score    ?? m.development_score    ?? 50,
      liquidity_score:      opp.scores?.liquidity_score      ?? m.liquidity_score      ?? 50,
      risk_score:           opp.risk_score                   ?? m.risk_score           ?? 50,
    };
    // Spread scores at root level so computeOpportunityScore can access them directly
    return { ...opp, ...scores, municipality_name: m.name, municipality_region: m.region, municipality_slug: m.slug, scores };
  });

  const ranked = rankOpportunities(enriched, weights);

  return ranked.slice(0, 20).map((opp, i) => ({
    id: opp.id,
    municipality_id: opp.municipality_id,
    municipality_slug: opp.municipality_slug,
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
