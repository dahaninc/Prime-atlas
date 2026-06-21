-- ═══════════════════════════════════════════════════════════════════════════
-- prime-atlas · Initial Schema
-- Migration 001 — Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for full-text search on names

-- ─── ENUMS ────────────────────────────────────────────────────────────────────

CREATE TYPE subscription_tier AS ENUM ('free', 'pro', 'investor', 'institutional');
CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high', 'very_high');
CREATE TYPE opportunity_status AS ENUM ('active', 'watchlist', 'closed', 'under_review');
CREATE TYPE signal_type AS ENUM (
  'infrastructure_approved', 'employer_relocating', 'planning_application',
  'utility_expansion', 'university_announced', 'transport_link',
  'development_zone', 'government_investment'
);
CREATE TYPE project_type AS ENUM (
  'road', 'rail', 'airport', 'port', 'utility', 'education',
  'healthcare', 'commercial', 'residential', 'industrial'
);
CREATE TYPE project_status AS ENUM ('planned', 'approved', 'under_construction', 'completed');
CREATE TYPE application_status AS ENUM ('submitted', 'approved', 'rejected', 'pending');
CREATE TYPE alert_frequency AS ENUM ('immediate', 'daily', 'weekly');

-- ─── MUNICIPALITIES ───────────────────────────────────────────────────────────

CREATE TABLE municipalities (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name               TEXT NOT NULL,
  region             TEXT NOT NULL,
  country            TEXT NOT NULL DEFAULT 'Spain',
  population         INTEGER NOT NULL DEFAULT 0,
  growth_metrics     JSONB NOT NULL DEFAULT '{}',
  -- Sub-scores (0–100)
  growth_score       SMALLINT NOT NULL DEFAULT 0 CHECK (growth_score BETWEEN 0 AND 100),
  infrastructure_score SMALLINT NOT NULL DEFAULT 0 CHECK (infrastructure_score BETWEEN 0 AND 100),
  development_score  SMALLINT NOT NULL DEFAULT 0 CHECK (development_score BETWEEN 0 AND 100),
  liquidity_score    SMALLINT NOT NULL DEFAULT 0 CHECK (liquidity_score BETWEEN 0 AND 100),
  risk_score         SMALLINT NOT NULL DEFAULT 50 CHECK (risk_score BETWEEN 0 AND 100),
  opportunity_score  SMALLINT NOT NULL DEFAULT 0 CHECK (opportunity_score BETWEEN 0 AND 100),
  lat                DOUBLE PRECISION NOT NULL DEFAULT 0,
  lng                DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (name, region)
);

CREATE INDEX idx_municipalities_opportunity_score ON municipalities (opportunity_score DESC);
CREATE INDEX idx_municipalities_region ON municipalities (region);
CREATE INDEX idx_municipalities_name_trgm ON municipalities USING GIN (name gin_trgm_ops);

-- ─── OPPORTUNITIES ────────────────────────────────────────────────────────────

