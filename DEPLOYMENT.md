# prime-atlas — Deployment Checklist

## 1. Supabase

### Environment variables (add to Vercel + local .env.local)
```
NEXT_PUBLIC_SUPABASE_URL=https://vcnpevcmnobpznikahku.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from Supabase Dashboard → Settings → API>
SUPABASE_SERVICE_ROLE_KEY=<from Supabase Dashboard → Settings → API>
```

### Migrations applied (via MCP — already done)
- [x] 001_initial_schema — 9 tables, RLS, triggers
- [x] 002_seed_data — 18 municipalities, 4 opportunities, 5 signals
- [x] 003_stripe_fields — stripe_customer_id, stripe_subscription_id, subscription_period_end
- [x] 004_step6_schema — signals.ai_summary, capital_enquiries, newsletter_subscribers

### Edge Functions deployed (via MCP — already done)
- [x] recompute-scores — schedule: `0 2 * * *` (2am UTC)
- [x] signal-alert — triggered by DB Webhook on signals INSERT
- [x] generate-signal-content — triggered by DB Webhook on signals INSERT
- [x] daily-digest — schedule: `0 8 * * *` (8am UTC)

### Manual steps in Supabase Dashboard

#### Database Webhooks (Database → Webhooks → Create new)
1. **signal-alert**
   - Table: `public.signals`, Events: INSERT
   - URL: `https://<your-project-ref>.supabase.co/functions/v1/signal-alert`
   - Method: POST, no auth header

2. **generate-signal-content**
   - Table: `public.signals`, Events: INSERT
   - URL: `https://<your-project-ref>.supabase.co/functions/v1/generate-signal-content`
   - Method: POST, no auth header

#### Scheduled Functions (Edge Functions → each function → Schedule)
- `recompute-scores`: cron `0 2 * * *`
- `daily-digest`: cron `0 8 * * *`

#### Auth → URL Configuration
- Site URL: `https://prime-atlas.com`
- Redirect URLs: `https://prime-atlas.com/auth/callback`

#### Auth → Email Templates
- Confirm signup → point to `/auth/callback`

---

## 2. Stripe

### Steps
1. Dashboard → Products → Create 3 products:
   - **Pro** — Recurring, €149/month → copy price ID
   - **Investor** — Recurring, €499/month → copy price ID
   - **Institutional** — One-time or custom → copy price ID (or leave blank)

2. Dashboard → Developers → Webhooks → Add endpoint:
   - URL: `https://prime-atlas.com/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy signing secret

3. Dashboard → Settings → Customer Portal → Enable + configure

### Environment variables
```
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_INVESTOR=price_...
STRIPE_PRICE_INSTITUTIONAL=price_...  # or leave blank to redirect to contact
```

---

## 3. Resend

### Steps
1. resend.com → Add domain `prime-atlas.com` → verify DNS
2. Create Audience → copy audience ID
3. Copy API key

### Environment variables
```
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=alerts@prime-atlas.com
RESEND_AUDIENCE_ID=<from Resend Audiences>
CAPITAL_TEAM_EMAIL=capital@prime-atlas.com
```

---

## 4. Anthropic

```
ANTHROPIC_API_KEY=sk-ant-...
```

---

## 5. PostHog

1. posthog.com → Create project (EU cloud recommended for GDPR)
2. Copy project API key + host

```
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```

---

## 6. Vercel

### All env vars (add under Settings → Environment Variables)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_PRO
STRIPE_PRICE_INVESTOR
STRIPE_PRICE_INSTITUTIONAL
RESEND_API_KEY
RESEND_FROM_EMAIL
RESEND_AUDIENCE_ID
CAPITAL_TEAM_EMAIL
NEXT_PUBLIC_POSTHOG_KEY
NEXT_PUBLIC_POSTHOG_HOST
NEXT_PUBLIC_APP_URL=https://prime-atlas.com
APP_URL=https://prime-atlas.com
```

### GitHub Secrets (for CI/CD)
```
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

---

## 7. Supabase Edge Function secrets
In Supabase Dashboard → Edge Functions → Secrets, add:
```
ANTHROPIC_API_KEY
APP_URL=https://prime-atlas.com
RESEND_API_KEY
```
(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected)

---

## 8. DNS
Point `prime-atlas.com` → Vercel (add domain in Vercel project settings)
Add Resend DNS records for email sending

---

## 9. Launch smoke tests
- [ ] `/` homepage loads
- [ ] `/rankings` shows 18+ municipalities
- [ ] `/auth/signup` + email confirmation works
- [ ] `/opportunities/finder` gated for free users → redirects to `/pricing`
- [ ] Stripe Checkout completes → profile.subscription_tier updated
- [ ] `/signals` live feed loads for Pro user
- [ ] Claude thesis generates on `/opportunities/[slug]`
- [ ] Signal INSERT triggers `signal-alert` + `generate-signal-content`
- [ ] `/capital` enquiry form submits + team email received
- [ ] Newsletter signup adds to Resend audience
- [ ] PostHog receives pageview events
