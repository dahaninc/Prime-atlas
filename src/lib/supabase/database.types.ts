export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_regions: {
        Row: {
          code: string | null
          country_id: string
          created_at: string
          id: string
          level: number
          name: string
        }
        Insert: {
          code?: string | null
          country_id: string
          created_at?: string
          id?: string
          level?: number
          name: string
        }
        Update: {
          code?: string | null
          country_id?: string
          created_at?: string
          id?: string
          level?: number
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_regions_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
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
      countries: {
        Row: {
          active: boolean
          created_at: string
          currency_code: string
          currency_symbol: string
          id: string
          iso2: string
          iso3: string
          locale: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          currency_code: string
          currency_symbol: string
          id?: string
          iso2: string
          iso3: string
          locale: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          currency_code?: string
          currency_symbol?: string
          id?: string
          iso2?: string
          iso3?: string
          locale?: string
          name?: string
        }
        Relationships: []
      }
      data_freshness: {
        Row: {
          adapter_name: string | null
          id: string
          last_updated: string | null
          market_iso2: string
          next_update: string | null
          row_count: number | null
          table_name: string
          update_cadence: string | null
        }
        Insert: {
          adapter_name?: string | null
          id?: string
          last_updated?: string | null
          market_iso2: string
          next_update?: string | null
          row_count?: number | null
          table_name: string
          update_cadence?: string | null
        }
        Update: {
          adapter_name?: string | null
          id?: string
          last_updated?: string | null
          market_iso2?: string
          next_update?: string | null
          row_count?: number | null
          table_name?: string
          update_cadence?: string | null
        }
        Relationships: []
      }
      infrastructure_projects: {
        Row: {
          budget: number
          created_at: string
          data_confidence: number | null
          description: string | null
          expected_completion: string | null
          id: string
          impact_score: number
          municipality_id: string
          project_name: string
          retrieved_at: string | null
          source_name: string
          source_url: string | null
          status: Database["public"]["Enums"]["project_status"]
          type: Database["public"]["Enums"]["project_type"]
        }
        Insert: {
          budget?: number
          created_at?: string
          data_confidence?: number | null
          description?: string | null
          expected_completion?: string | null
          id?: string
          impact_score?: number
          municipality_id: string
          project_name: string
          retrieved_at?: string | null
          source_name?: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          type: Database["public"]["Enums"]["project_type"]
        }
        Update: {
          budget?: number
          created_at?: string
          data_confidence?: number | null
          description?: string | null
          expected_completion?: string | null
          id?: string
          impact_score?: number
          municipality_id?: string
          project_name?: string
          retrieved_at?: string | null
          source_name?: string
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
      ingestion_runs: {
        Row: {
          adapter_name: string
          error_message: string | null
          finished_at: string | null
          id: string
          market: string
          metadata: Json | null
          rows_errored: number | null
          rows_inserted: number | null
          rows_updated: number | null
          started_at: string
          status: string
        }
        Insert: {
          adapter_name: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          market: string
          metadata?: Json | null
          rows_errored?: number | null
          rows_inserted?: number | null
          rows_updated?: number | null
          started_at?: string
          status?: string
        }
        Update: {
          adapter_name?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          market?: string
          metadata?: Json | null
          rows_errored?: number | null
          rows_inserted?: number | null
          rows_updated?: number | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      municipalities: {
        Row: {
          admin_code: string | null
          admin_region_id: string | null
          country: string
          country_id: string | null
          created_at: string
          currency_code: string | null
          data_confidence: number | null
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
          retrieved_at: string | null
          risk_score: number
          slug: string | null
          source_name: string
          source_url: string | null
          updated_at: string
        }
        Insert: {
          admin_code?: string | null
          admin_region_id?: string | null
          country?: string
          country_id?: string | null
          created_at?: string
          currency_code?: string | null
          data_confidence?: number | null
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
          retrieved_at?: string | null
          risk_score?: number
          slug?: string | null
          source_name?: string
          source_url?: string | null
          updated_at?: string
        }
        Update: {
          admin_code?: string | null
          admin_region_id?: string | null
          country?: string
          country_id?: string | null
          created_at?: string
          currency_code?: string | null
          data_confidence?: number | null
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
          retrieved_at?: string | null
          risk_score?: number
          slug?: string | null
          source_name?: string
          source_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "municipalities_admin_region_id_fkey"
            columns: ["admin_region_id"]
            isOneToOne: false
            referencedRelation: "admin_regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "municipalities_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
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
          data_confidence: number | null
          evidence: Json
          id: string
          investment_thesis: string
          municipality_id: string
          opportunity_score: number
          retrieved_at: string | null
          risk_level: Database["public"]["Enums"]["risk_level"]
          risk_score: number
          scores: Json | null
          source_name: string
          source_url: string | null
          status: Database["public"]["Enums"]["opportunity_status"]
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          data_confidence?: number | null
          evidence?: Json
          id?: string
          investment_thesis?: string
          municipality_id: string
          opportunity_score?: number
          retrieved_at?: string | null
          risk_level?: Database["public"]["Enums"]["risk_level"]
          risk_score?: number
          scores?: Json | null
          source_name?: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["opportunity_status"]
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          data_confidence?: number | null
          evidence?: Json
          id?: string
          investment_thesis?: string
          municipality_id?: string
          opportunity_score?: number
          retrieved_at?: string | null
          risk_level?: Database["public"]["Enums"]["risk_level"]
          risk_score?: number
          scores?: Json | null
          source_name?: string
          source_url?: string | null
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
          data_confidence: number | null
          decision_date: string | null
          description: string | null
          id: string
          municipality_id: string
          project_type: Database["public"]["Enums"]["project_type"]
          retrieved_at: string | null
          source_name: string
          source_url: string | null
          status: Database["public"]["Enums"]["application_status"]
        }
        Insert: {
          applicant?: string | null
          application_date: string
          created_at?: string
          data_confidence?: number | null
          decision_date?: string | null
          description?: string | null
          id?: string
          municipality_id: string
          project_type: Database["public"]["Enums"]["project_type"]
          retrieved_at?: string | null
          source_name?: string
          source_url?: string | null
          status?: Database["public"]["Enums"]["application_status"]
        }
        Update: {
          applicant?: string | null
          application_date?: string
          created_at?: string
          data_confidence?: number | null
          decision_date?: string | null
          description?: string | null
          id?: string
          municipality_id?: string
          project_type?: Database["public"]["Enums"]["project_type"]
          retrieved_at?: string | null
          source_name?: string
          source_url?: string | null
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
          data_confidence: number | null
          detected_at: string
          id: string
          municipality_id: string
          opportunity_impact: number
          retrieved_at: string | null
          signal_type: Database["public"]["Enums"]["signal_type"]
          source: string
          source_url: string | null
          summary: string
          title: string
        }
        Insert: {
          ai_summary?: string | null
          confidence_level?: number
          data_confidence?: number | null
          detected_at?: string
          id?: string
          municipality_id: string
          opportunity_impact?: number
          retrieved_at?: string | null
          signal_type: Database["public"]["Enums"]["signal_type"]
          source: string
          source_url?: string | null
          summary: string
          title: string
        }
        Update: {
          ai_summary?: string | null
          confidence_level?: number
          data_confidence?: number | null
          detected_at?: string
          id?: string
          municipality_id?: string
          opportunity_impact?: number
          retrieved_at?: string | null
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
      signals_public: {
        Row: {
          ai_summary: string | null
          confidence_level: number | null
          detected_at: string | null
          id: string | null
          municipality_id: string | null
          opportunity_impact: number | null
          signal_type: Database["public"]["Enums"]["signal_type"] | null
          source: string | null
          source_url: string | null
          summary: string | null
          title: string | null
        }
        Insert: {
          ai_summary?: never
          confidence_level?: number | null
          detected_at?: string | null
          id?: string | null
          municipality_id?: string | null
          opportunity_impact?: number | null
          signal_type?: Database["public"]["Enums"]["signal_type"] | null
          source?: string | null
          source_url?: string | null
          summary?: string | null
          title?: string | null
        }
        Update: {
          ai_summary?: never
          confidence_level?: number | null
          detected_at?: string | null
          id?: string | null
          municipality_id?: string | null
          opportunity_impact?: number | null
          signal_type?: Database["public"]["Enums"]["signal_type"] | null
          source?: string | null
          source_url?: string | null
          summary?: string | null
          title?: string | null
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
    }
    Functions: {
      get_user_tier: { Args: never; Returns: string }
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

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