CREATE TABLE opportunities (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title               TEXT NOT NULL,
  investment_thesis   TEXT NOT NULL DEFAULT '',
  opportunity_score   SMALLINT NOT NULL DEFAULT 0 CHECK (opportunity_score BETWEEN 0 AND 100),
  risk_level          risk_level NOT NULL DEFAULT 'medium',
  risk_score          SMALLINT NOT NULL DEFAULT 50 CHECK (risk_score BETWEEN 0 AND 100),
  municipality_id     UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
  category            TEXT NOT NULL, -- e.g. 'Coastal', 'Industrial', 'Infrastructure'
  evidence            JSONB NOT NULL DEFAULT '[]',
  scores              JSONB,         -- snapshot of sub-scores at last recalculation
  status              opportunity_status NOT NULL DEFAULT 'active',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_opportunities_score ON opportunities (opportunity_score DESC);
CREATE INDEX idx_opportunities_municipality ON opportunities (municipality_id);
CREATE INDEX idx_opportunities_status ON opportunities (status);
CREATE INDEX idx_opportunities_category ON opportunities (category);

-- ─── INFRASTRUCTURE PROJECTS ──────────────────────────────────────────────────

CREATE TABLE infrastructure_projects (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_name        TEXT NOT NULL,
  type                project_type NOT NULL,
  budget              BIGINT NOT NULL DEFAULT 0, -- EUR cents
  status              project_status NOT NULL DEFAULT 'planned',
  impact_score        SMALLINT NOT NULL DEFAULT 0 CHECK (impact_score BETWEEN 0 AND 100),
  municipality_id     UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
  expected_completion DATE,
  description         TEXT,
  source_url          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_infra_municipality ON infrastructure_projects (municipality_id);
CREATE INDEX idx_infra_status ON infrastructure_projects (status);
CREATE INDEX idx_infra_impact ON infrastructure_projects (impact_score DESC);

-- ─── PLANNING APPLICATIONS ───────────────────────────────────────────────────

CREATE TABLE planning_applications (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_type        project_type NOT NULL,
  status              application_status NOT NULL DEFAULT 'pending',
  municipality_id     UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
  application_date    DATE NOT NULL,
  decision_date       DATE,
  description         TEXT,
  applicant           TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_planning_municipality ON planning_applications (municipality_id);
CREATE INDEX idx_planning_status ON planning_applications (status);

-- ─── SIGNALS ─────────────────────────────────────────────────────────────────

CREATE TABLE signals (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  signal_type         signal_type NOT NULL,
  title               TEXT NOT NULL,
  summary             TEXT NOT NULL,
  source              TEXT NOT NULL,
  source_url          TEXT,
  confidence_level    REAL NOT NULL DEFAULT 0.7 CHECK (confidence_level BETWEEN 0 AND 1),
  opportunity_impact  SMALLINT NOT NULL DEFAULT 0 CHECK (opportunity_impact BETWEEN 0 AND 100),
  municipality_id     UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
  detected_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_signals_municipality ON signals (municipality_id);
CREATE INDEX idx_signals_detected_at ON signals (detected_at DESC);
CREATE INDEX idx_signals_impact ON signals (opportunity_impact DESC);
CREATE INDEX idx_signals_type ON signals (signal_type);

-- ─── PROFILES (extends auth.users) ───────────────────────────────────────────

CREATE TABLE profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email               TEXT NOT NULL,
  full_name           TEXT,
  subscription_tier   subscription_tier NOT NULL DEFAULT 'free',
  stripe_customer_id  TEXT UNIQUE,
  alert_preferences   JSONB NOT NULL DEFAULT '{
    "email_alerts": true,
    "signal_threshold": 60,
    "watched_municipalities": [],
    "alert_frequency": "daily"
  }',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_stripe ON profiles (stripe_customer_id);

-- ─── SUBSCRIPTIONS ────────────────────────────────────────────────────────────

CREATE TABLE subscriptions (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_subscription_id  TEXT NOT NULL UNIQUE,
  stripe_price_id         TEXT NOT NULL,
  status                  TEXT NOT NULL, -- 'active', 'canceled', 'past_due', etc.
  current_period_end      TIMESTAMPTZ NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user ON subscriptions (user_id);

-- ─── WATCHLISTS ───────────────────────────────────────────────────────────────

CREATE TABLE watchlists (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT 'My Watchlist',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE watchlist_items (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  watchlist_id     UUID NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  municipality_id  UUID REFERENCES municipalities(id) ON DELETE CASCADE,
  opportunity_id   UUID REFERENCES opportunities(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (municipality_id IS NOT NULL OR opportunity_id IS NOT NULL)
);

CREATE INDEX idx_watchlist_items_watchlist ON watchlist_items (watchlist_id);
CREATE INDEX idx_watchlist_user ON watchlists (user_id);

-- ─── AUTO-UPDATE updated_at ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_municipalities_updated_at
  BEFORE UPDATE ON municipalities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_opportunities_updated_at
  BEFORE UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── AUTO-CREATE PROFILE ON SIGNUP ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────

ALTER TABLE municipalities         ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities          ENABLE ROW LEVEL SECURITY;
ALTER TABLE infrastructure_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE planning_applications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals                ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlists             ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist_items        ENABLE ROW LEVEL SECURITY;

-- Public read on core data (SEO + free tier)
CREATE POLICY "Public can read municipalities"
  ON municipalities FOR SELECT USING (true);

CREATE POLICY "Public can read opportunities"
  ON opportunities FOR SELECT USING (status = 'active');

CREATE POLICY "Public can read infrastructure projects"
  ON infrastructure_projects FOR SELECT USING (true);

CREATE POLICY "Public can read planning applications"
  ON planning_applications FOR SELECT USING (true);

CREATE POLICY "Public can read signals"
  ON signals FOR SELECT USING (true);

-- Profiles: user sees only their own
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Subscriptions: user sees only their own
CREATE POLICY "Users can read own subscriptions"
  ON subscriptions FOR SELECT USING (auth.uid() = user_id);

-- Watchlists: user-scoped
CREATE POLICY "Users can CRUD own watchlists"
  ON watchlists FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD own watchlist items"
  ON watchlist_items FOR ALL
  USING (watchlist_id IN (SELECT id FROM watchlists WHERE user_id = auth.uid()));

-- Service role bypass (for edge functions and admin)
CREATE POLICY "Service role full access municipalities"
  ON municipalities FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access opportunities"
  ON opportunities FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access signals"
  ON signals FOR ALL USING (auth.role() = 'service_role');
