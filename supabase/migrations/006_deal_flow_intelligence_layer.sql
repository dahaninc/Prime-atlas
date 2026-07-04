-- ═══════════════════════════════════════════════════════════════
-- 006 · Deal-flow intelligence layer
-- APPLIED TO LIVE on 2026-07-04 via MCP as "deal_flow_intelligence_layer".
-- Links scraped listings to markets, computes live market stats,
-- records score history, and adds alert rules + portfolio tables.
-- ═══════════════════════════════════════════════════════════════

-- 1 ── Link properties to municipalities ─────────────────────────
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS municipality_id UUID REFERENCES public.municipalities(id);
CREATE INDEX IF NOT EXISTS idx_properties_municipality ON public.properties (municipality_id);

CREATE OR REPLACE FUNCTION public.match_property_municipality()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public' AS $$
BEGIN
  IF NEW.municipality_id IS NULL AND NEW.address IS NOT NULL THEN
    SELECT m.id INTO NEW.municipality_id
    FROM municipalities m
    WHERE ((NEW.country_iso2 = 'US' AND m.country = 'United States')
        OR (NEW.country_iso2 = 'GB' AND m.country = 'United Kingdom'))
      AND NEW.address ILIKE '%' || m.name || '%'
    ORDER BY length(m.name) DESC
    LIMIT 1;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_properties_match_municipality ON public.properties;
CREATE TRIGGER trg_properties_match_municipality
  BEFORE INSERT OR UPDATE OF address ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.match_property_municipality();

UPDATE public.properties p SET municipality_id = sub.mid
FROM (
  SELECT p2.id AS pid,
    (SELECT m.id FROM public.municipalities m
      WHERE ((p2.country_iso2 = 'US' AND m.country = 'United States')
          OR (p2.country_iso2 = 'GB' AND m.country = 'United Kingdom'))
        AND p2.address ILIKE '%' || m.name || '%'
      ORDER BY length(m.name) DESC LIMIT 1) AS mid
  FROM public.properties p2
  WHERE p2.municipality_id IS NULL AND p2.address IS NOT NULL
) sub
WHERE p.id = sub.pid AND sub.mid IS NOT NULL;

-- 2 ── Live market stats view ────────────────────────────────────
CREATE OR REPLACE VIEW public.market_listing_stats AS
WITH sale AS (
  SELECT municipality_id, price,
         CASE WHEN size_sqm > 0 THEN price / size_sqm END AS ppsqm
  FROM public.properties
  WHERE status = 'active' AND listing_type = 'sale'
    AND municipality_id IS NOT NULL AND price IS NOT NULL
),
med AS (
  SELECT municipality_id,
    count(*)::int AS sale_count,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY price) AS median_price,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY ppsqm) FILTER (WHERE ppsqm IS NOT NULL) AS median_ppsqm
  FROM sale GROUP BY municipality_id
)
SELECT
  med.municipality_id,
  med.sale_count,
  (SELECT count(*)::int FROM public.properties p
    WHERE p.municipality_id = med.municipality_id
      AND p.status = 'active' AND p.listing_type = 'rent') AS rent_count,
  med.median_price::bigint  AS median_price,
  med.median_ppsqm::numeric AS median_ppsqm,
  (SELECT count(*)::int FROM sale s
    WHERE s.municipality_id = med.municipality_id
      AND s.ppsqm IS NOT NULL AND med.median_ppsqm IS NOT NULL
      AND s.ppsqm <= med.median_ppsqm * 0.85) AS underpriced_count
FROM med;

-- 3 ── Score history (time series for track record) ──────────────
CREATE TABLE IF NOT EXISTS public.market_score_history (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id      UUID NOT NULL REFERENCES public.municipalities(id) ON DELETE CASCADE,
  captured_on          DATE NOT NULL DEFAULT CURRENT_DATE,
  opportunity_score    SMALLINT NOT NULL,
  growth_score         SMALLINT NOT NULL,
  infrastructure_score SMALLINT NOT NULL,
  development_score    SMALLINT NOT NULL,
  liquidity_score      SMALLINT NOT NULL,
  risk_score           SMALLINT NOT NULL,
  UNIQUE (municipality_id, captured_on)
);
ALTER TABLE public.market_score_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read score history" ON public.market_score_history FOR SELECT USING (true);

INSERT INTO public.market_score_history
  (municipality_id, opportunity_score, growth_score, infrastructure_score, development_score, liquidity_score, risk_score)
SELECT id, opportunity_score, growth_score, infrastructure_score, development_score, liquidity_score, risk_score
FROM public.municipalities
ON CONFLICT (municipality_id, captured_on) DO NOTHING;

-- 4 ── Member deal-alert rules + notification log ─────────────────
CREATE TABLE IF NOT EXISTS public.deal_alert_rules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  municipality_id  UUID REFERENCES public.municipalities(id) ON DELETE CASCADE,
  country_iso2     CHAR(2),
  listing_type     TEXT NOT NULL DEFAULT 'sale',
  max_price        BIGINT,
  min_bedrooms     INTEGER,
  min_discount_pct NUMERIC,
  min_yield_pct    NUMERIC,
  active           BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.deal_alert_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own alert rules" ON public.deal_alert_rules
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_active ON public.deal_alert_rules (active) WHERE active;

CREATE TABLE IF NOT EXISTS public.deal_alert_hits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id     UUID NOT NULL REFERENCES public.deal_alert_rules(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  notified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rule_id, property_id)
);
ALTER TABLE public.deal_alert_hits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own alert hits" ON public.deal_alert_hits
  FOR SELECT TO authenticated
  USING (rule_id IN (SELECT id FROM public.deal_alert_rules WHERE user_id = auth.uid()));

-- 5 ── Portfolio assets (institutional monitoring) ────────────────
CREATE TABLE IF NOT EXISTS public.portfolio_assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  municipality_id UUID REFERENCES public.municipalities(id),
  address         TEXT,
  purchase_price  BIGINT,
  currency_code   TEXT NOT NULL DEFAULT 'USD',
  purchase_date   DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.portfolio_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own portfolio" ON public.portfolio_assets
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_user ON public.portfolio_assets (user_id);
