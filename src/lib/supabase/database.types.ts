// Auto-generated types — regenerate with: supabase gen types typescript --project-id YOUR_PROJECT_ID
// This is a hand-written stub; replace after running: npx supabase gen types

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      municipalities: {
        Row: {
          id: string;
          name: string;
          region: string;
          country: string;
          population: number;
          growth_metrics: Json;
          development_score: number;
          opportunity_score: number;
          lat: number;
          lng: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["municipalities"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["municipalities"]["Insert"]>;
      };
      opportunities: {
        Row: {
          id: string;
          title: string;
          investment_thesis: string;
          opportunity_score: number;
          risk_level: string;
          risk_score: number;
          municipality_id: string;
          category: string;
          evidence: Json;
          status: string;
          scores: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["opportunities"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["opportunities"]["Insert"]>;
      };
      infrastructure_projects: {
        Row: {
          id: string;
          project_name: string;
          type: string;
          budget: number;
          status: string;
          impact_score: number;
          municipality_id: string;
          expected_completion: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["infrastructure_projects"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["infrastructure_projects"]["Insert"]>;
      };
      planning_applications: {
        Row: {
          id: string;
          project_type: string;
          status: string;
          municipality_id: string;
          application_date: string;
          decision_date: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["planning_applications"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["planning_applications"]["Insert"]>;
      };
      signals: {
        Row: {
          id: string;
          signal_type: string;
          source: string;
          source_url: string | null;
          confidence_level: number;
          opportunity_impact: number;
          municipality_id: string;
          title: string;
          summary: string;
          detected_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["signals"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["signals"]["Insert"]>;
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          subscription_tier: string;
          stripe_customer_id: string | null;
          alert_preferences: Json;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"], "created_at">;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      watchlists: {
        Row: { id: string; user_id: string; name: string; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["watchlists"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["watchlists"]["Insert"]>;
      };
      watchlist_items: {
        Row: {
          id: string;
          watchlist_id: string;
          municipality_id: string | null;
          opportunity_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["watchlist_items"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["watchlist_items"]["Insert"]>;
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          stripe_subscription_id: string;
          stripe_price_id: string;
          status: string;
          current_period_end: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["subscriptions"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
