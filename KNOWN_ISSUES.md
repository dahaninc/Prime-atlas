# Known issues & deliberate limitations

Honest inventory of cut corners, dormant features, and pending owner decisions.
Shipped documented rather than delayed for polish. Last updated: 2026-07-09.

## Dormant until env vars / owner actions

- ~~PDF parsing returns 503 until `ANTHROPIC_API_KEY` set~~ — **resolved
  2026-07-05**: key added to Vercel prod+preview and .env.local; parsing and
  thesis generation are live. Not yet exercised with a real OM PDF by a
  logged-in user — do one manual upload as part of the launch walkthrough.
- **All real email is limited** until a domain is bought and verified in Resend:
  `RESEND_FROM_EMAIL` is `onboarding@resend.dev`, which only delivers to the
  owner's inbox. Affects deal alerts and undervalued-waitlist notifications.
- **Live Stripe payment E2E has never been run** (needs a real card; refund
  after). The paywall → checkout → webhook → unlimited flow is code-complete
  and unit-consistent but unproven with live money.
- **Domain purchase pending** → then: attach in Vercel, update
  `NEXT_PUBLIC_APP_URL`, Stripe webhook URL, verify in Resend.

## Deliberate scope cuts

- **Screener parser extracts aggregates only** (price, units, avg rent, expense
  ratio, vacancy) — not per-unit rent-roll rows or T12 line items. v2 item;
  design partners to confirm it matters.
- **UK screener module deferred** (SDLT, initial-yield conventions) until the
  US module validates with design partners.
- **One criteria profile per user** (upsert-in-place). Multi-profile is a
  paid-tier differentiator candidate, not built.
- **Market report "demand signals" are template interpretations** of computed
  metrics (rent:sale ratio, mispricing share, relative /sqm, score momentum) —
  deterministic, not LLM-generated. Rate scenarios model a representative
  median-priced asset at 70% LTV / 30yr amort with stated cap-rate-drift
  assumptions.

## Pending owner decisions

- **Free market reports (3 total) activate on registration alone** — they are
  NOT behind the card-on-file gate (screener analyses ARE). Decide whether to
  unify.
- **Existing free users are not grandfathered** past the card-on-file gate:
  after this deploy, saving any screener analysis requires adding a card.
- **Marketing copy says "80+ markets"; DB has 32.**
- **Legal review of disclaimers** before public launch (screener scorecards,
  market reports, underpriced feed all carry "not investment advice" language,
  but it has not been reviewed by counsel).

## Removed features

- **PWA offline shell removed (2026-07-07).** The v3 service worker cached
  the app shell cache-first with no revalidation — returning browsers ran a
  stale deploy forever (dead JS chunks, broken signup). sw.js is now a
  self-destructing kill switch served with no-store. Do not reintroduce a
  caching service worker without deploy-aware versioning and network-first
  navigation handling.

## Data quality

- **Gallery backfill in progress** (~25% synced); Zillow intermittently
  bot-blocked — enrich-agents cron retries every 3 days (2026-07-07: reduced
  from hourly to cut ScrapeOps cost; agent/gallery enrichment is a backfill,
  not part of the "live data" freshness claim, so slower is low-risk).
- **Listing freshness is now tiered** (2026-07-07): busiest markets (NYC, LA,
  Chicago, Houston, Phoenix, Philadelphia, San Antonio, San Diego, Dallas,
  SF for sale; NYC/LA/Chicago/Houston/Miami for rent; London for UK) scrape
  daily. Remaining 20 US metros and 13 UK regional cities scrape every 3
  days. "Auto-refreshed daily" copy was removed from market-feed accordingly
  — the UI now shows the real last-synced date instead of a blanket claim.
