# Prime Atlas — session brief

US/UK property-investment SaaS. Next.js 14 App Router + Supabase (`vcnpevcmnobpznikahku`) + Stripe (live, acct SabioAI) + ScrapeOps. Deploy = push `main` (repo dahaninc/Prime-atlas → Vercel). Prod: https://prime-atlas-weld.vercel.app (domain not attached yet).

## Hard rules
- `npm run typecheck && npm run lint && npm test && npm run build` must pass. After deploy: `python3 scripts/qa/e2e_smoke.py` (39 checks).
- **Market scope FROZEN at 32 (18 US / 14 UK) until launch + revenue.** No new markets/feeds/geographies. Fix copy down, never DB up.
- **One pricing ladder only**: free / explorer $29.99 / professional $69.99 / institutional $89.99. Never per-feature SKUs. Quota on free, unlimited on paid.
- Never advice language ("good deal", rankings-as-recommendation). Deltas/calculations + "not investment advice". Say "institutional-grade intelligence", NEVER "insider information".
- Server-side gating for anything paid; UI locks are presentation only. Redaction/blur must strip data server-side (blurred DOM text = leak).
- No caching service worker (sw.js is a self-destruct kill switch, served no-store — stale-deploy incident). No new markets. Never re-enable `typescript.ignoreBuildErrors`.
- Dark theme tokens only (`bg-card`, `text-foreground`, `text-zinc-400/500`); Prime Blue `bg-primary` = actions only; `pa-green` = live/positive data only. `toast()` not alert().

## Architecture (1 line each)
- Migrations `supabase/migrations/` 001–012 = live. After schema change: regenerate `database.types.ts` (MCP generate_typescript_types).
- Auth: FIRST-PARTY progressive-enhancement forms — `<form action={serverAction}>` in AuthForm → src/app/auth/actions.ts (works with zero JS; browser supabase-js = fallback only). Auto-confirm ON → signup returns session → hard-navigate.
- Middleware protects /dashboard /watchlists /signals /opportunities/finder /admin /portfolio /deal-board /screener /reports/market; paid-only: /signals /opportunities/finder. Anonymous fast-path skips Supabase.
- profiles column grants (mig 004): client can update only full_name/alert_preferences — payment_method_on_file, tiers etc. are service-role-only.
- Stripe: webhook resolves user via subscription metadata user_id; 500 on DB failure → retry; all billing states handled. Card-on-file activation: /api/stripe/setup (Checkout mode=setup) gates free screener quota (mig 008). Annual billing (30% off, added 2026-07-07): 3 extra Stripe prices per tier, resolved by lookup_key `prime_atlas_<tier>_annual` — no new env vars; webhook falls back to price.metadata.tier when a price ID isn't in the env-var map.
- Public pages static/ISR via cookie-less `public.ts`; never add cookies() to them. Static pages redact listings unconditionally.
- Free-tier funnel: non-members get locality-only addresses + zero photos (src/lib/access.ts, fails closed); /underpriced members-only w/ teaser + waitlist (mig 009, cron mails paid tiers only); share links /s/[token] (mig 011, service-role resolved, tokens unguessable).
- Engines (pure + vitest): screener.ts (pro-forma/sensitivity/scorecard), marketReport.ts (scores/signals/rate grid), levers.ts (value levers), proforma.ts (Investment Analysis Report), yield.ts.
- Anthropic responses: content may lead with a thinking block — always `content.find(b => b.type==="text")`. Cron route handlers need `fetchCache = "force-no-store"` (Data Cache froze reads once).
- Scraping: /api/cron/scrape-listings (targets generated in-route; tiered — busiest markets daily, long tail every 3 days via ?tier=; OTM numeric ids only; upsert never shrinks galleries), /api/cron/enrich-agents every 3 days (per-provider markers; Zillow blocking comes/goes — don't hammer). ~11k properties, galleries backfilling.
- Opportunities: all 32 markets ≥3 active theses; /api/cron/generate-opportunities is grounded-Claude, dedupe-indexed (mig 010), self-terminating.

## Env (Vercel prod+preview + .env.local)
Supabase trio · STRIPE_SECRET_KEY/WEBHOOK_SECRET/3 price IDs/PORTAL_CONFIG_ID · NEXT_PUBLIC_APP_URL · CRON_SECRET · SCRAPEOPS_API_KEY · SLACK_WEBHOOK_URL · RESEND_API_KEY + RESEND_FROM_EMAIL (delivers only to owner until domain verified) · ANTHROPIC_API_KEY (live).

## State / next
- Engineering launch-complete. Owner-side remaining (see LAUNCH_CHECKLIST.md): live Stripe card test, domain (+Resend/webhook/APP_URL), legal review of disclaimers, design-partner outreach.
- Documented limitations: KNOWN_ISSUES.md. Admin gate: src/lib/auth/admins.ts (ADMIN_EMAILS env override).
