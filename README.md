# prime-atlas

> **Find Tomorrow's Winners Before Everyone Else.**
> The Bloomberg for Future Investment Opportunities.

A decision-intelligence / capital-allocation platform that predicts which municipalities, regions, and development opportunities will become valuable *before* the market recognises them.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Database / Auth | Supabase (PostgreSQL + RLS) |
| Hosting | Vercel (ISR for SEO pages) |
| AI | Anthropic Claude (thesis generation + scoring) |
| Payments | Stripe |
| Email | Resend |
| Analytics | PostHog |

---

## Getting Started

### 1. Clone & install

```bash
git clone https://github.com/dahaninc/Prime-atlas.git
cd Prime-atlas
npm install
```

### 2. Environment variables

```bash
cp .env.example .env.local
```

Fill in your keys — see `.env.example` for all required values.

### 3. Supabase setup

The schema and seed data are already applied to the production Supabase project (`vcnpevcmnobpznikahku`).

For local development:
```bash
npx supabase login
npx supabase link --project-ref vcnpevcmnobpznikahku
npx supabase db pull   # pulls current schema
```

To regenerate TypeScript types after schema changes:
```bash
npx supabase gen types typescript --project-id vcnpevcmnobpznikahku > src/lib/supabase/database.types.ts
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Branch Model

| Branch | Purpose |
|--------|---------|
| `main` | Production — deploys to prime-atlas.com |
| `develop` | Staging — auto-deploys Vercel preview |
| `feature/*` | Feature branches — PR into develop |
| `hotfix/*` | Urgent fixes — PR directly into main |

---

## GitHub Secrets Required

Add these in **Settings → Secrets → Actions**:

```
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

---

## Build Steps

- [x] **Step 1** — Scaffold + Supabase schema + seed data + CI/CD
- [x] **Step 2** — Public SEO pages + Rankings + Auth
- [x] **Step 3** — Opportunity Finder + Score visualisations + Claude thesis ← *you are here*
- [ ] **Step 4** — Signals feed (Realtime) + Watchlists + Resend alerts
- [ ] **Step 5** — Stripe tiers + gating + PostHog analytics
- [ ] **Step 6** — Daily Signals auto-content + Capital deal scaffolding

---

## Subscription Tiers

| Tier | Price | Features |
|------|-------|---------|
| Free | €0 | Public rankings, opportunity pages, basic search |
| Pro | €149/mo | Opportunity Finder, alerts, signals |
| Investor | €499/mo | Advanced filtering, reports, watchlists, export |
| Institutional | €25k–100k/yr | API access, bulk intelligence, enterprise dashboards |
