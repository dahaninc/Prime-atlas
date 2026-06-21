/**
 * prime-atlas Scoring Engine
 *
 * Opportunity Score = weighted composite of five sub-scores (0–100).
 * Weights are configurable — defaults stored here, overridable per call.
 */

export interface SubScores {
  growth_score: number;
  infrastructure_score: number;
  development_score: number;
  liquidity_score: number;
  risk_score: number; // raw risk — inverted in composite (higher risk = lower score)
}

export interface ScoringWeights {
  growth: number;
  infrastructure: number;
  development: number;
  liquidity: number;
  risk: number; // weight applied to (100 - risk_score)
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  growth:         0.25,
  infrastructure: 0.25,
  development:    0.25,
  liquidity:      0.15,
  risk:           0.10,
};

/** Compute the composite opportunity score from sub-scores */
export function computeOpportunityScore(
  scores: SubScores,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): number {
  const total =
    scores.growth_score        * weights.growth +
    scores.infrastructure_score * weights.infrastructure +
    scores.development_score   * weights.development +
    scores.liquidity_score     * weights.liquidity +
    (100 - scores.risk_score)  * weights.risk;

  return Math.min(100, Math.max(0, Math.round(total)));
}

/**
 * Adjust weights based on investor objective.
 * Capital growth → heavier growth + infrastructure.
 * Rental yield   → heavier liquidity + development.
 * Development    → heavier development + infrastructure.
 */
export function weightsForObjective(
  objective: "capital_growth" | "rental_yield" | "development" | "mixed"
): ScoringWeights {
  switch (objective) {
    case "capital_growth":
      return { growth: 0.35, infrastructure: 0.30, development: 0.15, liquidity: 0.10, risk: 0.10 };
    case "rental_yield":
      return { growth: 0.15, infrastructure: 0.20, development: 0.20, liquidity: 0.35, risk: 0.10 };
    case "development":
      return { growth: 0.15, infrastructure: 0.25, development: 0.40, liquidity: 0.10, risk: 0.10 };
    case "mixed":
    default:
      return DEFAULT_WEIGHTS;
  }
}

/** Score label and colour token */
export function scoreLabel(score: number): { label: string; tier: "high" | "medium" | "low" } {
  if (score >= 75) return { label: "High conviction", tier: "high" };
  if (score >= 50) return { label: "Medium conviction", tier: "medium" };
  return { label: "Low conviction", tier: "low" };
}

/** Rank an array of opportunities by personalised score */
export function rankOpportunities<T extends SubScores>(
  items: T[],
  weights: ScoringWeights = DEFAULT_WEIGHTS
): (T & { personalised_score: number })[] {
  return items
    .map((item) => ({ ...item, personalised_score: computeOpportunityScore(item, weights) }))
    .sort((a, b) => b.personalised_score - a.personalised_score);
}
