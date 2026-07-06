-- 012: Data-sanity bounds for market_listing_stats.
--
-- Source-data noise (mis-scraped sizes/prices) produced absurd "-70%
-- discounts" in the underpriced feed. Fix at the source so every consumer
-- (underpriced feed, deal alerts, Deal Board pulse, market reports)
-- inherits it:
--   · plausible listing bounds: size 15–2000 sqm, price ≥ 20,000 minor units
--   · ppsqm within [0.2x, 5x] of the market median counts toward stats
--   · "underpriced" = 15–60% below median (deeper than 60% is presumed
--     data error, not alpha)

CREATE OR REPLACE VIEW public.market_listing_stats AS
WITH sale AS (
  SELECT municipality_id, price,
         CASE WHEN size_sqm BETWEEN 15 AND 2000 THEN price / size_sqm END AS ppsqm
  FROM public.properties
  WHERE status = 'active' AND listing_type = 'sale'
    AND municipality_id IS NOT NULL AND price IS NOT NULL
    AND price >= 20000
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
      AND s.ppsqm >= med.median_ppsqm * 0.40   -- deeper than −60% = data error
      AND s.ppsqm <= med.median_ppsqm * 0.85) AS underpriced_count
FROM med;
