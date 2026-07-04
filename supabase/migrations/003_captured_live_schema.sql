-- ═══════════════════════════════════════════════════════════════════════════
-- prime-atlas · Migration 003 — Captured live schema (drift sync)
--
-- These tables were created directly in the Supabase dashboard and were
-- missing from the migration history. This file was generated from the
-- live database (project vcnpevcmnobpznikahku) on 2026-07-04 so the repo
-- can rebuild the database from scratch. It is a NO-OP on the live DB
-- (everything is IF NOT EXISTS).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── COUNTRIES ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.countries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  iso2            CHAR(2) NOT NULL UNIQUE,
  iso3            CHAR(3) NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  currency_code   CHAR(3) NOT NULL,
  currency_symbol TEXT NOT NULL,
  locale          TEXT NOT NULL,
  active          BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── ADMIN REGIONS ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.admin_regions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  country_id  UUID NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  code        TEXT,
  level       SMALLINT NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (country_id, code)
);

-- ─── PROPERTIES (scraped listings) ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.properties (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider             TEXT NOT NULL,
  external_property_id TEXT NOT NULL,
  title                TEXT,
  address              TEXT,
  price                BIGINT,
  currency_code        TEXT NOT NULL DEFAULT 'GBP',
  bedrooms             INTEGER,
  bathrooms            INTEGER,
  size_sqm             NUMERIC,
  property_type        TEXT,
  listing_type         TEXT NOT NULL DEFAULT 'sale',
  listing_url          TEXT,
  status               TEXT NOT NULL DEFAULT 'active',
  scraped_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  country_iso2         CHAR(2),
  property_type_raw    TEXT,
  city                 TEXT,
  state_region         TEXT,
  postcode             TEXT,
  images               JSONB DEFAULT '[]'::jsonb,
  agent_name           TEXT,
  agent_company        TEXT,
  agent_phone          TEXT,
  agent_email          TEXT
);

-- Upsert conflict target used by the scraper (provider, external_property_id)
CREATE UNIQUE INDEX IF NOT EXISTS uq_provider_external_id
  ON public.properties (provider, external_property_id);
CREATE INDEX IF NOT EXISTS idx_properties_country      ON public.properties (country_iso2);
CREATE INDEX IF NOT EXISTS idx_properties_listing_type ON public.properties (listing_type);
CREATE INDEX IF NOT EXISTS idx_properties_price        ON public.properties (price);
CREATE INDEX IF NOT EXISTS idx_properties_provider     ON public.properties (provider);
CREATE INDEX IF NOT EXISTS idx_properties_scraped_at   ON public.properties (scraped_at DESC);

-- ─── SCRAPER RUNS (observability) ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.scraper_runs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider         TEXT NOT NULL,
  started_at       TIMESTAMPTZ NOT NULL,
  finished_at      TIMESTAMPTZ NOT NULL,
  records_scraped  INTEGER NOT NULL DEFAULT 0,
  records_upserted INTEGER NOT NULL DEFAULT 0,
  records_failed   INTEGER NOT NULL DEFAULT 0,
  errors           JSONB NOT NULL DEFAULT '[]'::jsonb,
  exit_status      TEXT NOT NULL,
  duration_ms      INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scraper_runs_provider   ON public.scraper_runs (provider);
CREATE INDEX IF NOT EXISTS idx_scraper_runs_started_at ON public.scraper_runs (started_at DESC);

-- ─── LISTINGS (curated deals) ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.listings (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id      UUID REFERENCES public.municipalities(id),
  title                TEXT NOT NULL,
  address              TEXT NOT NULL,
  listing_type         TEXT NOT NULL,
  asking_price         BIGINT NOT NULL,
  currency_code        TEXT NOT NULL DEFAULT 'GBP',
  size_sqm             NUMERIC,
  planning_status      TEXT,
  description          TEXT,
  agent_name           TEXT,
  agent_url            TEXT,
  source_url           TEXT,
  date_listed          DATE DEFAULT CURRENT_DATE,
  status               TEXT NOT NULL DEFAULT 'active',
  featured             BOOLEAN DEFAULT false,
  min_investment       BIGINT,
  investment_structure TEXT,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now(),
  images               TEXT[] DEFAULT '{}',
  features             TEXT[] DEFAULT '{}',
  highlights           TEXT[] DEFAULT '{}',
  bedrooms             INTEGER,
  bathrooms            INTEGER,
  tenure               TEXT,
  contact_name         TEXT,
  contact_email        TEXT,
  contact_phone        TEXT,
  deal_type            TEXT,
  investor_profile     TEXT[] DEFAULT '{}',
  gross_yield_pct      NUMERIC,
  gdv_margin_pct       NUMERIC,
  annual_income        BIGINT,
  postcode             TEXT,
  comparables          JSONB DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS listings_featured_idx        ON public.listings (featured DESC, date_listed DESC);
CREATE INDEX IF NOT EXISTS listings_listing_type_idx    ON public.listings (listing_type);
CREATE INDEX IF NOT EXISTS listings_municipality_id_idx ON public.listings (municipality_id);
CREATE INDEX IF NOT EXISTS listings_status_idx          ON public.listings (status);

-- ─── CONTACT REQUESTS (property report emails) ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.contact_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  property_id UUID NOT NULL REFERENCES public.properties(id),
  status      TEXT NOT NULL DEFAULT 'sent',
  sent_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS contact_requests_user_property_idx
  ON public.contact_requests (user_id, property_id);

-- ─── NEWSLETTER SUBSCRIBERS ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL UNIQUE,
  source     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── CAPITAL ENQUIRIES ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.capital_enquiries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  company       TEXT,
  fund_size     TEXT,
  target_return TEXT,
  geography     TEXT,
  message       TEXT,
  status        TEXT NOT NULL DEFAULT 'new'
);

-- ─── INGESTION RUNS (data-pipeline observability) ────────────────────────────

CREATE TABLE IF NOT EXISTS public.ingestion_runs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  adapter_name  TEXT NOT NULL,
  market        TEXT NOT NULL,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ,
  rows_inserted INTEGER DEFAULT 0,
  rows_updated  INTEGER DEFAULT 0,
  rows_errored  INTEGER DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'running',
  error_message TEXT,
  metadata      JSONB DEFAULT '{}'::jsonb
);

-- ─── DATA FRESHNESS ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.data_freshness (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name     TEXT NOT NULL,
  market_iso2    CHAR(2) NOT NULL,
  last_updated   TIMESTAMPTZ,
  next_update    TIMESTAMPTZ,
  update_cadence TEXT,
  row_count      INTEGER,
  adapter_name   TEXT,
  UNIQUE (table_name, market_iso2)
);

-- ─── PROFILES: Stripe columns added post-001 ─────────────────────────────────

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id  TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_period_end TIMESTAMPTZ;

-- ─── RLS for captured tables ─────────────────────────────────────────────────

ALTER TABLE public.countries              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_regions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraper_runs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capital_enquiries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_runs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_freshness         ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "properties_public_read" ON public.properties
    FOR SELECT USING (status = 'active');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "listings_public_read" ON public.listings
    FOR SELECT USING (status = ANY (ARRAY['active','under_offer']));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "scraper_runs_service_only" ON public.scraper_runs
    FOR ALL USING (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_insert_newsletter" ON public.newsletter_subscribers
    FOR INSERT TO anon WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_insert_enquiries" ON public.capital_enquiries
    FOR INSERT TO anon WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
