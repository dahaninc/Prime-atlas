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
      contact_requests: {
        Row: {
          created_at: string | null
          id: string
          property_id: string
          sent_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          property_id: string
          sent_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          property_id?: string
          sent_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
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
      deal_alert_hits: {
        Row: {
          id: string
          notified_at: string
          property_id: string
          rule_id: string
        }
        Insert: {
          id?: string
          notified_at?: string
          property_id: string
          rule_id: string
        }
        Update: {
          id?: string
          notified_at?: string
          property_id?: string
          rule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_alert_hits_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_alert_hits_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "deal_alert_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_alert_rules: {
        Row: {
          active: boolean
          country_iso2: string | null
          created_at: string
          id: string
          listing_type: string
          max_price: number | null
          min_bedrooms: number | null
          min_discount_pct: number | null
          min_yield_pct: number | null
          municipality_id: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          country_iso2?: string | null
          created_at?: string
          id?: string
          listing_type?: string
          max_price?: number | null
          min_bedrooms?: number | null
          min_discount_pct?: number | null
          min_yield_pct?: number | null
          municipality_id?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          country_iso2?: string | null
          created_at?: string
          id?: string
          listing_type?: string
          max_price?: number | null
          min_bedrooms?: number | null
          min_discount_pct?: number | null
          min_yield_pct?: number | null
          municipality_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_alert_rules_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
        ]
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
      listings: {
        Row: {
          address: string
          agent_name: string | null
          agent_url: string | null
          annual_income: number | null
          asking_price: number
          bathrooms: number | null
          bedrooms: number | null
          comparables: Json | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          currency_code: string
          date_listed: string | null
          deal_type: string | null
          description: string | null
          featured: boolean | null
          features: string[] | null
          gdv_margin_pct: number | null
          gross_yield_pct: number | null
          highlights: string[] | null
          id: string
          images: string[] | null
          investment_structure: string | null
          investor_profile: string[] | null
          listing_type: string
          min_investment: number | null
          municipality_id: string | null
          planning_status: string | null
          postcode: string | null
          size_sqm: number | null
          source_url: string | null
          status: string
          tenure: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          address: string
          agent_name?: string | null
          agent_url?: string | null
          annual_income?: number | null
          asking_price: number
          bathrooms?: number | null
          bedrooms?: number | null
          comparables?: Json | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          currency_code?: string
          date_listed?: string | null
          deal_type?: string | null
          description?: string | null
          featured?: boolean | null
          features?: string[] | null
          gdv_margin_pct?: number | null
          gross_yield_pct?: number | null
          highlights?: string[] | null
          id?: string
          images?: string[] | null
          investment_structure?: string | null
          investor_profile?: string[] | null
          listing_type: string
          min_investment?: number | null
          municipality_id?: string | null
          planning_status?: string | null
          postcode?: string | null
          size_sqm?: number | null
          source_url?: string | null
          status?: string
          tenure?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          address?: string
          agent_name?: string | null
          agent_url?: string | null
          annual_income?: number | null
          asking_price?: number
          bathrooms?: number | null
          bedrooms?: number | null
          comparables?: Json | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          currency_code?: string
          date_listed?: string | null
          deal_type?: string | null
          description?: string | null
          featured?: boolean | null
          features?: string[] | null
          gdv_margin_pct?: number | null
          gross_yield_pct?: number | null
          highlights?: string[] | null
          id?: string
          images?: string[] | null
          investment_structure?: string | null
          investor_profile?: string[] | null
          listing_type?: string
          min_investment?: number | null
          municipality_id?: string | null
          planning_status?: string | null
          postcode?: string | null
          size_sqm?: number | null
          source_url?: string | null
          status?: string
          tenure?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
        ]
      }
      market_score_history: {
        Row: {
          captured_on: string
          development_score: number
          growth_score: number
          id: string
          infrastructure_score: number
          liquidity_score: number
          municipality_id: string
          opportunity_score: number
          risk_score: number
        }
        Insert: {
          captured_on?: string
          development_score: number
          growth_score: number
          id?: string
          infrastructure_score: number
          liquidity_score: number
          municipality_id: string
          opportunity_score: number
          risk_score: number
        }
        Update: {
          captured_on?: string
          development_score?: number
          growth_score?: number
          id?: string
          infrastructure_score?: number
          liquidity_score?: number
          municipality_id?: string
          opportunity_score?: number
          risk_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "market_score_history_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
        ]
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
      portfolio_assets: {
        Row: {
          address: string | null
          created_at: string
          currency_code: string
          id: string
          municipality_id: string | null
          name: string
          notes: string | null
          purchase_date: string | null
          purchase_price: number | null
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          currency_code?: string
          id?: string
          municipality_id?: string | null
          name: string
          notes?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          currency_code?: string
          id?: string
          municipality_id?: string | null
          name?: string
          notes?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_assets_municipality_id_fkey"
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
      properties: {
        Row: {
          address: string | null
          agent_company: string | null
          agent_email: string | null
          agent_name: string | null
          agent_phone: string | null
          bathrooms: number | null
          bedrooms: number | null
          city: string | null
          country_iso2: string | null
          created_at: string
          currency_code: string
          external_property_id: string
          gallery_synced_at: string | null
          id: string
          images: Json | null
          listing_type: string
          listing_url: string | null
          municipality_id: string | null
          postcode: string | null
          price: number | null
          property_type: string | null
          property_type_raw: string | null
          provider: string
          scraped_at: string
          size_sqm: number | null
          state_region: string | null
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          agent_company?: string | null
          agent_email?: string | null
          agent_name?: string | null
          agent_phone?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string | null
          country_iso2?: string | null
          created_at?: string
          currency_code?: string
          external_property_id: string
          gallery_synced_at?: string | null
          id?: string
          images?: Json | null
          listing_type?: string
          listing_url?: string | null
          municipality_id?: string | null
          postcode?: string | null
          price?: number | null
          property_type?: string | null
          property_type_raw?: string | null
          provider: string
          scraped_at?: string
          size_sqm?: number | null
          state_region?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          agent_company?: string | null
          agent_email?: string | null
          agent_name?: string | null
          agent_phone?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string | null
          country_iso2?: string | null
          created_at?: string
          currency_code?: string
          external_property_id?: string
          gallery_synced_at?: string | null
          id?: string
          images?: Json | null
          listing_type?: string
          listing_url?: string | null
          municipality_id?: string | null
          postcode?: string | null
          price?: number | null
          property_type?: string | null
          property_type_raw?: string | null
          provider?: string
          scraped_at?: string
          size_sqm?: number | null
          state_region?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
        ]
      }
      scraper_runs: {
        Row: {
          created_at: string
          duration_ms: number
          errors: Json
          exit_status: string
          finished_at: string
          id: string
          provider: string
          records_failed: number
          records_scraped: number
          records_upserted: number
          started_at: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number
          errors?: Json
          exit_status: string
          finished_at: string
          id?: string
          provider: string
          records_failed?: number
          records_scraped?: number
          records_upserted?: number
          started_at: string
        }
        Update: {
          created_at?: string
          duration_ms?: number
          errors?: Json
          exit_status?: string
          finished_at?: string
          id?: string
          provider?: string
          records_failed?: number
          records_scraped?: number
          records_upserted?: number
          started_at?: string
        }
        Relationships: []
      }
      screener_analyses: {
        Row: {
          country: string
          created_at: string
          criteria_id: string | null
          id: string
          inputs: Json
          name: string | null
          outputs: Json
          scorecard: Json | null
          user_id: string
        }
        Insert: {
          country?: string
          created_at?: string
          criteria_id?: string | null
          id?: string
          inputs: Json
          name?: string | null
          outputs: Json
          scorecard?: Json | null
          user_id: string
        }
        Update: {
          country?: string
          created_at?: string
          criteria_id?: string | null
          id?: string
          inputs?: Json
          name?: string | null
          outputs?: Json
          scorecard?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "screener_analyses_criteria_id_fkey"
            columns: ["criteria_id"]
            isOneToOne: false
            referencedRelation: "screener_criteria"
            referencedColumns: ["id"]
          },
        ]
      }
      screener_criteria: {
        Row: {
          active: boolean
          country: string
          created_at: string
          hold_years: number | null
          id: string
          max_price_per_unit: number | null
          min_dscr: number | null
          name: string
          target_cap_pct: number | null
          target_coc_pct: number | null
          user_id: string
        }
        Insert: {
          active?: boolean
          country?: string
          created_at?: string
          hold_years?: number | null
          id?: string
          max_price_per_unit?: number | null
          min_dscr?: number | null
          name?: string
          target_cap_pct?: number | null
          target_coc_pct?: number | null
          user_id: string
        }
        Update: {
          active?: boolean
          country?: string
          created_at?: string
          hold_years?: number | null
          id?: string
          max_price_per_unit?: number | null
          min_dscr?: number | null
          name?: string
          target_cap_pct?: number | null
          target_coc_pct?: number | null
          user_id?: string
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
      market_listing_stats: {
        Row: {
          median_ppsqm: number | null
          median_price: number | null
          municipality_id: string | null
          rent_count: number | null
          sale_count: number | null
          underpriced_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_municipality_id_fkey"
            columns: ["municipality_id"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["id"]
          },
        ]
      }
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
      subscription_tier: "free" | "explorer" | "professional" | "institutional"
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
      subscription_tier: ["free", "explorer", "professional", "institutional"],
    },
  },
} as const
