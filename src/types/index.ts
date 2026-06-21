// ─── Core domain types (mirror Supabase schema) ───────────────────────────────

export type SubscriptionTier = "free" | "pro" | "investor" | "institutional";

export type RiskLevel = "low" | "medium" | "high" | "very_high";

export type OpportunityStatus = "active" | "watchlist" | "closed" | "under_review";

export type SignalType =
  | "infrastructure_approved"
  | "employer_relocating"
  | "planning_application"
  | "utility_expansion"
  | "university_announced"
  | "transport_link"
  | "development_zone"
  | "government_investment";

export type ProjectType =
  | "road"
  | "rail"
  | "airport"
  | "port"
  | "utility"
  | "education"
  | "healthcare"
  | "commercial"
  | "residential"
  | "industrial";

// ─── Score types ───────────────────────────────────────────────────────────────

export interface OpportunityScores {
  growth_score: number;        // 0–100: population growth, economic activity, migration
  infrastructure_score: number; // 0–100: roads, rail, airports, utilities
  development_score: number;   // 0–100: planning activity, permits, land availability
  liquidity_score: number;     // 0–100: market activity, buyer demand, transaction velocity
  risk_score: number;          // 0–100: higher = more risk
  opportunity_score: number;   // 0–100: weighted composite
}

export interface GrowthMetrics {
  population_growth_pct: number;
  gdp_growth_pct?: number;
  employment_growth_pct?: number;
  migration_net?: number;
  tourism_index?: number;
}

export interface Evidence {
  source: string;
  url?: string;
  date: string;
  summary: string;
  confidence: number; // 0–1
}

// ─── Database types ───────────────────────────────────────────────────────────

export interface Municipality {
  id: string;
  name: string;
  region: string;
  country: string;
  population: number;
  growth_metrics: GrowthMetrics;
  development_score: number;
  opportunity_score: number;
  lat: number;
  lng: number;
  created_at: string;
  updated_at: string;
}

export interface Opportunity {
  id: string;
  title: string;
  investment_thesis: string;
  opportunity_score: number;
  risk_level: RiskLevel;
  risk_score: number;
  municipality_id: string;
  municipality?: Municipality;
  category: string;
  evidence: Evidence[];
  status: OpportunityStatus;
  scores?: OpportunityScores;
  created_at: string;
  updated_at: string;
}

export interface InfrastructureProject {
  id: string;
  project_name: string;
  type: ProjectType;
  budget: number; // EUR
  status: "planned" | "approved" | "under_construction" | "completed";
  impact_score: number; // 0–100
  municipality_id: string;
  municipality?: Municipality;
  expected_completion: string;
  created_at: string;
}

export interface PlanningApplication {
  id: string;
  project_type: ProjectType;
  status: "submitted" | "approved" | "rejected" | "pending";
  municipality_id: string;
  municipality?: Municipality;
  application_date: string;
  decision_date?: string;
  created_at: string;
}

export interface Signal {
  id: string;
  signal_type: SignalType;
  source: string;
  source_url?: string;
  confidence_level: number; // 0–1
  opportunity_impact: number; // 0–100
  municipality_id: string;
  municipality?: Municipality;
  title: string;
  summary: string;
  detected_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  subscription_tier: SubscriptionTier;
  stripe_customer_id?: string;
  alert_preferences: AlertPreferences;
  created_at: string;
}

export interface AlertPreferences {
  email_alerts: boolean;
  signal_threshold: number; // min opportunity_impact to alert
  watched_municipalities: string[];
  alert_frequency: "immediate" | "daily" | "weekly";
}

export interface Watchlist {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  items?: WatchlistItem[];
}

export interface WatchlistItem {
  id: string;
  watchlist_id: string;
  municipality_id?: string;
  opportunity_id?: string;
  municipality?: Municipality;
  opportunity?: Opportunity;
  created_at: string;
}

// ─── API response types ───────────────────────────────────────────────────────

export interface OpportunityFinderParams {
  budget_min?: number;
  budget_max?: number;
  regions?: string[];
  categories?: string[];
  risk_level?: RiskLevel[];
  min_opportunity_score?: number;
  objective?: "capital_growth" | "rental_yield" | "development" | "mixed";
}

export interface RankedOpportunity extends Opportunity {
  rank: number;
  rank_delta?: number;
  thesis_summary: string;
}

export interface IndexEntry {
  municipality: Municipality;
  rank: number;
  rank_delta: number;
  opportunity_score: number;
  score_delta: number;
  top_signal?: Signal;
}
