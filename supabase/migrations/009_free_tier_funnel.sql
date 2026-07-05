-- 009: Free-tier funnel — undervalued-property waitlist + metered Deal Board
-- market reports.
--
-- Waitlist: any authenticated user can join (that's the acquisition hook);
-- notifications are sent by the deal-alerts cron ONLY to paid tiers — the
-- "activates with membership" promise lives in the cron's tier filter, not
-- in who may join. Hits table is service-role only (no client policies).
--
-- Reports: free tier gets 3 reports TOTAL (lifetime, not monthly — reports
-- are market-level and don't go stale within a month); paid unlimited.
-- Metering counts rows, so RLS insert is still allowed — the server action
-- is the only writer in practice and enforces quota before insert.

create table if not exists underpriced_waitlist (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  municipality_id uuid references municipalities(id) on delete cascade, -- null = all markets
  created_at      timestamptz not null default now(),
  unique nulls not distinct (user_id, municipality_id)
);

create table if not exists underpriced_waitlist_hits (
  waitlist_id uuid not null references underpriced_waitlist(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  notified_at timestamptz not null default now(),
  primary key (waitlist_id, property_id)
);

create table if not exists deal_board_reports (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  municipality_id uuid not null references municipalities(id) on delete cascade,
  payload         jsonb not null,  -- full computed report (metrics, scenarios, signals)
  created_at      timestamptz not null default now()
);

create index if not exists deal_board_reports_user on deal_board_reports (user_id, created_at);

alter table underpriced_waitlist      enable row level security;
alter table underpriced_waitlist_hits enable row level security;  -- no policies: service-role only
alter table deal_board_reports        enable row level security;

create policy "Own waitlist CRUD" on underpriced_waitlist
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Own reports CRUD" on deal_board_reports
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
