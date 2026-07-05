# Known issues & deliberate limitations

Honest inventory of cut corners, dormant features, and pending owner decisions.
Shipped documented rather than delayed for polish. Last updated: 2026-07-05.

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

## Data quality

- **Gallery backfill in progress** (~25% synced); Zillow intermittently
  bot-blocked — hourly cron retries.
- **Price/size outliers** produce absurd "-70% discounts" in underpriced
  detection in some markets — source-data noise, needs a sanity filter.
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
