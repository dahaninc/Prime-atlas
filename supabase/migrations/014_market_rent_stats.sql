-- 014: Real rent-comp median per market — mirrors market_listing_stats'
-- sale-side methodology (percentile_cont(0.5)) but over listing_type =
-- 'rent' rows. Built to compute an honest gross-yield figure for Deal
-- Board's Live Deals — never a hardcoded/heuristic rent stand-in.
--
-- Provider exclusion (data-integrity finding, not a style choice): the
-- 'onthemarket' adapter's rent listings are corrupted — 665 of 669 UK rows
-- (99.4%) carry an implausible price (a price-parsing bug, confirmed by
-- inspection: values look like two numeric fields concatenated without a
-- separator, e.g. 5250121200). 'rightmove' (UK, 1448 rows) and 'zillow'
-- (US, 654 rows) are both 0% implausible over the same check. Excluding
-- onthemarket rent rows here; the underlying scraper bug still needs a
-- separate fix in /api/cron/scrape-listings — this view only guards its
-- own output.
--
-- The price > 0 AND price <= 2000000 ceiling is a second, generous sanity
-- backstop (£20,000 / $20,000 per month) against any future/unknown
-- corruption from other providers — not a "realistic rent" judgment.
--
-- Coverage is uneven by design: UK rent scraping covers all UK markets
-- deeply; US rent scraping is cadence-limited to top metros (see
-- /api/cron/scrape-listings), so many US markets will legitimately show
-- zero comps. Callers must treat a low rent_comp_count as "insufficient
-- data," never interpolate or fall back to another market's figure.

CREATE OR REPLACE VIEW public.market_rent_stats AS
WITH rent AS (
  SELECT municipality_id, price
  FROM public.properties
  WHERE status = 'active' AND listing_type = 'rent'
    AND municipality_id IS NOT NULL AND price IS NOT NULL
    AND price > 0 AND price <= 2000000
    AND provider <> 'onthemarket'
)
SELECT
  municipality_id,
  count(*)::int AS rent_comp_count,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY price)::bigint AS median_rent_price
FROM rent
GROUP BY municipality_id;
