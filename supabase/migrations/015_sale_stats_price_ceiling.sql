-- 015: Close a real contamination vector in market_listing_stats (the
-- sale-side comp basis used by the Underpriced feed AND Deal Board
-- discount-to-value). Confirmed via audit: the 'zillow' adapter's sale
-- listings carry a price-corruption bug independent of the onthemarket
-- rent bug fixed in migration 014 — 2.47% of zillow sale rows exceed
-- $10M (max observed: $40,000,000,000), and 100 of those rows have a
-- NORMAL size_sqm (15-2000), meaning they pass the existing ppsqm filter
-- undetected and enter median_price/median_ppsqm uncaught. At current
-- volumes this hasn't visibly moved any market's published median (the
-- corrupted rows are a minority sitting at the extreme tail, and
-- percentile_cont(0.5) is robust to minority tail-outliers) — but that's
-- a property of today's row counts, not a guarantee, and it was
-- previously unprotected. This closes it with the same style of ceiling
-- already applied to the rent view (014), rather than relying on "the
-- numbers happen to look fine."
--
-- $50,000,000 / £50,000,000 ceiling is deliberately generous — no
-- legitimate residential sale in this platform's 32 in-scope mid-size
-- US/UK markets should approach it, and excluding a rare genuine
-- ultra-luxury outlier wouldn't meaningfully move a ~100-190-point
-- median anyway.
--
-- Separately noted, NOT fixed here (different bug class, needs its own
-- work in the scraper's municipality-matching step, not a stats-view
-- change): one property physically in Denver, CO was assigned to the
-- "Raleigh" municipality — traced to a coincidental street-name
-- collision ("N Raleigh Street"). A broad proxy check across all US
-- properties found only one other candidate mismatch (Boston), so this
-- looks like an isolated edge case, not systemic — but that's from a
-- name-text heuristic, not an exhaustive geocoding audit.

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
      AND s.ppsqm >= med.median_ppsqm * 0.40   -- deeper than −60% = presumed data error
      AND s.ppsqm <= med.median_ppsqm * 0.85) AS underpriced_count
FROM med;