- ~~**Price/size outliers** produce absurd "-70% discounts"~~ — **root cause
  found 2026-07-08/09**: two confirmed scraper parsing bugs, not generic
  noise. `onthemarket` provider corrupts ~99% of scraped rent prices
  (concatenation-style parsing bug). `zillow` provider corrupts a smaller
  share of sale prices + size_sqm + bedrooms — confirmed to have silently
  moved LA's published median sale price 43% before the fix. **Mitigated,
  not fixed**: migration 014 (market_rent_stats) excludes onthemarket;
  migration 015 (market_listing_stats) adds a $50M/£50M price ceiling;
  `src/lib/listingSanity.ts` bounds price/size_sqm/bedrooms on raw
  per-listing display (market-feed, market-feed/[id], deal-board); the Deal
  Board's Investment Analysis Report additionally excludes any discount
  beyond ±60% from ranking as a likely data artifact. The scraper itself
  still writes bad rows on every run — these are read-layer stopgaps.
  **Root-cause fix (the actual parser bugs) and a backfill/cleanup pass for
  already-corrupted rows are still open** — not started.
- **TOP DATA-ROADMAP PRIORITY — listing coverage too thin for ZIP-level
  comps in flagship metros** (2026-07-08): discount-to-value now uses
  ZIP-level comparable sets (same ZIP × property type × bedrooms, min 5
  comps — src/lib/comps.ts) instead of the blended metro median, which the
  methodology audit confirmed made "discount" a proxy for "smaller/cheaper
  than the metro's blended mix" (SF condos clustering at ~58% "below
  market"). Rigor-over-coverage is deliberate: at current scrape density
  only 9 of 15 active US markets produce ANY listing with a valid comp
  basis, and the flagship metros — SF, LA, Chicago, Austin, Seattle,
  Miami — are all at ZERO coverage (honest "insufficient comparable data"
  across the board). Widening per-market listing coverage (more listings
  per ZIP, not more markets — market scope stays frozen at 32) is what
  unlocks real submarket comps in flagships, and it is the product's moat:
  the methodology is only as good as the comp density behind it. Genuinely
  covered today (≥5-comp discounts with evidence): Charlotte, Indianapolis,
  Columbus, Phoenix, Denver, Houston, Boston, Nashville (7 or fewer covered
  listings for the last two — thin).
- ~~**Blended-median surfaces not yet migrated to the ZIP-comp basis**~~ —
  **closed 2026-07-08**: /underpriced, deal-alert emails (rule matching +
  waitlist), and the Deal Board per-row "N underpriced" chips all now run
  on the same ZIP-comp screen as the Deal Board panel and the Investment
  Analysis Report, via the shared server helper
  `src/lib/server/compScreens.ts` (paginated full-inventory fetch → 
  `src/lib/comps.ts`). Consequences by design: /underpriced shows only
  genuinely covered US submarkets (UK and zero-coverage flagships drop out,
  with an explicit coverage line instead); a deal-alert email can never
  claim a discount the report would refuse to rank; a rule's
  min_discount_pct can only match listings 15–60% below a real ≥5-comp
  basis. One surface intentionally still shows the blended median: the
  on-screen Deal Board "Macro read" demand signal outside the memo, which
  is explicitly labeled "below median /sqm" (a dispersion statistic, not a
  deal flag); the memo's version of the same signal uses the ZIP-comp basis
  and is labeled accordingly (`mispricingBasis` param in marketReport.ts).
  `market_listing_stats.underpriced_count` remains in the view for that
  labeled statistic but no user-facing surface calls anything "underpriced"
  from it anymore.
- **Municipality-assignment bug**: a small number of properties get
  geocoded to the wrong municipality when a street name coincidentally
  matches a city name — 2 confirmed cases (a Denver, CO property assigned
  to "Raleigh" via "N Raleigh Street"; an Atlanta, GA property assigned to
  "Austin" via "Austin Rd"). A broad text-based proxy check across all US
  properties found no further candidates, but that's a heuristic, not an
  exhaustive geocoding audit. Not fixed — needs the scraper's
  municipality-matching step reviewed, separate from the price-parsing bugs
  above.
- **Redaction heuristics**: `redactStreet` filters street words + house-number
  patterns per comma segment and redacts to null when unsure. Unusual address
  formats fail CLOSED (hidden), never open.

## Architectural notes

- Home and `/opportunities/[slug]` are static/ISR and therefore redact listings
  unconditionally (no viewer tier at render time). Members see full detail on
  the dynamic `/listings` and `/market-feed` pages.
- `profiles.payment_method_on_file` is only writable by service-role code
  (webhook + setup-confirm route); migration 004's column grants make it
  tamper-proof from the client API.
