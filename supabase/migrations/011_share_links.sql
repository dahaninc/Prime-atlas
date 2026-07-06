-- 011: Share links — the distribution flywheel.
--
-- Members share read-only views of their screener analyses and market
-- reports with counterparties (LPs, lenders, brokers, co-GPs). The share
-- page is the product demo; the sender does the selling.
--
-- Token is the capability: unguessable, revocable. RLS gives owners CRUD;
-- the public /s/[token] page resolves tokens via the service role, so no
-- anonymous SELECT policy exists (tokens can't be enumerated via PostgREST).

create table if not exists share_links (
  id         uuid primary key default gen_random_uuid(),
  token      text not null unique,
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('analysis', 'report')),
  ref_id     uuid not null,               -- screener_analyses.id | deal_board_reports.id
  revoked    boolean not null default false,
  view_count int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists share_links_user on share_links (user_id, created_at);

alter table share_links enable row level security;

create policy "Own share links CRUD" on share_links
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
