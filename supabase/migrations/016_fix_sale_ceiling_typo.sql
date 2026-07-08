-- 016: SUPERSEDED BY 017 — kept for an honest migration history, do not
-- reapply. This migration was based on a misdiagnosis: it assumed
-- `properties.price` is stored in whole currency units and "corrected"
-- 015's ceiling from 5,000,000,000 to 50,000,000. That was wrong — `price`
-- is stored in MINOR UNITS (cents/pence), so 015's original
-- 5,000,000,000 already equalled the intended $50,000,000 ceiling; there
-- was no typo. Applying this migration silently tightened the real ceiling
-- to $500,000, which discarded most legitimate mid/high-value listings
-- (San Francisco's sale_count dropped 160 -> 12). See 017 for the revert
-- and the full explanation.

CREATE OR REPLACE VIEW public.market_listing_stats AS
WITH sale AS (
  SELECT municipality_id, price,
         CASE WHEN size_sqm BETWEEN 15 AND 2000 THEN price / size_sqm END AS ppsqm
  FROM public.properties
  WHERE status = 'active' AND listing_type = 'sale'
    AND municipality_id IS NOT NULL AND price IS NOT NULL
    AND price >= 20000 AND price <= 50000000
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
      AND s.ppsqm >= med.median_ppsqm * 0.40   -- deeper than −60% = presumed data error
      AND s.ppsqm <= med.median_ppsqm * 0.85) AS underpriced_count
FROM med;
