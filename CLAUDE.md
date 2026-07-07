# Prime Atlas — session brief

US/UK property-investment SaaS. Next.js 14 App Router + Supabase (`vcnpevcmnobpznikahku`) + Stripe (live, acct SabioAI) + ScrapeOps. Deploy = push `main` (repo dahaninc/Prime-atlas → Vercel). Prod: https://prime-atlas-weld.vercel.app (domain not attached yet).

## Hard rules
- `npm run typecheck && npm run lint && npm test && npm run build` must pass. After deploy: `python3 scripts/qa/e2e_smoke.py` (39 checks).
- **Market scope FROZEN at 32 (18 US / 14 UK) until launch + revenue.** No new markets/feeds/geographies. Fix copy down, never DB up.
- **One pricing ladder**: free / explorer $29.99 / professional $69.99 / institutional $89.99, monthly or annual (−30%, see below). Never per-feature SKUs. Quota on free, unlimited on paid.
- Never advice language ("good deal", rankings-as-recommendation). Deltas/calculations + "not investment advice". Say "institutional-grade intelligence", NEVER "insider information".
- Server-side gating for anything paid; UI locks are presentation only. Redaction/blur must strip data server-side (blurred DOM text = leak).
- No caching service worker (sw.js is a self-destruct kill switch, no-store). Never re-enable `typescript.ignoreBuildErrors`.
- Dark theme tokens only (`bg-card`, `text-foreground`, `text-zinc-400/500`); Prime Blue `bg-primary` = actions only; `pa-green` = live/positive data only. `toast()` not alert().
- **Never run `vercel env pull` (or any Vercel CLI mutating command) inside a disposable/background bash one-liner.** It silently overwrites `.env.local`. Once wiped every real secret except public Supabase values is unrecoverable via CLI/dashboard (Vercel "Sensitive" vars are write-only) — only the owner's own password manager / each service's dashboard can restore them.

## Architecture (1 line each)
- Migrations `supabase/migrations/` 001–013 = live. After schema change: regenerate `database.types.ts` (MCP generate_typescript_types).
- Auth: FIRST-PARTY progressive-enhancement forms — `<form action={serverAction}>` in AuthForm → src/app/auth/actions.ts (zero-JS safe). Auto-confirm ON → signup returns session → hard-navigate.
- Middleware protects /dashboard /watchlists /signals /opportunities/finder /admin /portfolio /deal-board /screener /reports/market; paid-only: /signals /opportunities/finder. Admin gate: src/lib/auth/admins.ts `isAdminEmail()` is the ONLY source of truth (ADMIN_EMAILS env override) — every admin page/route must import it, never hardcode the email list.
- profiles column grants (mig 004): client can update only full_name/alert_preferences — payment_method_on_file, tiers etc. are service-role-only. Admin tier override UI: /admin (TierSelect + setUserTier action), no more manual SQL.
- Stripe: webhook resolves user via subscription metadata user_id; 500 on DB failure → retry; all billing states handled. Card-on-file activation: /api/stripe/setup gates free screener quota (mig 008). Annual billing (−30%, 3 extra live prices, lookup_key `prime_atlas_<tier>_annual`, no new env vars) — webhook tier resolution falls back to price.metadata.tier when a price ID isn't in the env-var map.
- Public pages static/ISR via cookie-less `public.ts`; never add cookies() to them. Static pages redact listings unconditionally.
- Free-tier funnel: non-members get locality-only addresses + zero photos (src/lib/access.ts, fails closed); /underpriced members-only w/ teaser + waitlist (mig 009); share links /s/[token] (mig 011, unguessable tokens).
- Engines (pure + vitest): screener.ts, marketReport.ts, levers.ts, proforma.ts (→ Investment Analysis Report export, not "IC memo" — renamed everywhere 2026-07-07), yield.ts.
- Market feed (/market-feed): fetches ALL active listings per (currency, listing_type) segment via paginated `.range()` — PostgREST hard-caps any single request at 1000 rows regardless of `.limit()`. Don't reintroduce a flat `.limit(N)` global query.
- Scraping: /api/cron/scrape-listings tiered by market size — `?tier=daily` (busiest: top-10 US sale + top-5 US/UK rent metros + London, existing cadence) vs `?tier=longtail` (rest, every 3 days, vercel.json `*/3` day-of-month). Never state this cadence split in user-facing copy. enrich-agents also every 3 days (was hourly — cost driver, not freshness-critical). ~11k properties.
- Opportunities: all 32 markets ≥3 active theses; /api/cron/generate-opportunities is grounded-Claude, dedupe-indexed (mig 010), self-terminating.
- Anthropic responses may lead with a thinking block — always `content.find(b => b.type==="text")`. Cron routes need `fetchCache = "force-no-store"`.

## Env (Vercel prod+preview + .env.local)
Supabase trio · STRIPE_SECRET_KEY/WEBHOOK_SECRET/3 monthly price IDs/PORTAL_CONFIG_ID (annual prices resolved via Stripe lookup_key, no env needed) · NEXT_PUBLIC_APP_URL · CRON_SECRET · SCRAPEOPS_API_KEY · SLACK_WEBHOOK_URL · RESEND_API_KEY + RESEND_FROM_EMAIL (owner-only delivery until domain verified) · ANTHROPIC_API_KEY.

## State / next
- Engineering launch-complete. Owner-side remaining (LAUNCH_CHECKLIST.md): live Stripe card test, domain, legal review of disclaimers, design-partner outreach.
- Documented limitations: KNOWN_ISSUES.md.
