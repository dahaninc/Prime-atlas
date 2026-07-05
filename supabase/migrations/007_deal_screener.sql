-- 007: Deal Screener — saved criteria profiles + quota-metered analyses.
-- Scorecards are criteria-match calculations, never advice; RLS scopes
-- everything to the owning user (IDOR-safe by construction).

create table if not exists screener_criteria (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  name               text not null default 'My criteria',
  country            text not null default 'United States',
  target_cap_pct     numeric,          -- e.g. 6.0
  min_dscr           numeric,          -- e.g. 1.25
  max_price_per_unit numeric,          -- major units, e.g. 250000
  target_coc_pct     numeric,          -- e.g. 8.0
  hold_years         int,
  active             boolean not null default true,
  created_at         timestamptz not null default now()
);

create table if not exists screener_analyses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  criteria_id uuid references screener_criteria(id) on delete set null,
  name        text,
  country     text not null default 'United States',
  inputs      jsonb not null,   -- deal + assumption inputs (parsed or manual)
  outputs     jsonb not null,   -- computed pro-forma metrics
  scorecard   jsonb,            -- per-metric pass/fail + deltas vs criteria
  created_at  timestamptz not null default now()
);

create index if not exists screener_analyses_user_month
  on screener_analyses (user_id, created_at);

alter table screener_criteria enable row level security;
alter table screener_analyses enable row level security;

create policy "Own criteria CRUD" on screener_criteria
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Own analyses CRUD" on screener_analyses
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
