# Prime Atlas — launch checklist

Engineering is complete and deployed (see KNOWN_ISSUES.md for documented
limitations). Everything below is owner-side. Total hands-on time: ~2 hours.

## 1. Live payment test — 20 minutes, do this FIRST
The revenue pipe has never processed a real card.
1. Open https://prime-atlas-weld.vercel.app in a private window.
2. Sign up with a personal email (not an admin one).
3. Go to /screener → "Add card & activate" → complete the $0 Stripe setup.
4. Save an analysis (uses 1 of 3 free) → confirm the quota counter drops.
5. Go to /pricing → subscribe to Explorer ($29.99) with a real card.
6. Confirm: dashboard shows paid tier, /screener says "Unlimited", /underpriced
   shows the full feed, /signals opens.
7. Stripe dashboard → refund the charge + cancel the subscription.
8. Confirm the account downgrades to free (webhook handles it).
If ANY step fails, that's a launch blocker — report exactly which step.

## 2. Domain — ~1 hour including DNS propagation
1. Buy prime-atlas.com (or chosen domain).
2. Vercel → prime-atlas project → Settings → Domains → add + follow DNS steps.
3. Vercel env: update NEXT_PUBLIC_APP_URL to https://<domain> (prod + preview).
4. Stripe dashboard → Webhooks → update endpoint URL to
   https://<domain>/api/stripe/webhook.
5. Resend → Domains → add + verify (SPF/DKIM records at the registrar).
6. Vercel env: RESEND_FROM_EMAIL → alerts@<domain> (or similar).
7. Redeploy (push any commit or Vercel "Redeploy").
8. Run: python3 scripts/qa/e2e_smoke.py --base https://<domain>
Unblocks: ALL customer email (deal alerts, waitlist notifications), correct
share-link URLs in copied links and Investment Analysis Report footers, SEO indexing.

## 3. Legal review — before public marketing
Disclaimers to review (all already say "not investment advice"):
- Screener scorecard: src/lib/screener.ts (SCORECARD_DISCLAIMER)
- Market reports: src/lib/marketReport.ts (REPORT_DISCLAIMER)
- Investment Analysis Report: src/app/api/export/ic-memo/route.ts (disclaimer paragraph)
- Share pages: src/app/s/[token]/page.tsx (footer)
- Underpriced feed + deal alert emails
Positioning note: the product says "institutional-grade intelligence",
never "insider information" (regulatory tripwire) — keep it that way.

## 4. Design-partner outreach — first 20 messages
Target: solo GPs / small syndicators raising $2M–15M, LP-turned-GPs,
small family offices. Templates (personalize the first line):

**DM / email — syndicator:**
> [Saw your recent deal in X / your post about Y.] I'm opening early access
> to Prime Atlas — a deal screener + market intelligence terminal for small
> acquisition teams. Drop an OM PDF, get an editable pro-forma (NOI, cap,
> DSCR, CoC, rate sensitivity) scored against YOUR buy-box in 90 seconds,
> plus live mispricing feeds for 32 US/UK markets. Free to try, 3 analyses
> on the house — I'd trade unlimited access for 20 minutes of feedback.
> Link: https://<domain>

**Follow-up hook (after they run one deal):**
> Try the "Share read-only link" on your analysis — it's built to send to
> your lender/LP with the sensitivity grid and value levers attached.

**Where to find them:** BiggerPockets forums (multifamily), LinkedIn
(search "acquisitions" + "multifamily" at <50-person firms), Twitter/X RE
community, local REIA meetups, CRE broker contacts (brokers forward tools
to buyers).

## 5. Week-one metrics to watch (Stripe + Supabase)
- Signups → card-activation rate (the new gate's first real test)
- Analyses run → wall hits at #4 → upgrades (the conversion moment)
- Share links created + view_count (the flywheel)
- Tier mix: if 90% land on Explorer and nobody upgrades, revisit which
  features sit in Professional/Institutional (prices stay; bundling moves)

## Already running with zero attention needed
- Hourly scrape + gallery enrichment, hourly deal alerts, weekly score
  snapshots (Vercel crons)
- Opportunity coverage: all 32 markets at 3+ theses; generation cron is
  self-terminating and duplicate-proof
- QA: 37 live checks — run scripts/qa/e2e_smoke.py after any deploy
