export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      capital_enquiries: {
        Row: {
          company: string | null
          created_at: string
          email: string
          fund_size: string | null
          geography: string | null
          id: string
          message: string | null
          name: string
          status: string
          target_return: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          fund_size?: string | null
          geography?: string | null
          id?: string
          message?: string | null
          name: string
          status?: string
          target_return?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          fund_size?: string | null
          geography?: string | null
          id?: string
          message?: string | null
          name?: string
          status?: string
          target_return?: string | null
        }
        Relationships: []
      }
      infrastructure_projects: {
        Row: {
          budget: number
          created_at: string
          description: string | null
          expected_completion: string | null
          id: string
          impact_score: number
          municipality_id: string
          project_name: string
          source_url: string | null
          status: Database["public"]["Enums"]["project_status"]
          type: Database["public"]["Enums"]["project_type"]
        }
        Insert: {
          budget?: number
          created_at?: string
          description?: string | null
          expected_completion?: string | null
          id?: string
          impact_score?: number
          municipality_id: string
          project_name: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          type: Database["public"]["Enums"]["project_type"]
        }
        Update: {
          budget?: number
          created_at?: string
          description?: string | null
          expected_completion?: string | null
          id?: string
          impact_score?: number
          municipality_id?: string
          project_name?: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          type?: Database["public"]["Enums"]["project_type"]
        }
        Relationships: [
          {
            foreignKeyName: "infrastructure_projects_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
        ]
      }
      municipalities: {
        Row: {
          country: string
          created_at: string
          development_score: number
          growth_metrics: Json
          growth_score: number
          id: string
          infrastructure_score: number
          lat: number
          liquidity_score: number
          lng: number
          name: string
          opportunity_score: number
          population: number
          region: string
          risk_score: number
          updated_at: string
        }
        Insert: {
          country?: string
          created_at?: string
          development_score?: number
          growth_metrics?: Json
          growth_score?: number
          id?: string
          infrastructure_score?: number
          lat?: number
          liquidity_score?: number
          lng?: number
          name: string
          opportunity_score?: number
          population?: number
          region: string
          risk_score?: number
          updated_at?: string
        }
        Update: {
          country?: string
          created_at?: string
          development_score?: number
          growth_metrics?: Json
          growth_score?: number
          id?: string
          infrastructure_score?: number
          lat?: number
          liquidity_score?: number
          lng?: number
          name?: string
          opportunity_score?: number
          population?: number
          region?: string
          risk_score?: number
          updated_at?: string
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          source: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          source?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          source?: string | null
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          category: string
          created_at: string
          evidence: Json
          id: string
          investment_thesis: string
          municipality_id: string
          opportunity_score: number
          risk_level: Database["public"]["Enums"]["risk_level"]
          risk_score: number
          scores: Json | null
          status: Database["public"]["Enums"]["opportunity_status"]
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          evidence?: Json
          id?: string
          investment_thesis?: string
          municipality_id: string
          opportunity_score?: number
          risk_level?: Database["public"]["Enums"]["risk_level"]
          risk_score?: number
          scores?: Json | null
          status?: Database["public"]["Enums"]["opportunity_status"]
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          evidence?: Json
          id?: string
          investment_thesis?: string
          municipality_id?: string
          opportunity_score?: number
          risk_level?: Database["public"]["Enums"]["risk_level"]
          risk_score?: number
          scores?: Json | null
          status?: Database["public"]["Enums"]["opportunity_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_applications: {
        Row: {
          applicant: string | null
          application_date: string
          created_at: string
          decision_date: string | null
          description: string | null
          id: string
          municipality_id: string
          project_type: Database["public"]["Enums"]["project_type"]
          status: Database["public"]["Enums"]["application_status"]
        }
        Insert: {
          applicant?: string | null
          application_date: string
          created_at?: string
          decision_date?: string | null
          description?: string | null
          id?: string
          municipality_id: string
          project_type: Database["public"]["Enums"]["project_type"]
          status?: Database["public"]["Enums"]["application_status"]
        }
        Update: {
          applicant?: string | null
          application_date?: string
          created_at?: string
          decision_date?: string | null
          description?: string | null
          id?: string
          municipality_id?: string
          project_type?: Database["public"]["Enums"]["project_type"]
          status?: Database["public"]["Enums"]["application_status"]
        }
        Relationships: [
          {
            foreignKeyName: "planning_applications_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          alert_preferences: Json
          created_at: string
          email: string
          full_name: string | null
          id: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_period_end: string | null
          subscription_tier: Database["public"]["Enums"]["subscription_tier"]
        }
        Insert: {
          alert_preferences?: Json
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_period_end?: string | null
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
        }
        Update: {
          alert_preferences?: Json
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_period_end?: string | null
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
        }
        Relationships: []
      }
      signals: {
        Row: {
          ai_summary: string | null
          confidence_level: number
          detected_at: string
          id: string
          municipality_id: string
          opportunity_impact: number
          signal_type: Database["public"]["Enums"]["signal_type"]
          source: string
          source_url: string | null
          summary: string
          title: string
        }
        Insert: {
          ai_summary?: string | null
          confidence_level?: number
          detected_at?: string
          id?: string
          municipality_id: string
          opportunity_impact?: number
          signal_type: Database["public"]["Enums"]["signal_type"]
          source: string
          source_url?: string | null
          summary: string
          title: string
        }
        Update: {
          ai_summary?: string | null
          confidence_level?: number
          detected_at?: string
          id?: string
          municipality_id?: string
          opportunity_impact?: number
          signal_type?: Database["public"]["Enums"]["signal_type"]
          source?: string
          source_url?: string | null
          summary?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "signals_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string
          id: string
          status: string
          stripe_price_id: string
          stripe_subscription_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end: string
          id?: string
          status: string
          stripe_price_id: string
          stripe_subscription_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string
          id?: string
          status?: string
          stripe_price_id?: string
          stripe_subscription_id?: string
          user_id?: string
        }
        Relationships: []
      }
      watchlist_items: {
        Row: {
          created_at: string
          id: string
          municipality_id: string | null
          opportunity_id: string | null
          watchlist_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          municipality_id?: string | null
          opportunity_id?: string | null
          watchlist_id: string
        }
        Update: {
          created_at?: string
          id?: string
          municipality_id?: string | null
          opportunity_id?: string | null
          watchlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_items_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watchlist_items_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watchlist_items_watchlist_id_fkey"
            columns: ["watchlist_id"]
            isOneToOne: false
            referencedRelation: "watchlists"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlists: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      alert_frequency: "immediate" | "daily" | "weekly"
      application_status: "submitted" | "approved" | "rejected" | "pending"
      opportunity_status: "active" | "watchlist" | "closed" | "under_review"
      project_status:
        | "planned"
        | "approved"
        | "under_construction"
        | "completed"
      project_type:
        | "road"
        | "rail"
        | "airport"
        | "port"
        | "utility"
        | "education"
        | "healthcare"
        | "commercial"
        | "residential"
        | "industrial"
      risk_level: "low" | "medium" | "high" | "very_high"
      signal_type:
        | "infrastructure_approved"
        | "employer_relocating"
        | "planning_application"
        | "utility_expansion"
        | "university_announced"
        | "transport_link"
        | "development_zone"
        | "government_investment"
      subscription_tier: "free" | "pro" | "investor" | "institutional"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database["public"]

export type Tables<
  TableName extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]),
> = (DefaultSchema["Tables"] & DefaultSchema["Views"])[TableName] extends {
  Row: infer R
}
  ? R
  : never

export type TablesInsert<
  TableName extends keyof DefaultSchema["Tables"],
> = DefaultSchema["Tables"][TableName] extends { Insert: infer I } ? I : never

export type TablesUpdate<
  TableName extends keyof DefaultSchema["Tables"],
> = DefaultSchema["Tables"][TableName] extends { Update: infer U } ? U : never

export type Enums<
  EnumName extends keyof DefaultSchema["Enums"],
> = DefaultSchema["Enums"][EnumName]

export const Constants = {
  public: {
    Enums: {
      alert_frequency: ["immediate", "daily", "weekly"],
      application_status: ["submitted", "approved", "rejected", "pending"],
      opportunity_status: ["active", "watchlist", "closed", "under_review"],
      project_status: [
        "planned",
        "approved",
        "under_construction",
        "completed",
      ],
      project_type: [
        "road",
        "rail",
        "airport",
        "port",
        "utility",
        "education",
        "healthcare",
        "commercial",
        "residential",
        "industrial",
      ],
      risk_level: ["low", "medium", "high", "very_high"],
      signal_type: [
        "infrastructure_approved",
        "employer_relocating",
        "planning_application",
        "utility_expansion",
        "university_announced",
        "transport_link",
        "development_zone",
        "government_investment",
      ],
      subscription_tier: ["free", "pro", "investor", "institutional"],
    },
  },
} as const
