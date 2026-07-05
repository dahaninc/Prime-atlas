# Prime Atlas — project brief for Claude sessions

US/UK property-investment intelligence SaaS. Next.js 14 (App Router) + Supabase + Stripe + ScrapeOps, deployed on Vercel Pro via GitHub push to `main` (repo: dahaninc/Prime-atlas). Production: https://prime-atlas-weld.vercel.app (prime-atlas.com NOT attached yet).

## Commands
- `npm run typecheck` / `npm run lint` / `npm test` / `npm run build` — all must pass; CI (.github/workflows/ci.yml) enforces them. Never re-enable `typescript.ignoreBuildErrors`.
- Deploy = push to `main` (Vercel git integration). No Actions-based deploys.

## Architecture
- **Supabase** project `vcnpevcmnobpznikahku` (EU). Migrations in `supabase/migrations/` are the source of truth (001–009 match live). Regenerate `src/lib/supabase/database.types.ts` after schema changes.
- **Auth**: `@supabase/ssr` v0.12 with getAll/setAll cookies everywhere (`src/lib/supabase/server.ts`, `src/middleware.ts`). Client login only via `AuthForm` (supabase-js in browser). Middleware: anonymous fast-path (skips Supabase when no `sb-` cookies), protects /dashboard /watchlists /signals /opportunities/finder /admin /portfolio /deal-board /screener; /signals + /opportunities/finder also require paid tier.
- **Tiers (canonical, everywhere)**: `free | explorer ($29.99) | professional ($69.99) | institutional ($89.99)`. DB enum matches. Stripe env: `STRIPE_PRICE_EXPLORER/PROFESSIONAL/INSTITUTIONAL` (legacy `_PRO/_INVESTOR` still fallback).
- **Stripe**: webhook `/api/stripe/webhook` (returns 500 on DB failure so Stripe retries; resolves user via subscription metadata `user_id` first; all billing states handled — past_due/unpaid → free). Checkout seeds metadata. Portal config `bpc_...` is account default. Account: SabioAI (`acct_1ToUdM2Lj8cdtHlx`), live mode.
- **Public pages are static/ISR** via `src/lib/supabase/public.ts` (cookie-less client): home (1h), opportunities/[slug] (5m, `●`), rankings/legal (static). Navbar resolves user client-side — never add `cookies()` back to public layouts.
- **Design language (obsidian dark, July 2026 rebrand)**: whole app is dark-first via semantic tokens in `globals.css` — canvas `#09090b` (`bg-background`), panels `#141416` (`bg-card`), borders `#222226` (`border-border`). Prime Blue `#2563eb` (`bg-primary`, alias `pa-blue`) = ONLY action/brand/active-state color; green `pa-green/#00C805` = live/positive data only, never CTAs. Always use semantic token classes (`bg-card`, `text-foreground`, `text-zinc-400/500` for muted) — never raw light-theme classes (`bg-white`, `text-gray-*`) or brand hexes. Utilities in globals.css: `.glass`/`.glass-panel` (backdrop-blur chrome + dropdowns), `.active-glow` (nav left-accent), `.skeleton` (shimmer loaders), `.status-dot-live/busy/error`, `.kicker`. Toasts: `toast()` from `src/components/ui/Toaster.tsx` (mounted in root layout), bottom-right micro-toasts — no alert(). Kickers: mono uppercase tracking-widest.

## Scraping pipeline
- `/api/cron/scrape-listings?provider=X&batch=N` — ScrapeOps proxy, 5 URLs/batch (BATCH_SIZE=5), 45s timeouts, 180s soft deadline. Targets are GENERATED lists in the route (zillow 100 = pages 1-3 across 40 city feeds; rightmove 165 = London deep + 13 regional REGION codes; onthemarket 70 = 14 city slugs x pages 1-3, renderJs:false — render_js breaks ?page=N there). Fresh page-1 batches are cron-scheduled (vercel.json); deep batches are one-shot backfill (invoke manually with CRON_SECRET). Upsert NEVER shrinks a stored gallery. OTM ids MUST be numeric /details/<id> — location slugs were once scraped as fake properties (purged).
- `/api/cron/enrich-agents` (hourly, accepts ?provider=) — detail pass: FULL gallery + agent info. Queue order: gallery_synced_at NULLS FIRST then updated_at ASC (agent-less synced rows must not starve unsynced). fetchPage requires per-provider marker (zillow gdpClientCache / RM PAGE_MODEL / OTM __NEXT_DATA__) so 200-OK bot pages fail instead of fake-succeeding. Zillow galleries dedupe on /fp/<hash>. Zillow blocking comes and goes — when galleries_synced:0 repeats, stop hammering (credits) and let the cron retry.
- To fast-fill galleries: loop `curl -H "Authorization: Bearer " "/api/cron/enrich-agents?provider=rightmove"` (~2min/40 rows) per provider; stop on "nothing to enrich" or 3x zero-yield.
- Inventory (2026-07-06): ~11k properties (UK 6.4k / US 4.6k), galleries ~25% synced and climbing via cron.

