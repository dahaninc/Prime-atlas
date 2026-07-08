-- 017: Reverts 016. 016 was based on a misdiagnosis — it assumed
-- `properties.price` is stored in whole currency units, so it "corrected"
-- 015's ceiling literal from 5,000,000,000 to 50,000,000. That was wrong:
-- `price` is stored in MINOR UNITS (cents/pence), same as every other money
-- column in this schema (confirmed by the app's own display logic —
-- DealBoard.tsx divides by 100 before formatting, e.g. `fmt(median_price /
-- 100, sym)`). 5,000,000,000 minor units IS $50,000,000 — exactly what
-- 015's comment always intended. There was no typo in 015.
--
-- Applying 016 briefly and incorrectly tightened the ceiling to $500,000
-- (50,000,000 minor units), which silently discarded the majority of
-- legitimate mid-to-high-value sale listings in every market (e.g. San
-- Francisco's sale_count dropped 160 -> 12, Los Angeles 68 -> 8) — verified
-- before shipping this revert. This migration restores 015's original,
-- correct ceiling with no other logic changes.

CREATE OR REPLACE VIEW public.market_listing_stats AS
WITH sale AS (
  SELECT municipality_id, price,
         CASE WHEN size_sqm BETWEEN 15 AND 2000 THEN price / size_sqm END AS ppsqm
  FROM public.properties
  WHERE status = 'active' AND listing_type = 'sale'
    AND municipality_id IS NOT NULL AND price IS NOT NULL
    AND price >= 20000 AND price <= 5000000000
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
      AND s.ppsqm >= med.median_ppsqm * 0.40
      AND s.ppsqm <= med.median_ppsqm * 0.85) AS underpriced_count
FROM med;
