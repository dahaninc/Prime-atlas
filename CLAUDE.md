# Prime Atlas — project brief for Claude sessions

US/UK property-investment intelligence SaaS. Next.js 14 (App Router) + Supabase + Stripe + ScrapeOps, deployed on Vercel Pro via GitHub push to `main` (repo: dahaninc/Prime-atlas). Production: https://prime-atlas-weld.vercel.app (prime-atlas.com NOT attached yet).

## Commands
- `npm run typecheck` / `npm run lint` / `npm test` / `npm run build` — all must pass; CI (.github/workflows/ci.yml) enforces them. Never re-enable `typescript.ignoreBuildErrors`.
- Deploy = push to `main` (Vercel git integration). No Actions-based deploys.

## Architecture
- **Supabase** project `vcnpevcmnobpznikahku` (EU). Migrations in `supabase/migrations/` are the source of truth (001–006 match live). Regenerate `src/lib/supabase/database.types.ts` after schema changes.
- **Auth**: `@supabase/ssr` v0.12 with getAll/setAll cookies everywhere (`src/lib/supabase/server.ts`, `src/middleware.ts`). Client login only via `AuthForm` (supabase-js in browser). Middleware: anonymous fast-path (skips Supabase when no `sb-` cookies), protects /dashboard /watchlists /signals /opportunities/finder /admin /portfolio /deal-board; /signals + /opportunities/finder also require paid tier.
- **Tiers (canonical, everywhere)**: `free | explorer ($29.99) | professional ($69.99) | institutional ($89.99)`. DB enum matches. Stripe env: `STRIPE_PRICE_EXPLORER/PROFESSIONAL/INSTITUTIONAL` (legacy `_PRO/_INVESTOR` still fallback).
- **Stripe**: webhook `/api/stripe/webhook` (returns 500 on DB failure so Stripe retries; resolves user via subscription metadata `user_id` first; all billing states handled — past_due/unpaid → free). Checkout seeds metadata. Portal config `bpc_...` is account default. Account: SabioAI (`acct_1ToUdM2Lj8cdtHlx`), live mode.
- **Public pages are static/ISR** via `src/lib/supabase/public.ts` (cookie-less client): home (1h), opportunities/[slug] (5m, `●`), rankings/legal (static). Navbar resolves user client-side — never add `cookies()` back to public layouts.
- **Design language (obsidian dark, July 2026 rebrand)**: whole app is dark-first via semantic tokens in `globals.css` — canvas `#09090b` (`bg-background`), panels `#141416` (`bg-card`), borders `#222226` (`border-border`). Prime Blue `#2563eb` (`bg-primary`, alias `pa-blue`) = ONLY action/brand/active-state color; green `pa-green/#00C805` = live/positive data only, never CTAs. Always use semantic token classes (`bg-card`, `text-foreground`, `text-zinc-400/500` for muted) — never raw light-theme classes (`bg-white`, `text-gray-*`) or brand hexes. Utilities in globals.css: `.glass`/`.glass-panel` (backdrop-blur chrome + dropdowns), `.active-glow` (nav left-accent), `.skeleton` (shimmer loaders), `.status-dot-live/busy/error`, `.kicker`. Toasts: `toast()` from `src/components/ui/Toaster.tsx` (mounted in root layout), bottom-right micro-toasts — no alert(). Kickers: mono uppercase tracking-widest.

## Scraping pipeline
- `/api/cron/scrape-listings?provider=X&batch=N` — ScrapeOps proxy, 5 URLs/batch, 45s timeouts, 1 retry, 180s soft deadline. Batches scheduled in vercel.json. Upsert NEVER shrinks a stored image gallery.
- `/api/cron/enrich-agents` (hourly) — detail-page pass: agent info + FULL photo gallery (uncapped, Zillow size-variants deduped; `gdpClientCache` is a JSON *string*). Sets `properties.gallery_synced_at` only when photos found; plain fetch → render_js+residential fallback (10× credits) on block. Backlog ~1,269 rows, ~2–3 days.
- Properties auto-link to municipalities via DB trigger `match_property_municipality` (address ILIKE market name). 631/1269 matched as of 2026-07-04.

## Member features (deal-flow layer, migration 006)
- `market_listing_stats` view: per-market sale/rent counts, median price, median /sqm, underpriced count (≥15% below median /sqm). Powers Deal Board "Live market pulse".
- `/api/cron/deal-alerts` (hourly): matches new listings to `deal_alert_rules` (price/beds/discount/est-yield via `src/lib/yield.ts`), emails via Resend, dedupe via `deal_alert_hits`.
- `/api/cron/snapshot-scores` (weekly Mon): appends to `market_score_history` → momentum arrows on Deal Board.
- `/portfolio` (institutional-gated): `portfolio_assets` + per-market intel.
- IC memo export (DealBoard.tsx `generateMemo`) includes live stats, momentum, infra budgets, planning apps, signals, provenance.

## Env vars (all in Vercel prod+preview and .env.local)
Supabase trio · STRIPE_SECRET_KEY (restricted rk_live) · STRIPE_WEBHOOK_SECRET · 3 price IDs · STRIPE_PORTAL_CONFIG_ID · NEXT_PUBLIC_APP_URL · CRON_SECRET · SCRAPEOPS_API_KEY · SLACK_WEBHOOK_URL · RESEND_API_KEY (send-only) · RESEND_FROM_EMAIL (temp `onboarding@resend.dev` — only delivers to owner's inbox until a domain is bought + verified in Resend). Missing: ANTHROPIC_API_KEY (thesis generation off).

## Known gaps / next up
- UX cohesion pass DONE (July 2026): obsidian dark rebrand shipped — all green CTAs → Prime Blue, light-theme classes eliminated, glass chrome, skeleton/toast primitives. Remaining polish: consistent page headers across member pages.
- Marketing copy claims "80+ markets"; DB has 32 US/UK municipalities (badge shows live count). Owner to decide: add markets or soften copy.
- E2E live payment test never run (needs a real card; refund after).
- Domain purchase pending → then: attach in Vercel, update NEXT_PUBLIC_APP_URL, Stripe webhook URL, verify domain in Resend, update RESEND_FROM_EMAIL.
- Admin gate = email list in `src/lib/auth/admins.ts` (override via ADMIN_EMAILS env).