## Member features (deal-flow layer, migration 006)
- `market_listing_stats` view: per-market sale/rent counts, median price, median /sqm, underpriced count (≥15% below median /sqm). Powers Deal Board "Live market pulse".
- `/api/cron/deal-alerts` (hourly): matches new listings to `deal_alert_rules` (price/beds/discount/est-yield via `src/lib/yield.ts`), emails via Resend, dedupe via `deal_alert_hits`.
- `/api/cron/snapshot-scores` (weekly Mon): appends to `market_score_history` → momentum arrows on Deal Board.
- `/portfolio` (institutional-gated): `portfolio_assets` + per-market intel.
- IC memo export: POST /api/export/ic-memo (server-gated: 401 anon, 403 free) compiles the 5-section committee memo as Word-editable .doc; pro-forma engine shared in src/lib/proforma.ts.
- Deal Screener (/screener, migration 007, auth-gated): editable US acquisition pro-forma (NOI/cap/DSCR/CoC + sensitivity, src/lib/screener.ts w/ vitest coverage), saved criteria profiles, pass/fail delta scorecards (never advice), analysis history (click to reload), quota: free 3 analyses/mo, paid unlimited. Free quota activates only after card-on-file (migration 008: Stripe Checkout mode=setup via /api/stripe/setup; profiles.payment_method_on_file writable by service role only). PDF parse route ready but 503 until ANTHROPIC_API_KEY set. UK module deliberately deferred.
- **Free-tier funnel (migration 009)**: non-members see listings redacted SERVER-SIDE — locality-only address + zero photos (src/lib/access.ts redactStreet/redactRows, fails closed, regression-tested). /underpriced strictly members-only (anon/free: aggregate teaser + undervalued-waitlist signup; deal-alerts cron mails waitlist hits to paid tiers only, dedupe underpriced_waitlist_hits). /reports/market (auth-gated, in account menu): proprietary market reports — conviction scores, momentum sparkline, inventory/mispricing analytics, demand signals, rate implications 3/5/10yr (src/lib/marketReport.ts w/ vitest) — free 3 total, paid unlimited. Single pricing ladder only: NEVER propose per-feature SKUs.
- See KNOWN_ISSUES.md for documented limitations + pending owner decisions.

## Env vars (all in Vercel prod+preview and .env.local)
Supabase trio · STRIPE_SECRET_KEY (restricted rk_live) · STRIPE_WEBHOOK_SECRET · 3 price IDs · STRIPE_PORTAL_CONFIG_ID · NEXT_PUBLIC_APP_URL · CRON_SECRET · SCRAPEOPS_API_KEY · SLACK_WEBHOOK_URL · RESEND_API_KEY (send-only) · RESEND_FROM_EMAIL (temp `onboarding@resend.dev` — only delivers to owner's inbox until a domain is bought + verified in Resend) · ANTHROPIC_API_KEY (added 2026-07-05 — screener PDF parsing + thesis generation live).

## Known gaps / next up
- Gallery backfill in progress (~25%); UK providers sync clean, Zillow intermittently bot-blocked (cron retries hourly). Re-run provider loops to accelerate.
- ANTHROPIC_API_KEY missing -> blocks screener PDF parsing + thesis generation. Highest-leverage env var to add.
- Domain purchase pending -> then: attach in Vercel, update NEXT_PUBLIC_APP_URL, Stripe webhook URL, verify in Resend, update RESEND_FROM_EMAIL. Blocks all real email (alerts, digests).
- E2E live payment test never run (needs a real card; refund after).
- QA: `python3 scripts/qa/e2e_smoke.py` — 30+ live checks vs prod (surface, auth walls, IDOR/RLS, data invariants, gallery dedupe). Run after every deploy.
- Data sanity TODO: filter absurd price/size_sqm outliers (some -70%+ "discounts" on /underpriced are source-data noise).
- Screener UK module (SDLT/initial yield) deliberately deferred until US validates with design partners; legal review of disclaimers before public launch.
- Marketing copy says "80+ markets"; DB has 32. Owner to decide.
- Admin gate = email list in `src/lib/auth/admins.ts` (override via ADMIN_EMAILS env).
